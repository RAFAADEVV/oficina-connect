-- =====================================================================
-- Oficina Connect — Migração 0003: importação de clientes, veículos e serviços
--
-- Cria:
--   • imports                 → registo de cada importação (quem, quando, ficheiro, totais)
--   • import_records(...)     → função que grava um lote de linhas de uma só vez
--
-- Regras da importação:
--   • Cliente com o mesmo telefone já existe → é reutilizado (não é duplicado nem alterado).
--   • Veículo com a mesma matrícula já existe → é reutilizado; se não tinha dono, fica ligado ao cliente.
--   • Serviço igual (mesmo veículo, mesma data, mesma descrição) → não é duplicado.
--   • Cada lote é gravado por inteiro ou não é gravado nada (se algo falhar, nada fica a meio).
--
-- Segurança:
--   • A função corre com as permissões de quem a chama ("security invoker"):
--     todas as regras RLS das migrações 0001 e 0002 continuam a aplicar-se.
--   • Verifica no início se o utilizador pertence à oficina indicada.
--   • O ficheiro original NÃO é guardado — só os dados já validados.
--
-- Requer: migrações 0001 e 0002 já aplicadas.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run (uma única vez).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Registo de importações
-- ---------------------------------------------------------------------
create table public.imports (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  file_name          text not null check (char_length(file_name) between 1 and 255),
  rows_total         integer not null default 0 check (rows_total >= 0),
  rows_skipped       integer not null default 0 check (rows_skipped >= 0),
  customers_created  integer not null default 0 check (customers_created >= 0),
  vehicles_created   integer not null default 0 check (vehicles_created >= 0),
  services_created   integer not null default 0 check (services_created >= 0),
  created_by         uuid references auth.users (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now()
);

comment on table public.imports is 'Histórico de importações de ficheiros. Não guarda o conteúdo dos ficheiros.';

create index imports_org_created_idx on public.imports (organization_id, created_at desc);

alter table public.imports enable row level security;

revoke all on public.imports from anon, authenticated;
grant select, delete on public.imports to authenticated;
grant insert (organization_id, file_name, rows_total, rows_skipped, customers_created, vehicles_created, services_created)
  on public.imports to authenticated;

create policy "Membros veem importações da oficina"
  on public.imports for select to authenticated
  using (private.is_org_member(organization_id));
create policy "Membros registam importações na oficina"
  on public.imports for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy "Dono apaga registos de importação"
  on public.imports for delete to authenticated
  using (private.is_org_owner(organization_id));


-- ---------------------------------------------------------------------
-- 2. Função de importação
--
-- p_rows é uma lista JSON de linhas já validadas pela app, por exemplo:
--   [{ "full_name": "Maria Santos", "phone": "+351912345678", "plate": "AA00BB",
--      "make": "Renault", "service_date": "2026-03-10", "service_description": "Revisão" }]
--
-- Devolve os totais: clientes/veículos/serviços criados e reutilizados.
-- ---------------------------------------------------------------------
create function public.import_records(p_organization_id uuid, p_rows jsonb)
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
      service_date date, service_description text, service_mileage integer
    )
  loop
    -- Cliente: reutiliza pelo telefone, ou cria -------------------------
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

    -- Veículo: reutiliza pela matrícula, ou cria ------------------------
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

    -- Serviço: só se houver veículo, data e descrição; sem duplicar ------
    if v_vehicle_id is not null and r.service_date is not null and nullif(btrim(r.service_description), '') is not null then
      if exists (
        select 1 from public.service_records s
        where s.vehicle_id = v_vehicle_id
          and s.service_date = r.service_date
          and lower(btrim(s.description)) = lower(btrim(r.service_description))
      ) then
        v_services_skipped := v_services_skipped + 1;
      else
        insert into public.service_records (organization_id, vehicle_id, service_date, description, mileage)
        values (p_organization_id, v_vehicle_id, r.service_date, btrim(r.service_description), r.service_mileage);
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

revoke all on function public.import_records(uuid, jsonb) from public, anon;
grant execute on function public.import_records(uuid, jsonb) to authenticated;
