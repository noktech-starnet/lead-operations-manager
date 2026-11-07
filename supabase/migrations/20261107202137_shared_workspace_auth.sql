-- Baseline is also safe to register after the connected-service installation.
do $baseline$ begin
if to_regclass('public.app_records') is not null and to_regprocedure('public.commit_changes(uuid,jsonb,uuid)') is not null then return; end if;
-- One shared workspace. Each business record retains the prototype's exact fields.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
 created_at timestamptz not null default now()
);
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, display_name text not null default ''
);
create table public.memberships (
 workspace_id uuid not null references public.workspaces(id),
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 roles text[] not null check (cardinality(roles)>0 and roles <@ array['admin','distribucion','conciliacion']),
 active boolean not null default true,
 primary key(workspace_id,user_id)
);
create index memberships_user_id_idx on public.memberships(user_id);
create table public.invitations (
 workspace_id uuid not null references public.workspaces(id), email text not null check(email=lower(trim(email))),
 roles text[] not null check (cardinality(roles)>0 and roles <@ array['admin','distribucion','conciliacion']),
 created_at timestamptz not null default now(), primary key(workspace_id,email)
);
create table public.app_records (
 workspace_id uuid not null references public.workspaces(id),
 collection text not null check(collection in ('leads','batches','deliveries','clients','distributions','weeklyReports','reconciliations','cities','goals','mappings','settings','auditLogs')),
 id text not null check(length(id) between 1 and 512),
 data jsonb not null check(jsonb_typeof(data)='object'),
 sort_order integer not null default 0,
 version bigint not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,collection,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 actor_id uuid, actor_email text, collection text not null, record_id text not null,
 action text not null, old_data jsonb, new_data jsonb, occurred_at timestamptz not null default now()
);
create index audit_events_workspace_time_idx on public.audit_events(workspace_id,occurred_at desc,id);
-- Private helper reads current membership on every request: revocation is immediate.
create function private.roles_for(w uuid) returns text[] language sql stable security definer set search_path='' as $$
 select coalesce((select m.roles from public.memberships m join auth.users u on u.id=m.user_id
 where m.workspace_id=w and m.user_id=(select auth.uid()) and m.active and u.email_confirmed_at is not null),'{}'::text[])
$$;
revoke all on function private.roles_for(uuid) from public,anon;
grant execute on function private.roles_for(uuid) to authenticated;
create function private.can_write(w uuid,c text) returns boolean language sql stable set search_path='' as $$
 select 'admin'=any(private.roles_for(w)) or
 ('distribucion'=any(private.roles_for(w)) and c in ('leads','batches','deliveries','clients','distributions','weeklyReports','mappings','auditLogs')) or
 ('conciliacion'=any(private.roles_for(w)) and c in ('reconciliations','auditLogs'))
