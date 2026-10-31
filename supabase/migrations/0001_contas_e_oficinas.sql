-- =====================================================================
-- Oficina Connect — Migração 0001: contas, oficinas e membros
--
-- Cria:
--   • organizations          → as oficinas
--   • profiles               → dados de cada utilizador (1 por conta)
--   • organization_members   → quem pertence a que oficina e com que papel
--
-- Segurança:
--   • RLS ativo em todas as tabelas.
--   • Cada utilizador só vê as oficinas a que pertence.
--   • Só o Dono pode alterar os dados da oficina.
--   • Criar uma oficina é feito por uma função (create_organization) que
--     cria a oficina e torna o utilizador Dono no mesmo passo.
--   • Visitantes sem sessão (anon) não têm acesso a nenhuma destas tabelas.
--
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode ser executado só uma vez (não é para repetir).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Esquema privado para funções internas
--    (não é exposto pela API, por isso não pode ser chamado diretamente
--     a partir do navegador — só usado pelas regras de segurança)
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;


-- ---------------------------------------------------------------------
-- 2. Papéis dentro de uma oficina
--    owner  = Dono        (gere tudo, incluindo utilizadores e definições)
--    member = Funcionário (trabalha com clientes e contactos)
-- ---------------------------------------------------------------------
create type public.organization_role as enum ('owner', 'member');


-- ---------------------------------------------------------------------
-- 3. Tabelas
-- ---------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is 'Oficinas (clientes do Oficina Connect). Cada oficina tem os seus dados isolados.';

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Dados de cada utilizador. Criado automaticamente quando a conta é registada.';

create table public.organization_members (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.organization_role not null default 'member',
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);

comment on table public.organization_members is 'Ligação entre utilizadores e oficinas, com o papel de cada um.';

create index organization_members_user_id_idx on public.organization_members (user_id);


-- ---------------------------------------------------------------------
-- 4. Atualizar updated_at automaticamente
-- ---------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();


-- ---------------------------------------------------------------------
-- 5. Criar o perfil automaticamente quando alguém cria conta
-- ---------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();


-- ---------------------------------------------------------------------
-- 6. Funções de verificação usadas pelas regras de segurança
--    "security definer" evita que as regras se chamem a si próprias
--    em ciclo ao consultar organization_members.
-- ---------------------------------------------------------------------
create function private.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- Verdadeiro se o utilizador atual partilha pelo menos uma oficina com outro utilizador
create function private.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.is_org_member(uuid)   from public, anon;
revoke all on function private.is_org_owner(uuid)    from public, anon;
revoke all on function private.shares_org_with(uuid) from public, anon;
revoke all on function private.handle_new_user()     from public, anon, authenticated;
revoke all on function private.set_updated_at()      from public, anon, authenticated;
grant execute on function private.is_org_member(uuid)   to authenticated;
grant execute on function private.is_org_owner(uuid)    to authenticated;
grant execute on function private.shares_org_with(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Ativar Row Level Security
-- ---------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.organization_members enable row level security;


-- ---------------------------------------------------------------------
-- 8. Permissões de base (antes das regras RLS)
--    • anon (sem sessão): nenhum acesso.
--    • authenticated: só pode ler, e alterar apenas colunas específicas.
--    • Inserir oficinas/membros só através de funções controladas.
-- ---------------------------------------------------------------------
revoke all on public.organizations        from anon, authenticated;
revoke all on public.profiles             from anon, authenticated;
revoke all on public.organization_members from anon, authenticated;

grant select on public.organizations        to authenticated;
grant select on public.profiles             to authenticated;
grant select on public.organization_members to authenticated;

grant update (name)      on public.organizations to authenticated;
grant update (full_name) on public.profiles      to authenticated;


-- ---------------------------------------------------------------------
-- 9. Regras RLS
-- ---------------------------------------------------------------------

-- Oficinas: ver só aquelas a que pertence
create policy "Membros veem a sua oficina"
  on public.organizations for select
  to authenticated
  using (private.is_org_member(id));

-- Oficinas: só o Dono altera
create policy "Dono altera a sua oficina"
  on public.organizations for update
  to authenticated
  using (private.is_org_owner(id))
  with check (private.is_org_owner(id));

-- Perfis: ver o próprio e o dos colegas da mesma oficina
create policy "Ver o próprio perfil e o dos colegas"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.shares_org_with(id)
  );

-- Perfis: alterar só o próprio
create policy "Alterar o próprio perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Membros: ver os membros das oficinas a que pertence
create policy "Ver membros da própria oficina"
  on public.organization_members for select
  to authenticated
  using (private.is_org_member(organization_id));

-- (Sem regras de INSERT/UPDATE/DELETE em organization_members:
--  gerir membros e convites será feito numa próxima tarefa, por funções controladas.)


-- ---------------------------------------------------------------------
-- 10. Criar uma oficina (chamada pela app no primeiro acesso)
--     Cria a oficina e torna o utilizador atual Dono, num único passo.
-- ---------------------------------------------------------------------
create function public.create_organization(p_name text)
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

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'O nome da oficina deve ter entre 2 e 120 caracteres.' using errcode = '22023';
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
