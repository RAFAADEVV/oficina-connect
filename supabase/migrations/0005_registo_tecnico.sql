-- =====================================================================
-- Oficina Connect — Migração 0005: dados da oficina e registo técnico de serviços
--
-- Acrescenta:
--   • organizations: morada, telefone, email e NIF (aparecem no relatório de serviço)
--   • service_records: tipo "reparacao", avaria, trabalho efetuado,
--     lista de verificação e observações
--   • service_parts: peças aplicadas em cada serviço (descrição, referência, quantidade)
--   • create_service_record(...): grava o serviço e as peças de uma só vez
--
-- Importante: é um registo técnico. NÃO tem preços, stock nem faturação,
-- e o relatório gerado não serve de fatura.
--
-- Requer: migrações 0001 a 0004 já aplicadas.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run (uma única vez).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Dados da oficina (só o Dono altera — regra já existente da migração 0001)
-- ---------------------------------------------------------------------
alter table public.organizations
  add column address text check (address is null or char_length(address) <= 300),
  add column phone   text check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  add column email   text check (email is null or (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  add column nif     text check (nif is null or nif ~ '^[0-9]{9}$');

grant update (address, phone, email, nif) on public.organizations to authenticated;


-- ---------------------------------------------------------------------
-- 2. Registo técnico no serviço
-- ---------------------------------------------------------------------
alter table public.service_records drop constraint service_records_service_type_check;
alter table public.service_records
  add constraint service_records_service_type_check
    check (service_type in ('revisao', 'oleo', 'pneus', 'travoes', 'reparacao', 'outro')),
  add column problem         text check (problem is null or char_length(problem) <= 1000),
  add column work_done       text check (work_done is null or char_length(work_done) <= 2000),
  add column checklist       text[] not null default '{}'
    check (cardinality(checklist) <= 30),
  add column recommendations text check (recommendations is null or char_length(recommendations) <= 2000),
  -- Necessário para ligar as peças ao serviço "da mesma oficina"
  add constraint service_records_org_id_key unique (organization_id, id);

grant insert (problem, work_done, checklist, recommendations) on public.service_records to authenticated;
grant update (problem, work_done, checklist, recommendations) on public.service_records to authenticated;

-- Reconhece reparações na importação
create or replace function private.guess_service_type(p_description text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '(revis|manuten)' then 'revisao'
    when d ~ '([oó]leo|filtro)' then 'oleo'
    when d ~ 'pneu' then 'pneus'
    when d ~ '(trav|pastilh|disco)' then 'travoes'
    when d ~ '(repar|avaria|substitui)' then 'reparacao'
    else 'outro'
  end
  from (select lower(coalesce(p_description, '')) as d) x;
$$;


-- ---------------------------------------------------------------------
-- 3. Peças aplicadas
-- ---------------------------------------------------------------------
create table public.service_parts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  service_record_id  uuid not null,
  position           integer not null default 0 check (position between 0 and 99),
  description        text not null check (char_length(btrim(description)) between 1 and 200),
  reference          text check (reference is null or char_length(reference) <= 60),
  quantity           numeric(8, 2) not null default 1 check (quantity > 0 and quantity <= 9999),
  created_at         timestamptz not null default now(),
  -- A peça pertence a um serviço da mesma oficina; apagar o serviço apaga as peças
  foreign key (organization_id, service_record_id)
    references public.service_records (organization_id, id) on delete cascade
);

comment on table public.service_parts is 'Peças aplicadas em cada serviço (registo técnico, sem preços).';

create index service_parts_service_idx on public.service_parts (service_record_id, position);

alter table public.service_parts enable row level security;

revoke all on public.service_parts from anon, authenticated;
grant select, delete on public.service_parts to authenticated;
grant insert (organization_id, service_record_id, position, description, reference, quantity)
  on public.service_parts to authenticated;

create policy "Membros veem peças da oficina"
  on public.service_parts for select to authenticated
  using (private.is_org_member(organization_id));
create policy "Membros registam peças na oficina"
  on public.service_parts for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy "Dono apaga peças da oficina"
  on public.service_parts for delete to authenticated
  using (private.is_org_owner(organization_id));


-- ---------------------------------------------------------------------
-- 4. Gravar serviço e peças de uma só vez
--    Corre com as permissões de quem chama: o RLS continua a aplicar-se.
--    Se alguma peça for inválida, nada é gravado.
-- ---------------------------------------------------------------------
create function public.create_service_record(p_vehicle_id uuid, p_service jsonb, p_parts jsonb default '[]')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id     uuid;
  v_service_id uuid;
  v_checklist  text[];
begin
  select v.organization_id into v_org_id from public.vehicles v where v.id = p_vehicle_id;
  if v_org_id is null then
    raise exception 'Veículo não encontrado.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_parts, '[]')) <> 'array' or jsonb_array_length(coalesce(p_parts, '[]')) > 50 then
    raise exception 'Lista de peças inválida (máximo 50).' using errcode = '22023';
  end if;

  select coalesce(array_agg(left(btrim(x), 60)), '{}')
    into v_checklist
  from jsonb_array_elements_text(coalesce(p_service -> 'checklist', '[]')) as x
  where btrim(x) <> '';

  insert into public.service_records (
    organization_id, vehicle_id, service_date, service_type, description, mileage,
    next_service_date, next_service_mileage, problem, work_done, checklist, recommendations
  )
  values (
    v_org_id,
    p_vehicle_id,
    (p_service ->> 'service_date')::date,
    coalesce(p_service ->> 'service_type', 'outro'),
    p_service ->> 'description',
    (p_service ->> 'mileage')::integer,
    (p_service ->> 'next_service_date')::date,
    (p_service ->> 'next_service_mileage')::integer,
    nullif(btrim(p_service ->> 'problem'), ''),
    nullif(btrim(p_service ->> 'work_done'), ''),
    v_checklist,
    nullif(btrim(p_service ->> 'recommendations'), '')
  )
  returning id into v_service_id;

  insert into public.service_parts (organization_id, service_record_id, position, description, reference, quantity)
  select v_org_id, v_service_id, (p.ord - 1)::integer,
         btrim(p.value ->> 'description'),
         nullif(btrim(p.value ->> 'reference'), ''),
         coalesce((p.value ->> 'quantity')::numeric, 1)
  from jsonb_array_elements(coalesce(p_parts, '[]')) with ordinality as p(value, ord);

  return v_service_id;
end;
$$;

revoke all on function public.create_service_record(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_service_record(uuid, jsonb, jsonb) to authenticated;
