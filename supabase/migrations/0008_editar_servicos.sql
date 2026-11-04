-- =====================================================================
-- RevyAuto — Migração 0008: editar serviços já registados
--
-- Cria:
--   • update_service_record(...): altera o serviço e as peças de uma só vez.
--
-- Regras:
--   • Qualquer pessoa da oficina (Dono ou Funcionário) pode corrigir um serviço,
--     tal como já podia alterar os dados principais.
--   • As peças são atualizadas pela ordem recebida: as que trazem "id" são
--     alteradas, as novas são acrescentadas e as que deixaram de vir são apagadas.
--   • Cada peça apagada fica no registo de eliminações (quem e quando),
--     pelo gatilho da migração 0006.
--   • Não é possível mudar o serviço de veículo nem de oficina.
--
-- Porquê "security definer": um Funcionário não pode apagar peças diretamente
-- (só o Dono). Aqui pode retirar peças de um serviço ao corrigi-lo, e a função
-- verifica ela própria que a pessoa pertence à oficina do serviço.
--
-- Requer: migrações 0001 a 0007.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run.
-- =====================================================================

create function public.update_service_record(p_service_id uuid, p_service jsonb, p_parts jsonb default '[]')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id    uuid;
  v_checklist text[];
  v_keep      uuid[];
begin
  if (select auth.uid()) is null or not private.mfa_ok() then
    raise exception 'É necessário ter sessão iniciada.' using errcode = '42501';
  end if;

  select s.organization_id into v_org_id from public.service_records s where s.id = p_service_id;
  if v_org_id is null or not private.is_org_member(v_org_id) then
    raise exception 'Serviço não encontrado.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_parts, '[]')) <> 'array' or jsonb_array_length(coalesce(p_parts, '[]')) > 50 then
    raise exception 'Lista de peças inválida (máximo 50).' using errcode = '22023';
  end if;

  select coalesce(array_agg(left(btrim(x), 60)), '{}')
    into v_checklist
  from jsonb_array_elements_text(coalesce(p_service -> 'checklist', '[]')) as x
  where btrim(x) <> '';

  update public.service_records set
    service_date         = (p_service ->> 'service_date')::date,
    service_type         = coalesce(p_service ->> 'service_type', 'outro'),
    description          = p_service ->> 'description',
    mileage              = (p_service ->> 'mileage')::integer,
    next_service_date    = (p_service ->> 'next_service_date')::date,
    next_service_mileage = (p_service ->> 'next_service_mileage')::integer,
    problem              = nullif(btrim(p_service ->> 'problem'), ''),
    work_done            = nullif(btrim(p_service ->> 'work_done'), ''),
    checklist            = v_checklist,
    recommendations      = nullif(btrim(p_service ->> 'recommendations'), '')
  where id = p_service_id;

  -- Peças que continuam (só conta um "id" que já pertence a este serviço)
  select coalesce(array_agg(sp.id), '{}')
    into v_keep
  from jsonb_array_elements(coalesce(p_parts, '[]')) as p(value)
  join public.service_parts sp
    on sp.id = (p.value ->> 'id')::uuid and sp.service_record_id = p_service_id;

  delete from public.service_parts
   where service_record_id = p_service_id
     and not (id = any (v_keep));

  -- Alterar as que continuam e acrescentar as novas, pela ordem recebida
  update public.service_parts sp set
    position    = (p.ord - 1)::integer,
    description = btrim(p.value ->> 'description'),
    reference   = nullif(btrim(p.value ->> 'reference'), ''),
    quantity    = coalesce((p.value ->> 'quantity')::numeric, 1)
  from jsonb_array_elements(coalesce(p_parts, '[]')) with ordinality as p(value, ord)
  where sp.service_record_id = p_service_id
    and sp.id = (p.value ->> 'id')::uuid;

  insert into public.service_parts (organization_id, service_record_id, position, description, reference, quantity)
  select v_org_id, p_service_id, (p.ord - 1)::integer,
         btrim(p.value ->> 'description'),
         nullif(btrim(p.value ->> 'reference'), ''),
         coalesce((p.value ->> 'quantity')::numeric, 1)
  from jsonb_array_elements(coalesce(p_parts, '[]')) with ordinality as p(value, ord)
  where not coalesce((p.value ->> 'id')::uuid = any (v_keep), false);
end;
$$;

revoke all on function public.update_service_record(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_service_record(uuid, jsonb, jsonb) to authenticated;
