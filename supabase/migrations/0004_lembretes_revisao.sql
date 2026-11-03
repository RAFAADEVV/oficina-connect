-- =====================================================================
-- Oficina Connect — Migração 0004: lembretes de revisão e registo de contactos
--
-- Acrescenta:
--   • service_records.service_type          → tipo de serviço (revisão, óleo, pneus, travões, outro)
--   • service_records.next_service_date     → próxima revisão combinada com o cliente (data)
--   • service_records.next_service_mileage  → próxima revisão combinada (km)
--   • organizations.service_interval_months → intervalo padrão da oficina (12 meses)
--   • contact_logs                          → registo de cada contacto feito ao cliente
--   • get_service_reminders(...)            → lista de clientes a contactar
--   • import_records(...)                   → passa a aceitar o tipo de serviço e a próxima revisão
--
-- Como é calculada a próxima revisão de cada veículo (por esta ordem):
--   1. Data combinada no último serviço de revisão/óleo.
--   2. Km combinados, se houver leituras de km suficientes para estimar quando lá chega.
--   3. Hábito do cliente (média entre revisões), se houver pelo menos 2 revisões.
--   4. Intervalo padrão da oficina desde a última revisão.
--
-- Quando aparece na lista:
--   • "mes"      → faltam entre 30 e 8 dias
--   • "semana"   → faltam 7 dias ou menos
--   • "atrasado" → a data já passou (até 365 dias)
--
-- Requer: migrações 0001, 0002 e 0003 já aplicadas.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run (uma única vez).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Intervalo padrão da oficina
-- ---------------------------------------------------------------------
alter table public.organizations
  add column service_interval_months integer not null default 12
    check (service_interval_months between 1 and 60);

grant update (service_interval_months) on public.organizations to authenticated;


-- ---------------------------------------------------------------------
-- 2. Tipo de serviço e próxima revisão
-- ---------------------------------------------------------------------
alter table public.service_records
  add column service_type text not null default 'outro'
    check (service_type in ('revisao', 'oleo', 'pneus', 'travoes', 'outro')),
  add column next_service_date date,
  add column next_service_mileage integer
    check (next_service_mileage is null or next_service_mileage between 0 and 3000000),
  add constraint service_records_next_date_after_service
    check (next_service_date is null or (next_service_date > service_date and next_service_date < date '2100-01-01'));

grant insert (service_type, next_service_date, next_service_mileage) on public.service_records to authenticated;
grant update (service_type, next_service_date, next_service_mileage) on public.service_records to authenticated;

create index service_records_vehicle_type_date_idx
  on public.service_records (vehicle_id, service_type, service_date desc);

-- Adivinha o tipo de serviço a partir da descrição (usado na importação e para os dados já existentes)
create function private.guess_service_type(p_description text)
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
    else 'outro'
  end
  from (select lower(coalesce(p_description, '')) as d) x;
$$;

revoke all on function private.guess_service_type(text) from public, anon;
grant execute on function private.guess_service_type(text) to authenticated;

-- Classifica os serviços que já existem (importados antes desta migração)
update public.service_records
set service_type = private.guess_service_type(description)
where service_type = 'outro';


-- ---------------------------------------------------------------------
-- 3. Registo de contactos
-- ---------------------------------------------------------------------
create table public.contact_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid not null,
  vehicle_id       uuid not null,
  -- Data prevista da revisão a que este contacto se refere (identifica o "ciclo")
  due_date         date not null,
  stage            text not null check (stage in ('mes', 'semana', 'atrasado')),
  channel          text not null default 'whatsapp' check (channel in ('whatsapp', 'telefone', 'outro')),
  outcome          text not null default 'enviado'
    check (outcome in ('enviado', 'agendado', 'sem_resposta', 'ja_fez', 'nao_quer')),
  notes            text check (notes is null or char_length(notes) <= 1000),
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Cliente e veículo têm de ser da mesma oficina. Apagar o cliente apaga os seus contactos (RGPD).
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete cascade,
  foreign key (organization_id, vehicle_id)  references public.vehicles  (organization_id, id) on delete cascade
);

comment on table public.contact_logs is 'Contactos feitos aos clientes (lembretes de revisão) e o seu resultado.';

create index contact_logs_vehicle_due_idx on public.contact_logs (vehicle_id, due_date, created_at desc);
create index contact_logs_org_created_idx on public.contact_logs (organization_id, created_at desc);

create trigger contact_logs_set_updated_at before update on public.contact_logs
  for each row execute function private.set_updated_at();

alter table public.contact_logs enable row level security;

revoke all on public.contact_logs from anon, authenticated;
grant select, delete on public.contact_logs to authenticated;
grant insert (organization_id, customer_id, vehicle_id, due_date, stage, channel, outcome, notes)
  on public.contact_logs to authenticated;
