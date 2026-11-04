-- =====================================================================
-- RevyAuto — Teste da migração 0008 (editar serviços)
--
-- Confirma que:
--   • um Funcionário corrige um serviço: dados, peças alteradas, novas e retiradas;
--   • as peças retiradas ficam no registo de eliminações, com o autor;
--   • outra oficina não consegue editar o serviço, nem "roubar" peças de outro serviço;
--   • com MFA ativo e sem código confirmado, não é possível editar;
--   • as regras de validação continuam a aplicar-se.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 7 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  owner_a uuid := gen_random_uuid();
  emp_a   uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  org_a   uuid;
  org_b   uuid;
  veh_a   uuid;
  veh_b   uuid;
  svc_a   uuid;
  svc_b   uuid;
  part1   uuid;
  part2   uuid;
  n       integer;
  t       text;
begin
  insert into auth.users (id, email, aud, role)
  values
    (owner_a, 'dono-a-' || owner_a || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (emp_a,   'func-a-' || emp_a   || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (owner_b, 'dono-b-' || owner_b || '@exemplo.invalid', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  org_a := public.create_organization('Oficina Edição A');
  insert into public.vehicles (organization_id, plate) values (org_a, 'AA00AA') returning id into veh_a;
  svc_a := public.create_service_record(veh_a,
    '{"service_date":"2026-10-01","service_type":"revisao","description":"Revisão","mileage":80000}',
    '[{"description":"Filtro de óleo","quantity":1},{"description":"Óleo 5W30","quantity":4}]');
  select id into part1 from public.service_parts where service_record_id = svc_a and position = 0;
  select id into part2 from public.service_parts where service_record_id = svc_a and position = 1;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  org_b := public.create_organization('Oficina Edição B');
  insert into public.vehicles (organization_id, plate) values (org_b, 'BB00BB') returning id into veh_b;
  svc_b := public.create_service_record(veh_b, '{"service_date":"2026-10-01","description":"Serviço B"}', '[]');

  reset role;
  insert into public.organization_members (organization_id, user_id, role) values (org_a, emp_a, 'member');
  perform set_config('role', 'authenticated', true);

  -- 1. O Funcionário corrige o serviço: muda km, altera a peça 1, retira a 2, acrescenta uma nova
  perform set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated')::text, true);
  perform public.update_service_record(svc_a,
    '{"service_date":"2026-10-02","service_type":"revisao","description":"Revisão anual","mileage":81000,"next_service_date":"2027-10-02","checklist":["Níveis"]}',
    json_build_array(
      json_build_object('id', part1, 'description', 'Filtro de óleo Mann', 'reference', 'W712', 'quantity', 1),
      json_build_object('description', 'Filtro de ar', 'quantity', 1)
    )::jsonb);
  select count(*) into n from public.service_records
   where id = svc_a and mileage = 81000 and description = 'Revisão anual'
     and next_service_date = '2027-10-02' and checklist = array['Níveis'];
  if n <> 1 then raise exception '❌ Teste 1 falhou: os dados do serviço não foram atualizados'; end if;

  -- 2. As peças ficaram certas e pela ordem certa (a peça 1 manteve o id)
  select string_agg(description || coalesce('/' || reference, ''), ', ' order by position) into t
    from public.service_parts where service_record_id = svc_a;
  if t is distinct from 'Filtro de óleo Mann/W712, Filtro de ar' then
    raise exception '❌ Teste 2 falhou: peças inesperadas (%)', t;
  end if;
  if not exists (select 1 from public.service_parts where id = part1 and position = 0) then
    raise exception '❌ Teste 2 falhou: a peça alterada perdeu o id';
  end if;

  -- 3. A peça retirada ficou no registo de eliminações, com o autor
  reset role;
  select count(*) into n from public.audit_events
   where organization_id = org_a and table_name = 'service_parts' and record_id = part2 and actor_id = emp_a;
  if n <> 1 then raise exception '❌ Teste 3 falhou: a peça retirada não ficou registada'; end if;
  perform set_config('role', 'authenticated', true);

  -- 4. Outra oficina não consegue editar o serviço
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  begin
    perform public.update_service_record(svc_a, '{"service_date":"2026-10-02","description":"Intruso"}', '[]');
    raise exception '❌ Teste 4 falhou: outra oficina editou o serviço';
  exception when insufficient_privilege then null;
  end;

  -- 5. …nem alterar uma peça de outro serviço indicando o id dela
  perform public.update_service_record(svc_b, '{"service_date":"2026-10-01","description":"Serviço B"}',
    json_build_array(json_build_object('id', part1, 'description', 'Roubada', 'quantity', 1))::jsonb);
  reset role;
  if not exists (select 1 from public.service_parts where id = part1 and service_record_id = svc_a and description = 'Filtro de óleo Mann') then
    raise exception '❌ Teste 5 falhou: a peça de outra oficina foi alterada';
  end if;
  if not exists (select 1 from public.service_parts where service_record_id = svc_b and description = 'Roubada' and id <> part1) then
    raise exception '❌ Teste 5 falhou: a peça devia ter sido criada como nova no serviço B';
  end if;
  perform set_config('role', 'authenticated', true);

  -- 6. Com MFA ativo e sem código confirmado, não edita
  reset role;
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), emp_a, 'teste', 'totp', 'verified', now(), now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.update_service_record(svc_a, '{"service_date":"2026-10-02","description":"Sem MFA"}', '[]');
    raise exception '❌ Teste 6 falhou: editou sem confirmar o código de dois passos';
  exception when insufficient_privilege then null;
  end;

  -- 7. As regras de validação continuam ativas (descrição vazia, peça sem nome)
  perform set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.update_service_record(svc_a, '{"service_date":"2026-10-02","description":"  "}', '[]');
    raise exception '❌ Teste 7 falhou: aceitou um serviço sem descrição';
  exception when check_violation then null;
  end;
  begin
    perform public.update_service_record(svc_a, '{"service_date":"2026-10-02","description":"Ok"}', '[{"description":"","quantity":1}]');
    raise exception '❌ Teste 7 falhou: aceitou uma peça sem nome';
  exception when check_violation then null;
  end;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where id in (org_a, org_b);
  delete from auth.mfa_factors where user_id in (owner_a, emp_a, owner_b);
  delete from auth.users where id in (owner_a, emp_a, owner_b);
end;
$$;

select '✅ Todos os 7 testes passaram' as resultado;
