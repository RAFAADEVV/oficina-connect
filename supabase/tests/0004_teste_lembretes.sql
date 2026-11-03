-- =====================================================================
-- Oficina Connect — Teste da migração 0004 (lembretes de revisão e contactos)
--
-- Confirma que:
--   • a próxima revisão é calculada pela ordem certa (combinada → km → hábito → padrão);
--   • cada cliente aparece na etapa certa (1 mês, 1 semana, atrasado);
--   • clientes que não querem contacto, ou que já agendaram, não aparecem;
--   • os contactos ficam isolados por oficina;
--   • o tipo de serviço é reconhecido na importação.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 14 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  user_a  uuid := gen_random_uuid();  -- Dono da Oficina A
  user_b  uuid := gen_random_uuid();  -- Dono da Oficina B
  user_c  uuid := gen_random_uuid();  -- Funcionário da Oficina A
  org_a   uuid;
  org_b   uuid;
  maria   uuid;
  joao    uuid;
  rui     uuid;
  v1      uuid;
  v2      uuid;
  v3      uuid;
  v4      uuid;
  v5      uuid;
  v6      uuid;
  v7      uuid;
  log_id  uuid;
  today   date := date '2026-06-01';
  n       integer;
  t       text;
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

  -- Funcionário da Oficina A cria os dados -------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated')::text, true);

  insert into public.customers (organization_id, full_name, phone) values (org_a, 'Maria', '+351910000001') returning id into maria;
  insert into public.customers (organization_id, full_name, phone) values (org_a, 'João', '+351910000002') returning id into joao;
  insert into public.customers (organization_id, full_name, phone, contact_opt_out) values (org_a, 'Rui', '+351910000003', true) returning id into rui;

  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, maria, 'AA00AA') returning id into v1;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, maria, 'BB00BB') returning id into v2;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, joao,  'CC00CC') returning id into v3;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, joao,  'DD00DD') returning id into v4;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, rui,   'EE00EE') returning id into v5;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, rui,   'FF00FF') returning id into v6;
  insert into public.vehicles (organization_id, customer_id, plate) values (org_a, maria, 'GG00GG') returning id into v7;

  insert into public.service_records (organization_id, vehicle_id, service_date, description, service_type, next_service_date, next_service_mileage, mileage)
  values
    -- V1: revisão combinada para 20/06/2026 → faltam 19 dias → "mes"
    (org_a, v1, '2025-06-15', 'Revisão', 'revisao', '2026-06-20', null, null),
    -- V2: sem data combinada, padrão 12 meses → 05/06/2026 → faltam 4 dias → "semana"
    (org_a, v2, '2025-06-05', 'Revisão', 'revisao', null, null, null),
    -- V3: duas revisões com 274 dias de intervalo → 31/12/2025 → "atrasado"
    (org_a, v3, '2024-07-01', 'Revisão', 'revisao', null, null, null),
    (org_a, v3, '2025-04-01', 'Óleo e filtros', 'oleo', null, null, null),
    -- V4: próxima revisão só em 2027 → não aparece
    (org_a, v4, '2026-03-01', 'Revisão', 'revisao', '2027-03-01', null, null),
    -- V5: cliente pediu para não ser contactado → não aparece
    (org_a, v5, '2025-06-10', 'Revisão', 'revisao', null, null, null),
    -- V6: só mudou pneus → não conta como revisão → não aparece
    (org_a, v6, '2025-06-01', 'Pneus', 'pneus', null, null, null),
    -- V7: combinado aos 75 000 km; faz ~55 km/dia → "combinado_km"
    (org_a, v7, '2025-01-01', 'Embraiagem', 'outro', null, null, 50000),
    (org_a, v7, '2025-07-01', 'Revisão', 'revisao', null, 75000, 60000);

  -- 1. Tipo de serviço adivinhado pela descrição
  select string_agg(private.guess_service_type(d), ',' order by o) into t
  from (values (1, 'Revisão anual'), (2, 'Mudança de óleo'), (3, 'Pneus novos'), (4, 'Pastilhas'), (5, 'Embraiagem')) x(o, d);
  if t <> 'revisao,oleo,pneus,travoes,outro' then raise exception '❌ Teste 1 falhou: tipos adivinhados "%"', t; end if;

  -- 2. Quantidade de lembretes
  select count(*) into n from public.get_service_reminders(org_a, today);
  if n <> 4 then raise exception '❌ Teste 2 falhou: esperados 4 lembretes (V1, V2, V3, V7), obtidos %', n; end if;

  -- 3 a 6. Etapa e origem de cada lembrete
  select stage || '/' || due_source || '/' || due_date into t from public.get_service_reminders(org_a, today) where vehicle_id = v1;
  if t <> 'mes/combinado/2026-06-20' then raise exception '❌ Teste 3 falhou: V1 = "%"', t; end if;
  select stage || '/' || due_source || '/' || due_date into t from public.get_service_reminders(org_a, today) where vehicle_id = v2;
  if t <> 'semana/padrao/2026-06-05' then raise exception '❌ Teste 4 falhou: V2 = "%"', t; end if;
  select stage || '/' || due_source || '/' || due_date into t from public.get_service_reminders(org_a, today) where vehicle_id = v3;
  if t <> 'atrasado/habito/2025-12-31' then raise exception '❌ Teste 5 falhou: V3 = "%"', t; end if;
  select stage || '/' || due_source into t from public.get_service_reminders(org_a, today) where vehicle_id = v7;
  if t <> 'atrasado/combinado_km' then raise exception '❌ Teste 6 falhou: V7 = "%"', t; end if;

  -- 7. A próxima revisão não pode ser antes do serviço
  begin
    insert into public.service_records (organization_id, vehicle_id, service_date, description, next_service_date)
    values (org_a, v4, '2026-03-02', 'Revisão', '2026-01-01');
    raise exception '❌ Teste 7 falhou: foi aceite uma próxima revisão anterior ao serviço';
  exception when check_violation then null;
  end;

  -- 8. Funcionário não altera o intervalo padrão da oficina
  update public.organizations set service_interval_months = 6 where id = org_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 8 falhou: um Funcionário alterou o intervalo padrão da oficina'; end if;

  -- 9. Contacto enviado fica associado ao lembrete; "agendado" tira-o da lista
  insert into public.contact_logs (organization_id, customer_id, vehicle_id, due_date, stage)
  values (org_a, maria, v1, '2026-06-20', 'mes') returning id into log_id;
  select contact_stage || '/' || contact_outcome into t from public.get_service_reminders(org_a, today) where vehicle_id = v1;
  if t is distinct from 'mes/enviado' then raise exception '❌ Teste 9 falhou: o contacto não ficou associado ao lembrete ("%")', t; end if;

  update public.contact_logs set outcome = 'agendado' where id = log_id;
  select count(*) into n from public.get_service_reminders(org_a, today) where vehicle_id = v1;
  if n <> 0 then raise exception '❌ Teste 10 falhou: um cliente que já agendou continua na lista'; end if;

  -- 11. Funcionário não apaga contactos
  delete from public.contact_logs where id = log_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ Teste 11 falhou: um Funcionário apagou um contacto'; end if;

  -- 12. Importação reconhece o tipo de serviço e guarda a próxima revisão
  perform public.import_records(org_a, '[
    {"full_name":"Ana","phone":"+351910000004","plate":"HH00HH","service_date":"2026-05-01",
     "service_description":"Mudança de óleo","next_service_date":"2027-05-01"},
    {"full_name":"Ana","phone":"+351910000004","plate":"HH00HH","service_date":"2026-05-02",
     "service_description":"Pneus","next_service_date":"2026-01-01"}
  ]');
  select string_agg(s.service_type || '/' || coalesce(s.next_service_date::text, '-'), ',' order by s.service_date) into t
  from public.service_records s join public.vehicles v on v.id = s.vehicle_id where v.plate = 'HH00HH';
  if t <> 'oleo/2027-05-01,pneus/-' then raise exception '❌ Teste 12 falhou: importação guardou "%"', t; end if;

  -- 13. Outra oficina não vê nem cria contactos da Oficina A
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  select (select count(*) from public.get_service_reminders(org_a, today)) + (select count(*) from public.contact_logs) into n;
  if n <> 0 then raise exception '❌ Teste 13 falhou: a Oficina B vê % lembretes/contactos da Oficina A', n; end if;
  begin
    insert into public.contact_logs (organization_id, customer_id, vehicle_id, due_date, stage)
    values (org_b, maria, v1, '2026-06-20', 'mes');
    raise exception '❌ Teste 13 falhou: a Oficina B registou um contacto de um cliente da Oficina A';
  exception when foreign_key_violation then null;
  end;

  -- 14. Visitante sem sessão
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform public.get_service_reminders(org_a, today);
    raise exception '❌ Teste 14 falhou: um visitante sem sessão consultou lembretes';
  exception when insufficient_privilege then null;
  end;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where id in (org_a, org_b);
  delete from auth.users where id in (user_a, user_b, user_c);
end;
$$;

select '✅ Todos os 14 testes passaram' as resultado;
