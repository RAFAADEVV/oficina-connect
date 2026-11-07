-- =====================================================================
-- RevyAuto — Teste da migração 0007 (convites e equipa)
--
-- Confirma que:
--   • só o Dono cria convites, e o código funciona uma única vez;
--   • quem usa o código entra como Funcionário e passa a ver os dados da oficina;
--   • códigos errados, expirados ou cancelados não funcionam;
--   • há limite de tentativas (contra adivinhação);
--   • o resumo do código nunca é visível, nem para o Dono;
--   • só o Dono remove pessoas, e o Dono não pode ser removido nem sair;
--   • outra oficina não vê a equipa nem os convites.
--
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Resultado esperado: "✅ Todos os 12 testes passaram".
-- Os dados de teste são apagados no fim.
-- =====================================================================

do $$
declare
  owner_a uuid := gen_random_uuid();  -- Dono da Oficina A
  emp     uuid := gen_random_uuid();  -- Futuro Funcionário da Oficina A
  owner_b uuid := gen_random_uuid();  -- Dono da Oficina B
  guesser uuid := gen_random_uuid();  -- Alguém a tentar adivinhar códigos
  org_a   uuid;
  org_b   uuid;
  v_code  text;
  v_code2 text;
  v_res   uuid;
  v_inv   uuid;
  n       integer;
  i       integer;
