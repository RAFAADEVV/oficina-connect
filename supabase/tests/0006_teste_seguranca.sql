-- =====================================================================
-- RevyAuto — Teste da migração 0006 (MFA, limite de oficinas, auditoria)
--
-- Confirma que:
--   • quem tem MFA ativo não vê nem altera dados sem confirmar o código (aal2);
--   • quem não tem MFA continua a trabalhar normalmente;
--   • não é possível criar mais de 5 oficinas por conta;
--   • as eliminações ficam registadas e só o Dono as vê.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 9 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  user_a  uuid := gen_random_uuid();  -- Dono da Oficina A (vai ativar MFA)
  user_b  uuid := gen_random_uuid();  -- Dono de outras oficinas (sem MFA)
  user_c  uuid := gen_random_uuid();  -- Funcionário da Oficina A (sem MFA)
  org_a   uuid;
  cust    uuid;
  n       integer;
  i       integer;
begin
  insert into auth.users (id, email, aud, role)
  values
    (user_a, 'teste-a-' || user_a || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (user_b, 'teste-b-' || user_b || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (user_c, 'teste-c-' || user_c || '@exemplo.invalid', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  org_a := public.create_organization('Oficina Teste A');
  insert into public.customers (organization_id, full_name, phone) values (org_a, 'Maria', '+351910000001') returning id into cust;
  reset role;
  insert into public.organization_members (organization_id, user_id, role) values (org_a, user_c, 'member');

  -- O Dono A ativa o MFA (fator TOTP confirmado)
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), user_a, 'teste', 'totp', 'verified', now(), now());

  -- 1. Com MFA ativo mas sem código (aal1): não vê nada
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select (select count(*) from public.customers) + (select count(*) from public.organizations) into n;
  if n <> 0 then raise exception '❌ Teste 1 falhou: sem confirmar o código, o utilizador vê % registos', n; end if;

  -- 2. …nem consegue criar dados
  begin
    insert into public.customers (organization_id, full_name, phone) values (org_a, 'X', '+351910000009');
    raise exception '❌ Teste 2 falhou: sem confirmar o código, foi possível criar um cliente';
  exception when insufficient_privilege then null;
  end;

  -- 3. …nem criar uma oficina
  begin
    perform public.create_organization('Oficina sem MFA');
    raise exception '❌ Teste 3 falhou: sem confirmar o código, foi possível criar uma oficina';
  exception when insufficient_privilege then null;
  end;

  -- 4. Com o código confirmado (aal2): acesso normal
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from public.customers where organization_id = org_a;
  if n <> 1 then raise exception '❌ Teste 4 falhou: com o código confirmado, o Dono não vê os clientes'; end if;

  -- 5. Funcionário sem MFA trabalha normalmente em aal1
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from public.customers where organization_id = org_a;
  if n <> 1 then raise exception '❌ Teste 5 falhou: um utilizador sem MFA deixou de ver os dados'; end if;

  -- 6. Limite de 5 oficinas por conta
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  for i in 1..5 loop
    perform public.create_organization('Oficina B ' || i);
  end loop;
  begin
    perform public.create_organization('Oficina B 6');
    raise exception '❌ Teste 6 falhou: foi possível criar uma 6.ª oficina';
  exception when invalid_parameter_value then null;
  end;

  -- 7. Apagar um cliente fica registado
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  delete from public.customers where id = cust;
  select count(*) into n from public.audit_events
  where organization_id = org_a and table_name = 'customers' and record_id = cust and actor_id = user_a;
  if n <> 1 then raise exception '❌ Teste 7 falhou: a eliminação do cliente não ficou registada'; end if;

  -- 8. O Funcionário não vê o registo, nem o consegue escrever
  perform set_config('request.jwt.claims', json_build_object('sub', user_c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from public.audit_events;
  if n <> 0 then raise exception '❌ Teste 8 falhou: um Funcionário vê o registo de auditoria'; end if;
  begin
    insert into public.audit_events (organization_id, action, table_name, record_id) values (org_a, 'delete', 'x', gen_random_uuid());
    raise exception '❌ Teste 8 falhou: um Funcionário escreveu no registo de auditoria';
  exception when insufficient_privilege then null;
  end;

  -- 9. Outra oficina não vê o registo
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from public.audit_events where organization_id = org_a;
  if n <> 0 then raise exception '❌ Teste 9 falhou: outra oficina vê o registo de auditoria'; end if;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where created_by in (user_a, user_b, user_c);
  delete from auth.mfa_factors where user_id in (user_a, user_b, user_c);
  delete from auth.users where id in (user_a, user_b, user_c);
end;
$$;

select '✅ Todos os 9 testes passaram' as resultado;
