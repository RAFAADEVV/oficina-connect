-- =====================================================================
-- Oficina Connect — Migração 0002: clientes, veículos e histórico de serviços
--
-- Cria:
--   • customers        → clientes da oficina
--   • vehicles         → veículos (cada um pode estar ligado a um cliente)
--   • service_records  → serviços feitos a cada veículo
--
-- Segurança:
--   • Todas as tabelas têm organization_id e RLS: cada oficina só vê os seus dados.
--   • Dono e Funcionário podem ver, criar e editar. Só o Dono pode apagar.
--   • Um veículo só pode ser ligado a um cliente DA MESMA oficina
--     (garantido pela própria base de dados, não só pela app).
--   • Ninguém pode mudar um registo de oficina (organization_id não é editável).
--
-- Requer: migração 0001 já aplicada.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run (uma única vez).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Clientes
-- ---------------------------------------------------------------------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  full_name        text not null check (char_length(btrim(full_name)) between 1 and 200),
  -- Telefone normalizado pela app (ex.: +351912345678)
  phone            text not null check (phone ~ '^\+?[0-9]{9,15}$'),
  email            text check (email is null or (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  nif              text check (nif is null or nif ~ '^[0-9]{9}$'),
  address          text check (address is null or char_length(address) <= 300),
  notes            text check (notes is null or char_length(notes) <= 2000),
  -- RGPD: o cliente pediu para não ser contactado (direito de oposição)
  contact_opt_out     boolean not null default false,
  contact_opt_out_at  timestamptz,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Necessário para as ligações "mesma oficina" das outras tabelas
  unique (organization_id, id)
);

comment on table public.customers is 'Clientes de cada oficina. Dados pessoais: tratar de acordo com o RGPD.';
comment on column public.customers.contact_opt_out is 'Se verdadeiro, o cliente não deve receber contactos da oficina.';

create index customers_org_name_idx  on public.customers (organization_id, full_name);
create index customers_org_phone_idx on public.customers (organization_id, phone);


-- ---------------------------------------------------------------------
-- 2. Veículos
-- ---------------------------------------------------------------------
create table public.vehicles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid,
  -- Matrícula guardada sem espaços nem hífenes e em maiúsculas (ex.: AA00BB)
  plate            text not null check (plate ~ '^[A-Z0-9]{2,12}$'),
  make             text check (make  is null or char_length(make)  <= 60),
  model            text check (model is null or char_length(model) <= 80),
  year             integer check (year is null or year between 1900 and 2100),
  mileage          integer check (mileage is null or mileage between 0 and 3000000),
  notes            text check (notes is null or char_length(notes) <= 2000),
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  -- A mesma matrícula não pode existir duas vezes na mesma oficina
  unique (organization_id, plate),
  -- O cliente tem de ser da mesma oficina. Se o cliente for apagado, o veículo fica sem dono.
  foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete set null (customer_id)
);

comment on table public.vehicles is 'Veículos dos clientes de cada oficina.';

create index vehicles_customer_idx on public.vehicles (customer_id);


-- ---------------------------------------------------------------------
-- 3. Histórico de serviços
-- ---------------------------------------------------------------------
create table public.service_records (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  vehicle_id       uuid not null,
  service_date     date not null check (service_date between date '1980-01-01' and date '2100-01-01'),
  description      text not null check (char_length(btrim(description)) between 1 and 500),
  mileage          integer check (mileage is null or mileage between 0 and 3000000),
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- O veículo tem de ser da mesma oficina. Apagar o veículo apaga o seu histórico.
  foreign key (organization_id, vehicle_id)
    references public.vehicles (organization_id, id)
    on delete cascade
);

comment on table public.service_records is 'Serviços realizados a cada veículo (revisões, pneus, inspeções, etc.).';

create index service_records_vehicle_date_idx on public.service_records (vehicle_id, service_date desc);
create index service_records_org_date_idx     on public.service_records (organization_id, service_date desc);


-- ---------------------------------------------------------------------
-- 4. Normalização automática e datas de atualização
-- ---------------------------------------------------------------------
create function private.normalize_vehicle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.plate := upper(regexp_replace(coalesce(new.plate, ''), '[^A-Za-z0-9]', '', 'g'));
  new.make  := nullif(btrim(new.make), '');
  new.model := nullif(btrim(new.model), '');
  return new;
