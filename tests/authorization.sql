-- Run via Supabase SQL editor / execute_sql. All fixtures are rolled back.
begin;
insert into public.workspaces(id,slug,name) values ('10000000-0000-0000-0000-000000000001','lom-test','Disposable authorization fixture');
insert into public.invitations(workspace_id,email,roles) values
('10000000-0000-0000-0000-000000000001','admin@lom-test.invalid',array['admin']),
('10000000-0000-0000-0000-000000000001','recon@lom-test.invalid',array['conciliacion']),
('10000000-0000-0000-0000-000000000001','distribution@lom-test.invalid',array['distribucion']),
('10000000-0000-0000-0000-000000000001','unconfirmed@lom-test.invalid',array['admin']);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('20000000-0000-0000-0000-000000000001','admin@lom-test.invalid',now(),'{}'),
('20000000-0000-0000-0000-000000000002','recon@lom-test.invalid',now(),'{}'),
('20000000-0000-0000-0000-000000000003','distribution@lom-test.invalid',now(),'{}'),
('20000000-0000-0000-0000-000000000004','outsider@lom-test.invalid',now(),'{"roles":["admin"]}'),
('20000000-0000-0000-0000-000000000005','unconfirmed@lom-test.invalid',null,'{}');
do $$begin
 if exists(select 1 from public.memberships where user_id='20000000-0000-0000-0000-000000000005') then raise exception 'Unconfirmed email gained access'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"leads","id":"fixture","data":{"id":"fixture","nombre":"Test"},"version":0,"position":0,"operation":"upsert"}]','30000000-0000-0000-0000-000000000001');
-- Idempotent retry must not duplicate a write or increment its version.
select public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"leads","id":"fixture","data":{"id":"fixture","nombre":"Test"},"version":0,"position":0,"operation":"upsert"}]','30000000-0000-0000-0000-000000000001');
do $$begin
 if (select version from public.app_records where id='fixture')<>1 then raise exception 'Idempotency failed'; end if;
 begin
  perform public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"clients","id":"atomic","data":{},"version":0,"position":0},{"collection":"leads","id":"fixture","data":{},"version":0,"position":0}]','30000000-0000-0000-0000-000000000002');
  raise exception 'Stale update accepted';
 exception when serialization_failure then null; end;
 if exists(select 1 from public.app_records where id='atomic') then raise exception 'Atomic rollback failed'; end if;
 begin update public.audit_events set action='FORGED';raise exception 'Audit was editable';exception when insufficient_privilege then null;end;
 begin update public.memberships set roles=array['conciliacion'] where user_id=auth.uid();exception when others then null;end;
 if not ('admin'=any(private.roles_for('10000000-0000-0000-0000-000000000001'))) then raise exception 'Self demotion allowed';end if;
end$$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
do $$begin
 if exists(select 1 from public.app_records) then raise exception 'Outsider read records';end if;
 if exists(select 1 from public.workspaces) then raise exception 'Outsider read workspaces';end if;
 if exists(select 1 from public.audit_events) then raise exception 'Outsider read audit';end if;
 begin insert into public.memberships(workspace_id,user_id,roles) values('10000000-0000-0000-0000-000000000001',auth.uid(),array['admin']);raise exception 'Self escalation allowed';exception when insufficient_privilege then null;end;
 begin perform public.commit_changes('10000000-0000-0000-0000-000000000001','[]','30000000-0000-0000-0000-000000000003');raise exception 'Outsider RPC accepted';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$begin
 if (select count(*) from public.app_records where id='fixture')<>1 then raise exception 'Authorized read failed';end if;
 begin update public.app_records set data='{}' where id='fixture';exception when insufficient_privilege then null;end;
 if (select data->>'nombre' from public.app_records where id='fixture')<>'Test' then raise exception 'Recon edited lead';end if;
 begin perform public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"leads","id":"illegal","data":{},"version":0}]','30000000-0000-0000-0000-000000000004');raise exception 'Recon lead write accepted';exception when insufficient_privilege then null;end;
end$$;
select public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"reconciliations","id":"allowed","data":{"id":"allowed"},"version":0}]','30000000-0000-0000-0000-000000000005');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
select public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"clients","id":"client","data":{"id":"client"},"version":0}]','30000000-0000-0000-0000-000000000006');
do $$begin
 begin insert into public.invitations(workspace_id,email,roles) values('10000000-0000-0000-0000-000000000001','escalate@lom-test.invalid',array['admin']);raise exception 'Distribution granted admin';exception when insufficient_privilege then null;end;
 begin perform public.commit_changes('10000000-0000-0000-0000-000000000001','[{"collection":"settings","id":"default","data":{},"version":0}]','30000000-0000-0000-0000-000000000007');raise exception 'Distribution edited settings';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
update public.memberships set active=false where user_id='20000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
do $$begin if exists(select 1 from public.app_records) then raise exception 'Suspended user retained access';end if;end$$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.app_records;raise exception 'Anonymous read accepted';exception when insufficient_privilege then null;end;
 begin perform public.commit_changes('10000000-0000-0000-0000-000000000001','[]','30000000-0000-0000-0000-000000000008');raise exception 'Anonymous RPC accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'PASS: confirmed invitations, member isolation, role boundaries, immutable audit, immediate revocation, atomic writes, concurrency conflict, idempotent retry and anonymous denial' as result;