begin
  insert into auth.users (id, email, aud, role)
  values
    (owner_a, 'dono-a-' || owner_a || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (emp,     'func-'   || emp     || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (owner_b, 'dono-b-' || owner_b || '@exemplo.invalid', 'authenticated', 'authenticated'),
    (guesser, 'adiv-'   || guesser || '@exemplo.invalid', 'authenticated', 'authenticated');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  org_a := public.create_organization('Oficina Convites A');
  insert into public.customers (organization_id, full_name, phone) values (org_a, 'Cliente A', '+351910000101');
  select c.code into v_code from public.create_invite(org_a, 'func-' || emp || '@exemplo.invalid') c;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  org_b := public.create_organization('Oficina Convites B');

  -- 1. O código tem o formato XXXX-XXXX-XXXX
  if v_code !~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$' then
    raise exception '❌ Teste 1 falhou: formato do código inesperado (%)', v_code;
  end if;

  -- 2. Outra oficina não consegue criar convites para a Oficina A
  begin
    perform public.create_invite(org_a, 'x@exemplo.invalid');
    raise exception '❌ Teste 2 falhou: o Dono de outra oficina criou um convite para a Oficina A';
  exception when insufficient_privilege then null;
  end;

  -- 3. Antes de aceitar, o futuro Funcionário não vê nada
  perform set_config('request.jwt.claims', json_build_object('sub', emp, 'role', 'authenticated')::text, true);
  select count(*) into n from public.customers;
  if n <> 0 then raise exception '❌ Teste 3 falhou: sem convite, vê % clientes', n; end if;

  -- 4. Código errado devolve NULL e não dá acesso
  v_res := public.accept_invite('AAAA-BBBB-CCCC');
  if v_res is not null then raise exception '❌ Teste 4 falhou: um código inventado foi aceite'; end if;

  -- 5. Código certo (mesmo escrito em minúsculas e sem traços) dá acesso como Funcionário
  v_res := public.accept_invite(lower(replace(v_code, '-', ' ')));
  if v_res is distinct from org_a then raise exception '❌ Teste 5 falhou: o código válido não foi aceite'; end if;
  select count(*) into n from public.organization_members
   where organization_id = org_a and user_id = emp and role = 'member';
  if n <> 1 then raise exception '❌ Teste 5 falhou: não ficou como Funcionário'; end if;
  select count(*) into n from public.customers where organization_id = org_a;
  if n <> 1 then raise exception '❌ Teste 5 falhou: o Funcionário não vê os clientes da oficina'; end if;

  -- 6. O mesmo código não pode ser usado outra vez
  perform set_config('request.jwt.claims', json_build_object('sub', guesser, 'role', 'authenticated')::text, true);
  v_res := public.accept_invite(v_code);
  if v_res is not null then raise exception '❌ Teste 6 falhou: um código já usado funcionou outra vez'; end if;

  -- 7. Um Funcionário não cria convites
  perform set_config('request.jwt.claims', json_build_object('sub', emp, 'role', 'authenticated')::text, true);
  begin
    perform public.create_invite(org_a, 'y@exemplo.invalid');
    raise exception '❌ Teste 7 falhou: um Funcionário criou um convite';
  exception when insufficient_privilege then null;
  end;

  -- 8. Convites cancelados e expirados não funcionam
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  select c.code into v_code2 from public.create_invite(org_a, 'adiv-' || guesser || '@exemplo.invalid') c;
  select id into v_inv from public.organization_invites where organization_id = org_a and used_at is null;
  perform public.revoke_invite(v_inv);
  select c.code into v_code from public.create_invite(org_a, 'adiv-' || guesser || '@exemplo.invalid') c;
  reset role;
  update public.organization_invites set expires_at = now() - interval '1 minute'
   where organization_id = org_a and used_at is null and revoked_at is null;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', guesser, 'role', 'authenticated')::text, true);
  if public.accept_invite(v_code2) is not null then raise exception '❌ Teste 8 falhou: um convite cancelado funcionou'; end if;
  if public.accept_invite(v_code) is not null then raise exception '❌ Teste 8 falhou: um convite expirado funcionou'; end if;

  -- 9. Limite de tentativas: ao fim de 10 numa hora, bloqueia
  begin
    for i in 1..10 loop
      perform public.accept_invite('ZZZZ-ZZZZ-ZZZZ');
    end loop;
    raise exception '❌ Teste 9 falhou: não houve limite de tentativas';
  exception when invalid_parameter_value then null;
  end;

  -- 10. Ninguém vê o resumo do código, nem o Dono; ninguém escreve diretamente
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  begin
    perform code_hash from public.organization_invites limit 1;
    raise exception '❌ Teste 10 falhou: o resumo do código está visível';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.organization_invites (organization_id, code_hash, expires_at) values (org_a, '\x00', now() + interval '1 day');
    raise exception '❌ Teste 10 falhou: foi possível criar um convite diretamente na tabela';
  exception when insufficient_privilege then null;
  end;

  -- 11. Equipa: outra oficina não a vê; o Funcionário não remove ninguém; o Dono não pode ser removido nem sair
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  begin
    perform public.list_team(org_a);
    raise exception '❌ Teste 11 falhou: outra oficina viu a equipa';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.organization_invites where organization_id = org_a;
  if n <> 0 then raise exception '❌ Teste 11 falhou: outra oficina vê os convites'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', emp, 'role', 'authenticated')::text, true);
  select count(*) into n from public.list_team(org_a);
  if n <> 2 then raise exception '❌ Teste 11 falhou: a equipa devia ter 2 pessoas e tem %', n; end if;
  begin
    perform public.remove_member(org_a, owner_a);
    raise exception '❌ Teste 11 falhou: um Funcionário removeu o Dono';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  begin
    perform public.remove_member(org_a, owner_a);
    raise exception '❌ Teste 11 falhou: o Dono foi removido';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.leave_organization(org_a);
    raise exception '❌ Teste 11 falhou: o Dono saiu da oficina';
  exception when invalid_parameter_value then null;
  end;

  -- 12. O Dono remove o Funcionário, que deixa de ver os dados
  perform public.remove_member(org_a, emp);
  perform set_config('request.jwt.claims', json_build_object('sub', emp, 'role', 'authenticated')::text, true);
  select count(*) into n from public.customers;
  if n <> 0 then raise exception '❌ Teste 12 falhou: depois de removido, o Funcionário ainda vê % clientes', n; end if;

  -- Limpeza ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.organizations where id in (org_a, org_b);
  delete from auth.users where id in (owner_a, emp, owner_b, guesser);
end;
$$;

select '✅ Todos os 12 testes passaram' as resultado;