end;
$$;

create function private.normalize_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  new.phone     := regexp_replace(coalesce(new.phone, ''), '[\s().-]', '', 'g');
  new.email     := nullif(lower(btrim(new.email)), '');
  new.nif       := nullif(regexp_replace(coalesce(new.nif, ''), '\s', '', 'g'), '');
  -- Regista quando o cliente pediu para não ser contactado
  if new.contact_opt_out and (tg_op = 'INSERT' or not old.contact_opt_out) then
    new.contact_opt_out_at := now();
  elsif not new.contact_opt_out then
    new.contact_opt_out_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_vehicle()  from public, anon, authenticated;
revoke all on function private.normalize_customer() from public, anon, authenticated;

create trigger customers_normalize before insert or update on public.customers
  for each row execute function private.normalize_customer();
create trigger vehicles_normalize before insert or update on public.vehicles
  for each row execute function private.normalize_vehicle();

create trigger customers_set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function private.set_updated_at();
create trigger service_records_set_updated_at before update on public.service_records
  for each row execute function private.set_updated_at();


-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.customers       enable row level security;
alter table public.vehicles        enable row level security;
alter table public.service_records enable row level security;


-- ---------------------------------------------------------------------
-- 6. Permissões de base
--    • anon: nenhum acesso.
--    • authenticated: ver e apagar; criar e editar só as colunas de conteúdo
--      (organization_id não pode ser alterado; created_by e datas são automáticos).
-- ---------------------------------------------------------------------
revoke all on public.customers       from anon, authenticated;
revoke all on public.vehicles        from anon, authenticated;
revoke all on public.service_records from anon, authenticated;

grant select, delete on public.customers       to authenticated;
grant select, delete on public.vehicles        to authenticated;
grant select, delete on public.service_records to authenticated;

-- Ao criar, só se podem preencher as colunas de conteúdo
-- (id, created_by e datas são preenchidos automaticamente pela base de dados)
grant insert (organization_id, full_name, phone, email, nif, address, notes, contact_opt_out)
  on public.customers to authenticated;
grant insert (organization_id, customer_id, plate, make, model, year, mileage, notes)
  on public.vehicles to authenticated;
grant insert (organization_id, vehicle_id, service_date, description, mileage)
  on public.service_records to authenticated;

grant update (full_name, phone, email, nif, address, notes, contact_opt_out)
  on public.customers to authenticated;
grant update (customer_id, plate, make, model, year, mileage, notes)
  on public.vehicles to authenticated;
grant update (service_date, description, mileage)
  on public.service_records to authenticated;


-- ---------------------------------------------------------------------
-- 7. Regras RLS (iguais para as três tabelas)
--    Ver / criar / editar: qualquer membro da oficina.
--    Apagar: só o Dono.
-- ---------------------------------------------------------------------

-- Clientes
create policy "Membros veem clientes da oficina"
  on public.customers for select to authenticated
  using (private.is_org_member(organization_id));
create policy "Membros criam clientes na oficina"
  on public.customers for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy "Membros editam clientes da oficina"
  on public.customers for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy "Dono apaga clientes da oficina"
  on public.customers for delete to authenticated
  using (private.is_org_owner(organization_id));

-- Veículos
create policy "Membros veem veículos da oficina"
  on public.vehicles for select to authenticated
  using (private.is_org_member(organization_id));
create policy "Membros criam veículos na oficina"
  on public.vehicles for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy "Membros editam veículos da oficina"
  on public.vehicles for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy "Dono apaga veículos da oficina"
  on public.vehicles for delete to authenticated
  using (private.is_org_owner(organization_id));

-- Serviços
create policy "Membros veem serviços da oficina"
  on public.service_records for select to authenticated
  using (private.is_org_member(organization_id));
create policy "Membros criam serviços na oficina"
  on public.service_records for insert to authenticated
  with check (private.is_org_member(organization_id));
create policy "Membros editam serviços da oficina"
  on public.service_records for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy "Dono apaga serviços da oficina"
  on public.service_records for delete to authenticated
  using (private.is_org_owner(organization_id));