$$;
revoke all on function private.can_write(uuid,text) from public,anon;
grant execute on function private.can_write(uuid,text) to authenticated;
-- Only trusted triggers can provision membership. Merely entering an invited email is insufficient.
create function private.sync_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,email,display_name) values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'name',''))
 on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name;
 if new.email_confirmed_at is not null then
  insert into public.memberships(workspace_id,user_id,roles)
  select workspace_id,new.id,roles from public.invitations where email=lower(new.email)
  on conflict(workspace_id,user_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.sync_auth_user() from public,anon,authenticated;
create trigger lom_auth_user after insert or update of email,email_confirmed_at,raw_user_meta_data on auth.users
 for each row execute function private.sync_auth_user();
create function private.apply_invitation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not ('admin'=any(private.roles_for(new.workspace_id))) then raise exception 'Administrator required'; end if;
 insert into public.memberships(workspace_id,user_id,roles)
 select new.workspace_id,id,new.roles from auth.users where lower(email)=new.email and email_confirmed_at is not null
 on conflict(workspace_id,user_id) do update set roles=excluded.roles,active=true;
 return new;
end $$;
revoke all on function private.apply_invitation() from public,anon,authenticated;
create trigger lom_invitation after insert or update on public.invitations for each row execute function private.apply_invitation();
-- Prevent even an administrator from accidentally removing their own access.
create function private.protect_membership() returns trigger language plpgsql set search_path='' as $$
begin
 if old.user_id=(select auth.uid()) then raise exception 'You cannot change your own access'; end if;
 if new.workspace_id<>old.workspace_id or new.user_id<>old.user_id then raise exception 'Membership identity cannot change'; end if;
 return new;
end $$;
revoke all on function private.protect_membership() from public,anon,authenticated;
create trigger lom_membership_guard before update on public.memberships for each row execute function private.protect_membership();
-- Database generated immutable history. No client can insert, edit, or delete this history.
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; w uuid; c text; rid text;
begin
 if tg_table_name='app_records' then
  w:=coalesce(new.workspace_id,old.workspace_id); c:=coalesce(new.collection,old.collection); rid:=coalesce(new.id,old.id);
 else
  r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  w:=(r->>'workspace_id')::uuid; c:=tg_table_name; rid:=coalesce(r->>'user_id',r->>'email');
 end if;
 insert into public.audit_events(workspace_id,actor_id,actor_email,collection,record_id,action,old_data,new_data)
 values(w,auth.uid(),(select email from auth.users where id=auth.uid()),c,rid,tg_op,
 case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end);
 return coalesce(new,old);
end $$;
revoke all on function private.audit_change() from public,anon,authenticated;
create trigger lom_record_audit after insert or update or delete on public.app_records for each row execute function private.audit_change();
create trigger lom_member_audit after insert or update or delete on public.memberships for each row execute function private.audit_change();
create trigger lom_invite_audit after insert or update or delete on public.invitations for each row execute function private.audit_change();

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.app_records enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.workspaces,public.profiles,public.memberships,public.invitations,public.app_records,public.audit_events from anon,authenticated;
grant select on public.workspaces,public.profiles,public.memberships,public.invitations,public.app_records,public.audit_events to authenticated;
grant insert,update,delete on public.invitations to authenticated;
grant update(roles,active) on public.memberships to authenticated;
grant insert,update,delete on public.app_records to authenticated;
create policy workspace_read on public.workspaces for select to authenticated using(cardinality(private.roles_for(id))>0);
create policy profile_read on public.profiles for select to authenticated using(user_id=(select auth.uid()) or exists(
 select 1 from public.memberships m where m.user_id=profiles.user_id and 'admin'=any(private.roles_for(m.workspace_id))));
create policy member_read on public.memberships for select to authenticated using(user_id=(select auth.uid()) or 'admin'=any(private.roles_for(workspace_id)));
create policy member_update on public.memberships for update to authenticated
 using('admin'=any(private.roles_for(workspace_id)) and user_id<>(select auth.uid()))
 with check('admin'=any(private.roles_for(workspace_id)) and user_id<>(select auth.uid()));
create policy invitation_read on public.invitations for select to authenticated using('admin'=any(private.roles_for(workspace_id)));
create policy invitation_insert on public.invitations for insert to authenticated with check('admin'=any(private.roles_for(workspace_id)));
create policy invitation_update on public.invitations for update to authenticated using('admin'=any(private.roles_for(workspace_id))) with check('admin'=any(private.roles_for(workspace_id)));
create policy invitation_delete on public.invitations for delete to authenticated using('admin'=any(private.roles_for(workspace_id)));
create policy record_read on public.app_records for select to authenticated using(cardinality(private.roles_for(workspace_id))>0);
create policy record_insert on public.app_records for insert to authenticated with check(private.can_write(workspace_id,collection));
create policy record_update on public.app_records for update to authenticated using(collection<>'auditLogs' and private.can_write(workspace_id,collection)) with check(collection<>'auditLogs' and private.can_write(workspace_id,collection));
create policy record_delete on public.app_records for delete to authenticated using(collection<>'auditLogs' and 'admin'=any(private.roles_for(workspace_id)));
create policy audit_read on public.audit_events for select to authenticated using('admin'=any(private.roles_for(workspace_id)));
-- Idempotency receipts make retries safe after a lost HTTP response.
create table private.write_receipts(workspace_id uuid not null references public.workspaces(id),request_id uuid not null,actor_id uuid not null,created_at timestamptz not null default now(),primary key(workspace_id,request_id));
alter table private.write_receipts enable row level security;
grant select,insert on private.write_receipts to authenticated;
create policy receipt_read on private.write_receipts for select to authenticated using(actor_id=(select auth.uid()) and cardinality(private.roles_for(workspace_id))>0);
create policy receipt_insert on private.write_receipts for insert to authenticated with check(actor_id=(select auth.uid()) and cardinality(private.roles_for(workspace_id))>0);
-- All UI changes in one transaction. Version checks prevent one browser overwriting another.
create function public.commit_changes(p_workspace uuid,p_changes jsonb,p_request uuid) returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; current_version bigint; c text; rid text; body jsonb;
begin
 if auth.uid() is null or cardinality(private.roles_for(p_workspace))=0 then raise exception 'Access denied' using errcode='42501'; end if;
 if jsonb_typeof(p_changes)<>'array' then raise exception 'Expected an array'; end if;
 -- Serializes concurrent commits within a workspace, including first inserts.
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,0));
 if exists(select 1 from private.write_receipts where workspace_id=p_workspace and request_id=p_request and actor_id=auth.uid()) then return; end if;
 for item in select value from jsonb_array_elements(p_changes) loop
  c:=item->>'collection'; rid:=item->>'id';
  if not private.can_write(p_workspace,c) then raise exception 'Permission denied for %',c using errcode='42501'; end if;
  select version into current_version from public.app_records where workspace_id=p_workspace and collection=c and id=rid for update;
  if coalesce(current_version,0)<>coalesce((item->>'version')::bigint,0) then raise exception 'CONFLICT: Data changed in another session. Refresh and try again.' using errcode='40001'; end if;
  if item->>'operation'='delete' then
   if not ('admin'=any(private.roles_for(p_workspace))) or c='auditLogs' then raise exception 'Delete denied' using errcode='42501'; end if;
   delete from public.app_records where workspace_id=p_workspace and collection=c and id=rid;
  else
   body:=item->'data';
   if c='auditLogs' then body:=jsonb_set(body,'{user}',to_jsonb((select email from public.profiles where user_id=auth.uid()))); end if;
   if current_version is null then
    insert into public.app_records(workspace_id,collection,id,data,sort_order) values(p_workspace,c,rid,body,coalesce((item->>'position')::integer,0));
   else
    update public.app_records set data=body,sort_order=coalesce((item->>'position')::integer,0),version=version+1,updated_at=now() where workspace_id=p_workspace and collection=c and id=rid;
   end if;
  end if;
 end loop;
 insert into private.write_receipts(workspace_id,request_id,actor_id) values(p_workspace,p_request,auth.uid());
end $$;
revoke all on function public.commit_changes(uuid,jsonb,uuid) from public,anon;
grant execute on function public.commit_changes(uuid,jsonb,uuid) to authenticated;
-- Administrator invitations are provisioned separately through the connected
-- service, after the owner specifies the email. No password is created here.
insert into public.workspaces(slug,name) values('lead-operations','Lead Operations Manager');

-- Supabase installs this event-trigger helper; it is not a public RPC.
do $guard$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $guard$;

end $baseline$;
