-- =====================================================================
-- Oficina Connect — Teste de segurança da migração 0001
--
-- Simula três utilizadores e duas oficinas e confirma que:
--   • cada utilizador só vê a sua oficina;
--   • ninguém consegue alterar, ver ou entrar noutra oficina;
--   • um Funcionário não consegue alterar os dados da oficina;
--   • visitantes sem sessão não têm acesso nenhum.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: uma linha "✅ Todos os 13 testes passaram".
-- Se algum teste falhar, aparece um erro a dizer qual foi.
--
-- Os dados de teste são apagados no fim — não fica nada na base de dados.
-- =====================================================================

do $$
declare
  user_a  uuid := gen_random_uuid();  -- Dono da Oficina A
  user_b  uuid := gen_random_uuid();  -- Dono da Oficina B
  user_c  uuid := gen_random_uuid();  -- Funcionário da Oficina A
  org_a   uuid;
  org_b   uuid;
  n       integer;
begin
  -- Preparação (como administrador) ------------------------------------
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values
    (user_a, 'teste-a-' || user_a || '@exemplo.invalid', 'authenticated', 'authenticated', '{"full_name":"Teste A"}'),
    (user_b, 'teste-b-' || user_b || '@exemplo.invalid', 'authenticated', 'authenticated', '{"full_name":"Teste B"}'),
    (user_c, 'teste-c-' || user_c || '@exemplo.invalid', 'authenticated', 'authenticated', '{"full_name":"Teste C"}');

  select count(*) into n from public.profiles where id in (user_a, user_b, user_c);
  if n <> 3 then raise exception '❌ Teste 1 falhou: os perfis não foram criados automaticamente'; end if;

  -- Utilizador A cria a Oficina A ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  org_a := public.create_organization('Oficina Teste A');

  -- Utilizador B cria a Oficina B ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  org_b := public.create_organization('Oficina Teste B');

  -- Testes como Utilizador A -------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.organizations where id in (org_a, org_b);
  if n <> 1 then raise exception '❌ Teste 2 falhou: o utilizador A vê % oficinas (esperado: 1)', n; end if;

  select count(*) into n from public.organizations where id = org_b;
  if n <> 0 then raise exception '❌ Teste 3 falhou: o utilizador A consegue ver a Oficina B'; end if;

  update public.organizations set name = 'Alterado por A' where id = org_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 4 falhou: o utilizador A conseguiu alterar a Oficina B'; end if;

  select count(*) into n from public.organization_members where organization_id = org_b;
  if n <> 0 then raise exception '❌ Teste 5 falhou: o utilizador A vê os membros da Oficina B'; end if;

  select count(*) into n from public.profiles where id = user_b;
  if n <> 0 then raise exception '❌ Teste 6 falhou: o utilizador A vê o perfil do utilizador B'; end if;

  begin
    insert into public.organization_members (organization_id, user_id, role) values (org_b, user_a, 'owner');
    raise exception '❌ Teste 7 falhou: o utilizador A conseguiu entrar na Oficina B';
  exception when insufficient_privilege then null;  -- bloqueado, como esperado
  end;

  begin
    insert into public.organizations (name) values ('Oficina criada diretamente');
    raise exception '❌ Teste 8 falhou: foi possível criar uma oficina sem passar pela função segura';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.organizations where id = org_b;
    raise exception '❌ Teste 9 falhou: o utilizador A conseguiu apagar a Oficina B';
  exception when insufficient_privilege then null;
  end;

  update public.organizations set name = 'Oficina Teste A (renomeada)' where id = org_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ Teste 10 falhou: o Dono não conseguiu alterar a sua própria oficina'; end if;

  begin
    perform public.create_organization(' ');
    raise exception '❌ Teste 11 falhou: foi aceite uma oficina sem nome';
  exception when invalid_parameter_value then null;
  end;

  -- Utilizador C passa a Funcionário da Oficina A (como administrador) ----
  reset role;
  insert into public.organization_members (organization_id, user_id, role) values (org_a, user_c, 'member');

  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  update public.organizations set name = 'Alterado pelo funcionário' where id = org_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 12 falhou: um Funcionário conseguiu alterar os dados da oficina'; end if;

  -- Visitante sem sessão ------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    select count(*) into n from public.organizations;
    raise exception '❌ Teste 13 falhou: um visitante sem sessão consegue consultar oficinas';
  exception when insufficient_privilege then null;
  end;

  -- Limpeza (como administrador) ----------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where id in (org_a, org_b);
  delete from auth.users where id in (user_a, user_b, user_c);
end;
$$;

select '✅ Todos os 13 testes passaram' as resultado;
