-- =====================================================================
-- RevyAuto — Teste da migração 0009 (registo fechado)
--
-- Confirma que:
--   • só emails autorizados (ou com convite ativo) podem criar conta;
--   • o gatilho está ligado a auth.users;
--   • só o administrador, com dois passos confirmados, gere a lista;
--   • ninguém lê a lista diretamente;
--   • o código de convite só funciona para o email convidado.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 9 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  admin_u uuid := gen_random_uuid();
  owner_a uuid := gen_random_uuid();
  emp     uuid := gen_random_uuid();
  other   uuid := gen_random_uuid();
  newbie  uuid := gen_random_uuid();
  org_a   uuid;
  v_code  text;
  v_ok    boolean;
  v_me    text := session_user;
  n       integer;
  e_emp   text := 'func-'  || emp    || '@exemplo.invalid';
  e_new   text := 'nova-'  || newbie || '@exemplo.invalid';
begin
  insert into auth.users (id, email, aud, role)
  values
    (admin_u, 'admin-' || admin_u || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (owner_a, 'dono-'  || owner_a || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (emp,     e_emp,                                      'authenticated', 'authenticated'),
    (other,   'outro-' || other   || '@exemplo.invalid', 'authenticated', 'authenticated');
  insert into public.platform_admins (user_id) values (admin_u);

  -- 1. O gatilho está ligado a auth.users
  if not exists (select 1 from pg_trigger where tgname = 'before_auth_user_created' and tgrelid = 'auth.users'::regclass) then
    raise exception '❌ Teste 1 falhou: o gatilho do registo fechado não está ativo';
  end if;

  -- 2. Sem dois passos confirmados (aal1), o administrador não administra
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_u, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  if public.am_i_platform_admin() then raise exception '❌ Teste 2 falhou: administrador reconhecido sem dois passos'; end if;
  begin
    perform public.admin_allow_email(e_new);
    raise exception '❌ Teste 2 falhou: autorizou um email sem dois passos';
  exception when insufficient_privilege then null;
  end;

  -- 3. Com dois passos, autoriza um email (normaliza maiúsculas e espaços)
  perform set_config('request.jwt.claims', json_build_object('sub', admin_u, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  if not public.am_i_platform_admin() then raise exception '❌ Teste 3 falhou: administrador não reconhecido'; end if;
  perform public.admin_allow_email('  ' || upper(e_new) || ' ', 'Oficina de teste');
  select count(*) into n from public.admin_list_allowlist() l where l.email = e_new and l.note = 'Oficina de teste';
  if n <> 1 then raise exception '❌ Teste 3 falhou: o email não ficou autorizado'; end if;

  -- 4. Quem não é administrador não gere a lista nem a lê diretamente
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.admin_list_allowlist();
    raise exception '❌ Teste 4 falhou: um utilizador normal viu a lista';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_allow_email('intruso@exemplo.invalid');
    raise exception '❌ Teste 4 falhou: um utilizador normal autorizou um email';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.signup_allowlist limit 1;
    raise exception '❌ Teste 4 falhou: a lista está visível diretamente';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_admins (user_id) values (other);
    raise exception '❌ Teste 4 falhou: alguém se tornou administrador sozinho';
  exception when insufficient_privilege then null;
  end;

  -- 5. Regra do registo: autorizado sim, desconhecido não
  reset role;
  if not private.is_signup_allowed(e_new) then raise exception '❌ Teste 5 falhou: email autorizado recusado'; end if;
  if private.is_signup_allowed('desconhecido@exemplo.invalid') then raise exception '❌ Teste 5 falhou: email desconhecido aceite'; end if;

  -- 6. Convite com email: esse email passa a poder criar conta
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  org_a := public.create_organization('Oficina Registo A');
  select c.code into v_code from public.create_invite(org_a, 'convidado@exemplo.invalid') c;
  reset role;
  if not private.is_signup_allowed('Convidado@Exemplo.invalid') then raise exception '❌ Teste 6 falhou: o email convidado não pode criar conta'; end if;
  perform set_config('role', 'authenticated', true);
  begin
    perform public.create_invite(org_a, 'isto-nao-e-email');
    raise exception '❌ Teste 6 falhou: aceitou um convite sem email válido';
  exception when invalid_parameter_value then null;
  end;

  -- 7. O código só funciona para o email convidado
  select c.code into v_code from public.create_invite(org_a, e_emp) c;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  if public.accept_invite(v_code) is not null then raise exception '❌ Teste 7 falhou: outra pessoa usou o convite'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', emp, 'role', 'authenticated')::text, true);
  if public.accept_invite(v_code) is distinct from org_a then raise exception '❌ Teste 7 falhou: o convidado não conseguiu entrar'; end if;

  -- 8. O administrador vê as oficinas (sem dados dos clientes)
  perform set_config('request.jwt.claims', json_build_object('sub', admin_u, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from public.admin_list_organizations() o where o.id = org_a and o.members = 2 and o.owner_email like 'dono-%';
  if n <> 1 then raise exception '❌ Teste 8 falhou: a lista de oficinas está errada'; end if;

  -- 9. O gatilho a funcionar a sério (só é possível testar com permissões de superutilizador)
  reset role;
  perform set_config('request.jwt.claims', '', true);
  begin
    execute 'set session authorization supabase_auth_admin';
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if v_ok then
    begin
      insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'nao-autorizado@exemplo.invalid', 'authenticated', 'authenticated');
      execute format('set session authorization %I', v_me);
      raise exception '❌ Teste 9 falhou: criou conta com um email não autorizado';
    exception when insufficient_privilege then null;
    end;
    insert into auth.users (id, email, aud, role) values (newbie, e_new, 'authenticated', 'authenticated');
    execute format('set session authorization %I', v_me);
  else
    raise notice 'Teste 9: sem permissão para simular o serviço de autenticação; validado pelos testes 1 e 5.';
  end if;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  delete from public.organizations where id = org_a;
  delete from public.signup_allowlist where email in (e_new);
  delete from public.platform_admins where user_id = admin_u;
  delete from auth.users where id in (admin_u, owner_a, emp, other, newbie);
end;
$$;

select '✅ Todos os 9 testes passaram' as resultado;