grant update (outcome, notes) on public.contact_logs to authenticated;

create policy "Membros veem contactos da oficina"
  on public.contact_logs for select to authenticated
  using (private.is_org_member(organization_id));
create policy "Membros registam contactos na oficina"
  on public.contact_logs for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy "Membros atualizam contactos da oficina"
  on public.contact_logs for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy "Dono apaga contactos da oficina"
  on public.contact_logs for delete to authenticated
  using (private.is_org_owner(organization_id));


-- ---------------------------------------------------------------------
-- 4. Lista de lembretes
--    Corre com as permissões de quem chama: o RLS garante que só vê a sua oficina.
--    p_today permite testar com datas fixas; a app passa a data local de Portugal.
-- ---------------------------------------------------------------------
create function public.get_service_reminders(p_organization_id uuid, p_today date default current_date)
returns table (
  vehicle_id            uuid,
  customer_id           uuid,
  customer_name         text,
  customer_phone        text,
  plate                 text,
  make                  text,
  model                 text,
  last_service_date     date,
  last_service_mileage  integer,
  due_date              date,
  due_mileage           integer,
  due_source            text,
  stage                 text,
  contacted_at          timestamptz,
  contact_id            uuid,
  contact_stage         text,
  contact_outcome       text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with revisions as (
    select
      s.vehicle_id, s.service_date, s.mileage, s.next_service_date, s.next_service_mileage,
      row_number() over (partition by s.vehicle_id order by s.service_date desc, s.created_at desc) as rn,
      count(*)              over (partition by s.vehicle_id) as n,
      min(s.service_date)   over (partition by s.vehicle_id) as first_date
    from public.service_records s
    where s.organization_id = p_organization_id
      and s.service_type in ('revisao', 'oleo')
  ),
  km_rate as (
    -- Km por dia, estimados a partir de todas as leituras de km do veículo
    select s.vehicle_id,
      (max(s.mileage) - min(s.mileage))::numeric / nullif(max(s.service_date) - min(s.service_date), 0) as per_day
    from public.service_records s
    where s.organization_id = p_organization_id and s.mileage is not null
    group by s.vehicle_id
    having count(*) >= 2
  ),
  last_revision as (
    select r.*,
      case when r.n >= 2 then (r.service_date - r.first_date)::numeric / (r.n - 1) end as avg_days
    from revisions r
    where r.rn = 1
  ),
  due as (
    select
      l.vehicle_id, l.service_date, l.mileage, l.next_service_mileage,
      case
        when l.next_service_date is not null then l.next_service_date
        when l.next_service_mileage > l.mileage and k.per_day > 0
          then l.service_date + least(1825, ceil((l.next_service_mileage - l.mileage) / k.per_day))::integer
        when l.avg_days is not null
          then l.service_date + greatest(90, least(730, round(l.avg_days)))::integer
        else (l.service_date + make_interval(months => o.service_interval_months))::date
      end as due_date,
      case
        when l.next_service_date is not null then 'combinado'
        when l.next_service_mileage > l.mileage and k.per_day > 0 then 'combinado_km'
        when l.avg_days is not null then 'habito'
        else 'padrao'
      end as due_source
    from last_revision l
    left join km_rate k on k.vehicle_id = l.vehicle_id
    join public.organizations o on o.id = p_organization_id
  ),
  staged as (
    select d.*,
      case
        when p_today > d.due_date then 'atrasado'
        when p_today >= d.due_date - 7 then 'semana'
        when p_today >= d.due_date - 30 then 'mes'
      end as stage
    from due d
    where p_today >= d.due_date - 30
      and p_today <= d.due_date + 365
  )
  select
    v.id, c.id, c.full_name, c.phone, v.plate, v.make, v.model,
    s.service_date, s.mileage, s.due_date, s.next_service_mileage, s.due_source, s.stage,
    lc.created_at, lc.id, lc.stage, lc.outcome
  from staged s
  join public.vehicles v  on v.id = s.vehicle_id and v.organization_id = p_organization_id
  join public.customers c on c.id = v.customer_id and c.organization_id = p_organization_id
  left join lateral (
    -- Último contacto deste ciclo (mesma data prevista)
    select cl.id, cl.created_at, cl.outcome, cl.stage
    from public.contact_logs cl
    where cl.vehicle_id = v.id and cl.due_date = s.due_date
    order by cl.created_at desc
    limit 1
  ) lc on true
  where not c.contact_opt_out
    -- Agendou, já fez noutro sítio ou não quer: sai da lista até haver um novo serviço
    and coalesce(lc.outcome, '') not in ('agendado', 'ja_fez', 'nao_quer')
  order by s.due_date, c.full_name;
$$;

revoke all on function public.get_service_reminders(uuid, date) from public, anon;
grant execute on function public.get_service_reminders(uuid, date) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Importação: aceita tipo de serviço e próxima revisão
--    (mesma lógica da migração 0003, com os novos campos)
-- ---------------------------------------------------------------------
create or replace function public.import_records(p_organization_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r                    record;
  v_customer_id        uuid;
  v_vehicle_id         uuid;
  v_vehicle_owner      uuid;
  v_plate              text;
  v_next_date          date;
  v_customers_created  uuid[] := '{}';
  v_customers_reused   uuid[] := '{}';
  v_vehicles_created   uuid[] := '{}';
  v_vehicles_reused    uuid[] := '{}';
  v_services_created   integer := 0;
  v_services_skipped   integer := 0;
begin
  if (select auth.uid()) is null or not private.is_org_member(p_organization_id) then
    raise exception 'Sem permissão para importar dados nesta oficina.' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Dados de importação inválidos.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'Cada lote pode ter no máximo 1000 linhas.' using errcode = '22023';
  end if;

  for r in
    select *
    from jsonb_to_recordset(p_rows) as x(
      full_name text, phone text, email text, nif text, address text,
      plate text, make text, model text, year integer, mileage integer,
      service_date date, service_description text, service_mileage integer,
      service_type text, next_service_date date
    )
  loop
    -- Cliente: reutiliza pelo telefone, ou cria
    v_customer_id := null;

    select c.id into v_customer_id
    from public.customers c
    where c.organization_id = p_organization_id
      and c.phone = regexp_replace(r.phone, '[\s().-]', '', 'g')
    order by c.created_at
    limit 1;

    if v_customer_id is null then
      insert into public.customers (organization_id, full_name, phone, email, nif, address)
      values (p_organization_id, r.full_name, r.phone, r.email, r.nif, r.address)
      returning id into v_customer_id;
      v_customers_created := v_customers_created || v_customer_id;
    elsif not (v_customer_id = any (v_customers_created)) and not (v_customer_id = any (v_customers_reused)) then
      v_customers_reused := v_customers_reused || v_customer_id;
    end if;

    -- Veículo: reutiliza pela matrícula, ou cria
    v_vehicle_id := null;
    v_plate := upper(regexp_replace(coalesce(r.plate, ''), '[^A-Za-z0-9]', '', 'g'));

    if v_plate <> '' then
      select v.id, v.customer_id into v_vehicle_id, v_vehicle_owner
      from public.vehicles v
      where v.organization_id = p_organization_id and v.plate = v_plate;

      if v_vehicle_id is null then
        insert into public.vehicles (organization_id, customer_id, plate, make, model, year, mileage)
        values (p_organization_id, v_customer_id, v_plate, r.make, r.model, r.year, r.mileage)
        returning id into v_vehicle_id;
        v_vehicles_created := v_vehicles_created || v_vehicle_id;
      else
        if v_vehicle_owner is null then
          update public.vehicles set customer_id = v_customer_id where id = v_vehicle_id;
        end if;
        if not (v_vehicle_id = any (v_vehicles_created)) and not (v_vehicle_id = any (v_vehicles_reused)) then
          v_vehicles_reused := v_vehicles_reused || v_vehicle_id;
        end if;
      end if;
    end if;

    -- Serviço: só se houver veículo, data e descrição; sem duplicar
    if v_vehicle_id is not null and r.service_date is not null and nullif(btrim(r.service_description), '') is not null then
      if exists (
        select 1 from public.service_records s
        where s.vehicle_id = v_vehicle_id
          and s.service_date = r.service_date
          and lower(btrim(s.description)) = lower(btrim(r.service_description))
      ) then
        v_services_skipped := v_services_skipped + 1;
      else
        -- A próxima revisão só é guardada se for depois da data do serviço
        v_next_date := case when r.next_service_date > r.service_date then r.next_service_date end;
        insert into public.service_records
          (organization_id, vehicle_id, service_date, description, mileage, service_type, next_service_date)
        values (
          p_organization_id, v_vehicle_id, r.service_date, btrim(r.service_description), r.service_mileage,
          case when r.service_type in ('revisao', 'oleo', 'pneus', 'travoes', 'outro')
               then r.service_type
               else private.guess_service_type(r.service_description) end,
          v_next_date
        );
        v_services_created := v_services_created + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'customers_created', cardinality(v_customers_created),
    'customers_reused',  cardinality(v_customers_reused),
    'vehicles_created',  cardinality(v_vehicles_created),
    'vehicles_reused',   cardinality(v_vehicles_reused),
    'services_created',  v_services_created,
    'services_skipped',  v_services_skipped
  );
end;
$$;
