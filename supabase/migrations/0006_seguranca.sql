-- =====================================================================
-- RevyAuto — Migração 0006: reforço de segurança
--
-- 1. Autenticação em dois passos (MFA):
--    quem ativou o código de 6 dígitos (TOTP) só acede aos dados depois de o introduzir.
--    É garantido pela base de dados (políticas RESTRITIVAS), não só pela app.
-- 2. Limite à criação de oficinas: no máximo 5 oficinas criadas por conta (anti-abuso).
-- 3. Registo de auditoria: cada cliente, veículo, serviço ou peça apagado fica registado
--    (quem, quando, o quê). Só o Dono vê o registo. Não guarda dados pessoais, só identificadores.
--
-- Requer: migrações 0001 a 0005 já aplicadas.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run (uma única vez).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. MFA: verdadeiro se o utilizador não tem MFA ativo, ou se já o confirmou nesta sessão
-- ---------------------------------------------------------------------
create function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

revoke all on function private.mfa_ok() from public, anon;
grant execute on function private.mfa_ok() to authenticated;

-- Políticas RESTRITIVAS: somam-se às existentes (as duas têm de deixar passar)
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'organization_members', 'customers', 'vehicles',
    'service_records', 'service_parts', 'contact_logs', 'imports'
  ]
  loop
    execute format(
      'create policy "MFA confirmado quando ativo" on public.%I as restrictive for all to authenticated
         using (private.mfa_ok()) with check (private.mfa_ok())', t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Criar oficina: exige MFA (se ativo) e limita a 5 oficinas por conta
-- ---------------------------------------------------------------------
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name    text := btrim(coalesce(p_name, ''));
  v_org_id  uuid;
begin
  if v_user_id is null then
    raise exception 'É necessário ter sessão iniciada.' using errcode = '42501';
  end if;

  if not private.mfa_ok() then
    raise exception 'Confirme primeiro o código de autenticação em dois passos.' using errcode = '42501';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'O nome da oficina deve ter entre 2 e 120 caracteres.' using errcode = '22023';
  end if;

  if (select count(*) from public.organizations o where o.created_by = v_user_id) >= 5 then
    raise exception 'Atingiu o limite de oficinas por conta. Contacte o suporte.' using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by)
  values (v_name, v_user_id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Registo de auditoria de eliminações
-- ---------------------------------------------------------------------
create table public.audit_events (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  actor_id         uuid references auth.users (id) on delete set null,
  action           text not null check (action in ('delete')),
  table_name       text not null,
  record_id        uuid not null,
  created_at       timestamptz not null default now()
);

comment on table public.audit_events is 'Quem apagou o quê e quando. Só identificadores, sem dados pessoais.';

create index audit_events_org_created_idx on public.audit_events (organization_id, created_at desc);

alter table public.audit_events enable row level security;

-- Ninguém escreve diretamente: só o gatilho abaixo. Só o Dono lê.
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

create policy "Dono vê o registo de auditoria"
  on public.audit_events for select to authenticated
  using (private.is_org_owner(organization_id));
create policy "MFA confirmado quando ativo"
  on public.audit_events as restrictive for all to authenticated
  using (private.mfa_ok()) with check (private.mfa_ok());

create function private.log_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ao apagar uma oficina inteira, os registos dela são apagados em cascata: não há onde registar
  if exists (select 1 from public.organizations o where o.id = old.organization_id) then
    insert into public.audit_events (organization_id, actor_id, action, table_name, record_id)
    values (old.organization_id, (select auth.uid()), 'delete', tg_table_name, old.id);
  end if;
  return old;
end;
$$;

revoke all on function private.log_delete() from public, anon, authenticated;

create trigger customers_log_delete after delete on public.customers
  for each row execute function private.log_delete();
create trigger vehicles_log_delete after delete on public.vehicles
  for each row execute function private.log_delete();
create trigger service_records_log_delete after delete on public.service_records
  for each row execute function private.log_delete();
create trigger service_parts_log_delete after delete on public.service_parts
  for each row execute function private.log_delete();
