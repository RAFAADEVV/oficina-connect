-- =====================================================================
-- Oficina Connect — Teste da migração 0005 (dados da oficina e registo técnico)
--
-- Confirma que:
--   • só o Dono altera os dados da oficina;
--   • um serviço de reparação é gravado com avaria, trabalho, lista e peças;
--   • se uma peça for inválida, nada fica gravado;
--   • as peças ficam isoladas por oficina;
--   • ninguém regista serviços em veículos de outra oficina.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 10 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  user_a   uuid := gen_random_uuid();  -- Dono da Oficina A
  user_b   uuid := gen_random_uuid();  -- Dono da Oficina B
  user_c   uuid := gen_random_uuid();  -- Funcionário da Oficina A
  org_a    uuid;
  org_b    uuid;
  cust     uuid;
  veh      uuid;
  svc      uuid;
  n        integer;
  t        text;
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

  -- 1. Dono altera os dados da oficina -----------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  update public.organizations
  set address = 'Rua das Oficinas, 1, Lisboa', phone = '+351210000000', email = 'geral@oficina.pt', nif = '123456789'
  where id = org_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ Teste 1 falhou: o Dono não conseguiu alterar os dados da oficina'; end if;

  -- 2. NIF inválido é recusado
  begin
    update public.organizations set nif = '12345' where id = org_a;
    raise exception '❌ Teste 2 falhou: foi aceite um NIF inválido';
  exception when check_violation then null;
  end;

  -- 3. Funcionário não altera os dados da oficina --------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated')::text, true);
  update public.organizations set phone = '+351219999999' where id = org_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 3 falhou: um Funcionário alterou os dados da oficina'; end if;

  -- 4. Funcionário regista uma reparação com peças --------------------------
  insert into public.customers (organization_id, full_name, phone) values (org_a, 'Maria', '+351910000001') returning id into cust;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, cust, 'AA00AA') returning id into veh;

  svc := public.create_service_record(
    veh,
    '{"service_date":"2026-11-03","service_type":"reparacao","description":"Travões da frente","mileage":85000,
      "problem":"Barulho ao travar","work_done":"Substituição de discos e pastilhas da frente",
      "checklist":["Líquido de travões"," "],"recommendations":"Pastilhas de trás a 30%"}',
    '[{"description":"Discos de travão","reference":"BRM-0921","quantity":2},
      {"description":"Pastilhas de travão","quantity":1}]'
  );

  select s.service_type || '|' || s.problem || '|' || array_to_string(s.checklist, ',') || '|' || s.mileage
    into t from public.service_records s where s.id = svc;
  if t <> 'reparacao|Barulho ao travar|Líquido de travões|85000' then
    raise exception '❌ Teste 4 falhou: serviço gravado como "%"', t; end if;

  select string_agg(p.description || ' x' || p.quantity::text || coalesce(' ' || p.reference, ''), ', ' order by p.position)
    into t from public.service_parts p where p.service_record_id = svc;
  if t <> 'Discos de travão x2.00 BRM-0921, Pastilhas de travão x1.00' then
    raise exception '❌ Teste 5 falhou: peças gravadas como "%"', t; end if;

  -- 6. Peça inválida → nada é gravado ------------------------------------
  select count(*) into n from public.service_records where vehicle_id = veh;
  begin
    perform public.create_service_record(veh, '{"service_date":"2026-11-03","description":"Teste"}', '[{"description":"","quantity":1}]');
    raise exception '❌ Teste 6 falhou: foi aceite uma peça sem descrição';
  exception when check_violation then null;
  end;
  if (select count(*) from public.service_records where vehicle_id = veh) <> n then
    raise exception '❌ Teste 6 falhou: o serviço ficou gravado sem as peças'; end if;

  -- 7. Funcionário não apaga peças ----------------------------------------
  delete from public.service_parts where service_record_id = svc;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 7 falhou: um Funcionário apagou peças'; end if;

  -- Oficina B --------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 8. Não vê as peças nem os dados da Oficina A
  select count(*) into n from public.service_parts;
  if n <> 0 then raise exception '❌ Teste 8 falhou: a Oficina B vê % peças da Oficina A', n; end if;

  -- 9. Não regista serviços nem peças em veículos da Oficina A
  begin
    perform public.create_service_record(veh, '{"service_date":"2026-11-03","description":"Intruso"}', '[]');
    raise exception '❌ Teste 9 falhou: a Oficina B registou um serviço num veículo da Oficina A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.service_parts (organization_id, service_record_id, description) values (org_b, svc, 'Peça intrusa');
    raise exception '❌ Teste 9 falhou: a Oficina B acrescentou uma peça a um serviço da Oficina A';
  exception when foreign_key_violation then null;
  end;

  -- 10. Visitante sem sessão ----------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform public.create_service_record(veh, '{"service_date":"2026-11-03","description":"X"}', '[]');
    raise exception '❌ Teste 10 falhou: um visitante sem sessão registou um serviço';
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
