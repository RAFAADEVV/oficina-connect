-- =====================================================================
-- Oficina Connect — Teste de segurança da migração 0002
--
-- Simula duas oficinas (A e B) e confirma que:
--   • uma oficina não vê, altera, apaga nem liga dados de outra;
--   • o Funcionário vê, cria e edita, mas não apaga;
--   • matrículas e telefones são normalizados e validados;
--   • ninguém consegue mudar um registo de oficina;
--   • visitantes sem sessão não têm acesso.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 16 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  user_a  uuid := gen_random_uuid();  -- Dono da Oficina A
  user_b  uuid := gen_random_uuid();  -- Dono da Oficina B
  user_c  uuid := gen_random_uuid();  -- Funcionário da Oficina A
  org_a   uuid;
  org_b   uuid;
  cust_a  uuid;
  cust_c  uuid;
  veh_a   uuid;
  n       integer;
  t       text;
  ts      timestamptz;
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

  -- Dono A cria dados na Oficina A --------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  insert into public.customers (organization_id, full_name, phone)
  values (org_a, '  Maria   Santos ', '912 345-678') returning id into cust_a;
  insert into public.vehicles (organization_id, customer_id, plate, make)
  values (org_a, cust_a, 'aa-00 bb', ' Renault ') returning id into veh_a;
  insert into public.service_records (organization_id, vehicle_id, service_date, description, mileage)
  values (org_a, veh_a, date '2026-03-10', 'Revisão anual', 85000);

  -- 1. Normalização
  select plate into t from public.vehicles where id = veh_a;
  if t <> 'AA00BB' then raise exception '❌ Teste 1 falhou: matrícula ficou "%" (esperado AA00BB)', t; end if;
  select phone || '|' || full_name into t from public.customers where id = cust_a;
  if t <> '912345678|Maria Santos' then raise exception '❌ Teste 2 falhou: cliente normalizado como "%"', t; end if;

  -- 3. Não pode criar dados noutra oficina
  begin
    insert into public.customers (organization_id, full_name, phone) values (org_b, 'Intruso', '911111111');
    raise exception '❌ Teste 3 falhou: o utilizador A criou um cliente na Oficina B';
  exception when insufficient_privilege then null;
  end;

  -- 4. Não pode mudar um registo de oficina nem os campos automáticos
  begin
    update public.customers set organization_id = org_b where id = cust_a;
    raise exception '❌ Teste 4 falhou: foi possível mudar um cliente de oficina';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.customers set created_by = user_b where id = cust_a;
    raise exception '❌ Teste 4 falhou: foi possível alterar o autor (created_by) de um cliente';
  exception when insufficient_privilege then null;
  end;

  -- 5. Não pode preencher campos automáticos
  begin
    insert into public.customers (organization_id, full_name, phone, created_by) values (org_a, 'X', '911111111', user_b);
    raise exception '❌ Teste 5 falhou: foi possível falsificar o autor (created_by)';
  exception when insufficient_privilege then null;
  end;

  -- 6. Matrícula repetida na mesma oficina
  begin
    insert into public.vehicles (organization_id, plate) values (org_a, 'AA-00-BB');
    raise exception '❌ Teste 6 falhou: foi aceite uma matrícula repetida';
  exception when unique_violation then null;
  end;

  -- 7. Telefone inválido
  begin
    insert into public.customers (organization_id, full_name, phone) values (org_a, 'Telefone mau', 'abc');
    raise exception '❌ Teste 7 falhou: foi aceite um telefone inválido';
  exception when check_violation then null;
  end;

  -- Testes como Dono da Oficina B ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  select (select count(*) from public.customers where organization_id = org_a)
       + (select count(*) from public.vehicles where organization_id = org_a)
       + (select count(*) from public.service_records where organization_id = org_a)
    into n;
  if n <> 0 then raise exception '❌ Teste 8 falhou: a Oficina B vê % registos da Oficina A', n; end if;

  update public.customers set full_name = 'Alterado por B' where id = cust_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 9 falhou: a Oficina B alterou um cliente da Oficina A'; end if;

  delete from public.vehicles where id = veh_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 10 falhou: a Oficina B apagou um veículo da Oficina A'; end if;

  begin
    insert into public.vehicles (organization_id, customer_id, plate) values (org_b, cust_a, 'ZZ99ZZ');
    raise exception '❌ Teste 11 falhou: a Oficina B ligou um veículo a um cliente da Oficina A';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.service_records (organization_id, vehicle_id, service_date, description)
    values (org_b, veh_a, current_date, 'Serviço intruso');
    raise exception '❌ Teste 12 falhou: a Oficina B registou um serviço num veículo da Oficina A';
  exception when foreign_key_violation then null;
  end;

  -- Testes como Funcionário da Oficina A ---------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated')::text, true);

  insert into public.customers (organization_id, full_name, phone) values (org_a, 'Cliente do Funcionário', '+351933333333')
    returning id into cust_c;
  update public.customers set notes = 'Prefere contacto à tarde' where id = cust_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ Teste 13 falhou: o Funcionário não conseguiu editar um cliente'; end if;

  delete from public.customers where id = cust_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 14 falhou: o Funcionário conseguiu apagar um cliente'; end if;

  -- Dono A: oposição a contactos e apagar ---------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  update public.customers set contact_opt_out = true where id = cust_c;
  select contact_opt_out_at into ts from public.customers where id = cust_c;
  if ts is null then raise exception '❌ Teste 15 falhou: a data do pedido de não contacto não foi registada'; end if;

  -- Apagar o cliente deixa o veículo sem dono, mas não o apaga
  delete from public.customers where id = cust_a;
  select count(*) into n from public.vehicles where id = veh_a and customer_id is null;
  if n <> 1 then raise exception '❌ Teste 16 falhou: apagar o cliente não deixou o veículo sem dono como esperado'; end if;

  -- Visitante sem sessão
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    select count(*) into n from public.customers;
    raise exception '❌ Teste extra falhou: um visitante sem sessão consegue consultar clientes';
  exception when insufficient_privilege then null;
  end;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where id in (org_a, org_b);
  delete from auth.users where id in (user_a, user_b, user_c);
end;
$$;

select '✅ Todos os 16 testes passaram' as resultado;
