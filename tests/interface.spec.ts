import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
// Deterministic UI regression tests. Actual database authorization is tested separately in authorization.sql.
const workspace='10000000-0000-0000-0000-000000000001';
const uid='20000000-0000-0000-0000-000000000001';
async function mockBackend(page:Page,{approved=true,roles=['admin','distribucion','conciliacion']}={}){
 let user={id:uid,aud:'authenticated',role:'authenticated',email:'operator@lom-test.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{name:'Operador de prueba'}};
 const records=new Map<string,any>();
 records.set('settings/default',{collection:'settings',id:'default',data:{defaultCampaign:'Pensiones',timezone:'America/Mexico_City',dateFormat:'DD/MM/YYYY',defaultBatchSize:1000},version:1,sort_order:0});
 let failNext=false;let commits=0;
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request();const url=new URL(request.url());const body=request.postDataJSON?.();
  const send=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname.endsWith('/token')){
   if(body.password==='wrong')return send({error:'invalid_grant',error_description:'Invalid login credentials',msg:'Invalid login credentials'},400);
   const b64=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fixture';
   return send({access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'test-fixture',user});
  }
  if(url.pathname.endsWith('/signup'))return send({user:{...user,email:body.email},session:null});
  if(url.pathname.endsWith('/user'))return send(user);
  if(url.pathname.endsWith('/logout'))return route.fulfill({status:204,body:''});
  if(url.pathname.endsWith('/memberships')){
   const m={workspace_id:workspace,user_id:uid,roles,active:true,profiles:{email:user.email,display_name:'Operador de prueba'}};
   return send(request.headers().accept?.includes('vnd.pgrst.object')?(approved?m:null):(approved?[m]:[]));
  }
  if(url.pathname.endsWith('/app_records'))return send([...records.values()]);
  if(url.pathname.endsWith('/invitations')||url.pathname.endsWith('/audit_events'))return send([]);
  if(url.pathname.endsWith('/commit_changes')){
   if(failNext){failNext=false;return send({message:'Connection interrupted',code:'08006'},503);}
   commits++;
   for(const change of body.p_changes){const key=change.collection+'/'+change.id;if(change.operation==='delete')records.delete(key);else records.set(key,{collection:change.collection,id:change.id,data:change.data,version:change.version+1,sort_order:change.position});}
   return send(null);
  }
  return send({message:'Unexpected mock request: '+url.pathname},400);
 });
 return {records,fail:()=>{failNext=true;},commits:()=>commits};
}
async function login(page:Page){
 await page.getByLabel('Correo electrónico').fill('operator@lom-test.invalid');
 await page.getByLabel('Contraseña',{exact:true}).fill(randomUUID());
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Dashboard Ejecutivo y Ciclo de Leads'})).toBeVisible();
}
test('sign in, save client, refresh, sign out, and return to saved data',async({page})=>{
 const backend=await mockBackend(page);await page.goto('/');await login(page);
 await page.getByRole('button',{name:'Clientes',exact:true}).click();
 await page.getByRole('button',{name:'Nuevo Cliente',exact:true}).click();
 await page.getByPlaceholder('Ej: TKM Reina & Frank').fill('Cliente persistente de prueba');
 await page.getByRole('button',{name:'Guardar Cliente',exact:true}).click();
 await expect.poll(()=>[...backend.records.values()].some(row=>row.data.nombreComercial==='Cliente persistente de prueba')).toBe(true);
 await expect(page.getByText('Datos guardados',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Dashboard Ejecutivo y Ciclo de Leads'})).toBeVisible();
 await page.getByRole('button',{name:'Clientes',exact:true}).click();await expect(page.getByText('Cliente persistente de prueba',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Iniciar sesión',exact:true})).toBeVisible();
 await expect(page.getByText('Cliente persistente de prueba',{exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('heading',{name:'Iniciar sesión',exact:true})).toBeVisible();
 await login(page);await page.getByRole('button',{name:'Clientes',exact:true}).click();await expect(page.getByText('Cliente persistente de prueba',{exact:true})).toBeVisible();
 await expect.poll(()=>backend.commits()).toBe(1);
 const keys=await page.evaluate(()=>Object.keys(localStorage));expect(keys.filter(k=>k.startsWith('lom_'))).toEqual([]);
});
test('unapproved account is gated and cannot choose administrator',async({page})=>{
 await mockBackend(page,{approved:false});await page.goto('/');
 await page.getByLabel('Correo electrónico').fill('operator@lom-test.invalid');await page.getByLabel('Contraseña',{exact:true}).fill(randomUUID());await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Tu cuenta está creada'})).toBeVisible();await expect(page.getByRole('button',{name:'Clientes',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Iniciar sesión',exact:true})).toBeVisible();
});
test('signup asks for email confirmation and clears the password',async({page})=>{
 await mockBackend(page);await page.goto('/');await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
 await page.getByLabel('Nombre',{exact:true}).fill('Operador');await page.getByLabel('Correo electrónico').fill('new@lom-test.invalid');await page.getByLabel('Contraseña',{exact:true}).fill(randomUUID());await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
 await expect(page.getByText('Revisa tu correo y confirma tu cuenta. Después podrás iniciar sesión.')).toBeVisible();await expect(page.getByLabel('Contraseña',{exact:true})).toHaveValue('');
});
test('failed save is visible, retry saves once, and refreshed data is retained',async({page})=>{
 const backend=await mockBackend(page);await page.goto('/');await login(page);await page.getByRole('button',{name:'Clientes',exact:true}).click();await page.getByRole('button',{name:'Nuevo Cliente',exact:true}).click();await page.getByPlaceholder('Ej: TKM Reina & Frank').fill('Cliente tras reintento');backend.fail();await page.getByRole('button',{name:'Guardar Cliente',exact:true}).click();
 await expect(page.getByRole('button',{name:'Reintentar guardado',exact:true}).first()).toBeVisible();expect(backend.commits()).toBe(0);
 await page.getByRole('button',{name:'Reintentar guardado',exact:true}).last().click();await expect(page.getByText('Datos guardados',{exact:true})).toBeVisible();expect(backend.commits()).toBe(1);
 await page.reload();await expect(page.getByRole('heading',{name:'Dashboard Ejecutivo y Ciclo de Leads'})).toBeVisible();await page.getByRole('button',{name:'Clientes',exact:true}).click();await expect(page.getByText('Cliente tras reintento',{exact:true})).toBeVisible();
});
test('role selector includes only assigned roles',async({page})=>{
 await mockBackend(page,{roles:['conciliacion']});await page.goto('/');await login(page);
 await expect(page.locator('aside select option')).toHaveText(['Responsable de Conciliación']);await expect(page.getByRole('button',{name:'Configuración & Histórico',exact:true})).toHaveCount(0);
});
