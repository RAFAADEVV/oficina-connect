-- =====================================================================
-- Oficina Connect — Teste da migração 0003 (importação)
--
-- Confirma que:
--   • a importação cria clientes, veículos e serviços corretamente;
--   • não duplica clientes (mesmo telefone), veículos (mesma matrícula) nem serviços;
--   • importar o mesmo ficheiro duas vezes não cria nada de novo;
--   • ninguém consegue importar para outra oficina;
--   • o registo de importações fica isolado por oficina.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 10 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  user_a  uuid := gen_random_uuid();  -- Dono da Oficina A
  user_b  uuid := gen_random_uuid();  -- Dono da Oficina B
  user_c  uuid := gen_random_uuid();  -- Funcionário da Oficina A
  org_a   uuid;
  org_b   uuid;
  res     jsonb;
  n       integer;
  rows    jsonb := '[
    {"full_name":"Maria Santos","phone":"+351912345678","plate":"AA-00-BB","make":"Renault","model":"Clio","year":2015,"mileage":85000,
     "service_date":"2026-03-10","service_description":"Revisão","service_mileage":85000},
    {"full_name":"Maria Santos","phone":"+351912345678","plate":"CC-11-DD","make":"Fiat",
     "service_date":"2025-11-02","service_description":"Pneus"},
    {"full_name":"Maria Santos","phone":"+351912345678","plate":"AA00BB",
     "service_date":"2026-03-10","service_description":"revisão "},
    {"full_name":"João Costa","phone":"+351933333333"}
  ]';
begin
  -- Preparação --------------------------------------------------------
  insert into auth.users (id, email, aud, role)
  values
    (user_a, 'teste-a-' || user_a || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (user_b, 'teste-b-' || user_b || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (user_c, 'teste-c-' || user_c || '@exemplo.invalid', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  org_a := public.create_organization('Oficina Teste A');
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  org_b := public.create_organization('Oficina Teste B');
  reset role;
  insert into public.organization_members (organization_id, user_id, role) values (org_a, user_c, 'member');

  -- Funcionário da Oficina A importa ------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated')::text, true);
  res := public.import_records(org_a, rows);

  if (res ->> 'customers_created')::int <> 2 then
    raise exception '❌ Teste 1 falhou: esperados 2 clientes criados, obtido %', res; end if;
  if (res ->> 'vehicles_created')::int <> 2 then
    raise exception '❌ Teste 2 falhou: esperados 2 veículos criados (matrícula repetida reutilizada), obtido %', res; end if;
  if (res ->> 'services_created')::int <> 2 or (res ->> 'services_skipped')::int <> 1 then
    raise exception '❌ Teste 3 falhou: esperados 2 serviços criados e 1 repetido ignorado, obtido %', res; end if;

  select count(*) into n from public.vehicles v
  join public.customers c on c.id = v.customer_id
  where v.organization_id = org_a and c.phone = '+351912345678';
  if n <> 2 then raise exception '❌ Teste 4 falhou: os 2 veículos não ficaram ligados à cliente Maria'; end if;

  -- Importar o mesmo ficheiro outra vez não cria nada --------------------
  res := public.import_records(org_a, rows);
  if (res ->> 'customers_created')::int + (res ->> 'vehicles_created')::int + (res ->> 'services_created')::int <> 0 then
    raise exception '❌ Teste 5 falhou: a segunda importação criou registos duplicados: %', res; end if;
  if (res ->> 'customers_reused')::int <> 2 or (res ->> 'vehicles_reused')::int <> 2 then
    raise exception '❌ Teste 6 falhou: a segunda importação não reutilizou os registos existentes: %', res; end if;

  insert into public.imports (organization_id, file_name, rows_total) values (org_a, 'clientes.xlsx', 4);

  -- Dono da Oficina B tenta importar para a Oficina A ----------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  begin
    perform public.import_records(org_a, rows);
    raise exception '❌ Teste 7 falhou: a Oficina B importou dados para a Oficina A';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from public.imports where organization_id = org_a;
  if n <> 0 then raise exception '❌ Teste 8 falhou: a Oficina B vê o histórico de importações da Oficina A'; end if;

  -- Lote demasiado grande ----------------------------------------------
  begin
    perform public.import_records(org_b, (select jsonb_agg(jsonb_build_object('full_name','X','phone','+3519' || lpad(g::text, 8, '0'))) from generate_series(1, 1001) g));
    raise exception '❌ Teste 9 falhou: foi aceite um lote com mais de 1000 linhas';
  exception when invalid_parameter_value then null;
  end;

  -- Visitante sem sessão --------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform public.import_records(org_a, rows);
    raise exception '❌ Teste 10 falhou: um visitante sem sessão conseguiu importar';
  exception when insufficient_privilege then null;
  end;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where id in (org_a, org_b);
  delete from auth.users where id in (user_a, user_b, user_c);
end;
$$;

select '✅ Todos os 10 testes passaram' as resultado;
