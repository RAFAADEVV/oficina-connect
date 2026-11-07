-- =====================================================================
-- RevyAuto — Migração 0009: registo fechado (só entra quem for autorizado)
--
-- Cria:
--   • platform_admins     → quem administra a plataforma (tu)
--   • signup_allowlist    → emails autorizados a criar conta
--   • gatilho em auth.users que recusa contas de emails não autorizados
--   • convites de equipa COM email: o email do funcionário fica autorizado
--     e o código só funciona para essa pessoa
--   • funções de administração: ver/autorizar/remover emails, ver oficinas
--
-- Regras:
--   • Pode criar conta quem estiver na lista OU tiver um convite ativo
--     para o seu email.
--   • A verificação é feita na base de dados, no momento em que o Supabase
--     cria a conta: não é possível contornar pela app nem pela API.
--   • As contas que já existem não são afetadas.
--   • As funções de administração exigem a autenticação em dois passos
--     confirmada nesta sessão (aal2).
--
-- Depois de correr esta migração, torna-te administrador (ver fim do ficheiro).
--
-- Requer: migrações 0001 a 0008.
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.signup_allowlist (
  email       text primary key check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  note        text check (char_length(note) <= 200),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.platform_admins  is 'Administradores da plataforma RevyAuto.';
comment on table public.signup_allowlist is 'Emails autorizados a criar conta.';

-- Sem regras RLS = ninguém lê nem escreve a partir da app (só pelas funções abaixo)
alter table public.platform_admins  enable row level security;
alter table public.signup_allowlist enable row level security;
revoke all on public.platform_admins  from anon, authenticated;
revoke all on public.signup_allowlist from anon, authenticated;

-- Convites passam a ter o email do funcionário
alter table public.organization_invites
  add column email text check (email is null or (email = lower(btrim(email)) and char_length(email) <= 254));

grant select (email) on public.organization_invites to authenticated;

create index organization_invites_email_idx on public.organization_invites (email)
  where used_at is null and revoked_at is null;


-- ---------------------------------------------------------------------
-- 2. Funções internas
-- ---------------------------------------------------------------------
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- Este email pode criar conta?
create function private.is_signup_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.signup_allowlist l where l.email = lower(btrim(p_email)))
      or exists (select 1 from public.organization_invites i
                 where i.email = lower(btrim(p_email))
                   and i.used_at is null and i.revoked_at is null and i.expires_at > now());
$$;

-- Gatilho: recusa contas de emails não autorizados.
-- Só se aplica ao serviço de autenticação do Supabase (é por aí que passam
-- todos os registos); comandos no SQL Editor e testes não são afetados.
create function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user = 'supabase_auth_admin' and not private.is_signup_allowed(new.email) then
    raise exception 'REVYAUTO_SIGNUP_NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function private.enforce_signup_allowlist();

revoke all on function private.is_platform_admin()          from public, anon, authenticated;
revoke all on function private.is_signup_allowed(text)      from public, anon, authenticated;
revoke all on function private.enforce_signup_allowlist()   from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Convites com email (substitui a versão da migração 0007)
-- ---------------------------------------------------------------------
drop function public.create_invite(uuid);

create function public.create_invite(p_organization_id uuid, p_email text)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_user_id  uuid := (select auth.uid());
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_bytes    bytea;
  v_raw      text := '';
  v_expires  timestamptz := now() + interval '7 days';
  i          integer;
begin
  if v_user_id is null then
    raise exception 'É necessário ter sessão iniciada.' using errcode = '42501';
  end if;
  if not private.mfa_ok() then
    raise exception 'Confirme primeiro o código de autenticação em dois passos.' using errcode = '42501';
  end if;
  if not private.is_org_owner(p_organization_id) then
    raise exception 'Só o Dono da oficina pode convidar pessoas.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Indique um email válido.' using errcode = '22023';
  end if;

  if (select count(*) from public.organization_invites i
      where i.organization_id = p_organization_id
        and i.used_at is null and i.revoked_at is null and i.expires_at > now()) >= 10 then
    raise exception 'Já tem 10 convites por usar. Cancele algum antes de criar outro.' using errcode = '22023';
  end if;

  if (select count(*) from public.organization_members m where m.organization_id = p_organization_id) >= 25 then
    raise exception 'A oficina atingiu o limite de 25 pessoas.' using errcode = '22023';
  end if;

  if exists (select 1 from public.organization_members m join auth.users u on u.id = m.user_id
             where m.organization_id = p_organization_id and lower(u.email) = v_email) then
    raise exception 'Esta pessoa já pertence à oficina.' using errcode = '22023';
  end if;

  v_bytes := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  for i in 0..11 loop
    v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;

  insert into public.organization_invites (organization_id, code_hash, role, created_by, expires_at, email)
  values (p_organization_id, private.invite_code_hash(v_raw), 'member', v_user_id, v_expires, v_email);

  code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
  expires_at := v_expires;
  return next;
end;
$$;

revoke all on function public.create_invite(uuid, text) from public, anon;
grant execute on function public.create_invite(uuid, text) to authenticated;

-- Aceitar: o código só serve para o email convidado
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email   text;
  v_invite  public.organization_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'É necessário ter sessão iniciada.' using errcode = '42501';
  end if;
  if not private.mfa_ok() then
    raise exception 'Confirme primeiro o código de autenticação em dois passos.' using errcode = '42501';
  end if;

  if (select count(*) from public.invite_attempts a
      where a.user_id = v_user_id and a.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiadas tentativas. Aguarde uma hora e tente novamente.' using errcode = '22023';
  end if;

  insert into public.invite_attempts (user_id) values (v_user_id);

  if char_length(private.normalize_invite_code(p_code)) <> 12 then
    return null;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_user_id;

  select * into v_invite
    from public.organization_invites i
   where i.code_hash = private.invite_code_hash(p_code)
     and i.used_at is null and i.revoked_at is null and i.expires_at > now()
     and (i.email is null or i.email = v_email)
   for update;

  if not found then
    return null;
  end if;

  if exists (select 1 from public.organization_members m
             where m.organization_id = v_invite.organization_id and m.user_id = v_user_id) then
    raise exception 'Já pertence a esta oficina.' using errcode = '22023';
  end if;

  if (select count(*) from public.organization_members m where m.organization_id = v_invite.organization_id) >= 25 then
    raise exception 'A oficina atingiu o limite de 25 pessoas.' using errcode = '22023';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role);

  update public.organization_invites
     set used_by = v_user_id, used_at = now()
   where id = v_invite.id;

  delete from public.invite_attempts where user_id = v_user_id;

  return v_invite.organization_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Administração (só administradores, com dois passos confirmados)
-- ---------------------------------------------------------------------

-- A app pergunta se deve mostrar o menu de administração
create function public.am_i_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin();
$$;

create function public.admin_list_allowlist()
returns table (email text, note text, created_at timestamptz, has_account boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
    select l.email, l.note, l.created_at,
           exists (select 1 from auth.users u where lower(u.email) = l.email)
      from public.signup_allowlist l
     order by l.created_at desc;
end;
$$;

create function public.admin_allow_email(p_email text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not private.is_platform_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Indique um email válido.' using errcode = '22023';
  end if;
  insert into public.signup_allowlist (email, note, created_by)
  values (v_email, nullif(left(btrim(coalesce(p_note, '')), 200), ''), (select auth.uid()))
  on conflict (email) do update set note = excluded.note;
end;
$$;

create function public.admin_remove_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  delete from public.signup_allowlist where email = lower(btrim(coalesce(p_email, '')));
end;
$$;

-- Visão geral das oficinas (sem dados dos clientes delas)
create function public.admin_list_organizations()
returns table (id uuid, name text, owner_email text, members integer, customers integer, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
    select o.id, o.name,
           (select u.email::text from public.organization_members m join auth.users u on u.id = m.user_id
             where m.organization_id = o.id and m.role = 'owner' order by m.created_at limit 1),
           (select count(*)::integer from public.organization_members m where m.organization_id = o.id),
           (select count(*)::integer from public.customers c where c.organization_id = o.id),
           o.created_at
      from public.organizations o
     order by o.created_at desc;
end;
$$;

revoke all on function public.am_i_platform_admin()                from public, anon;
revoke all on function public.admin_list_allowlist()               from public, anon;
revoke all on function public.admin_allow_email(text, text)        from public, anon;
revoke all on function public.admin_remove_email(text)             from public, anon;
revoke all on function public.admin_list_organizations()           from public, anon;
grant execute on function public.am_i_platform_admin()             to authenticated;
grant execute on function public.admin_list_allowlist()            to authenticated;
grant execute on function public.admin_allow_email(text, text)     to authenticated;
grant execute on function public.admin_remove_email(text)          to authenticated;
grant execute on function public.admin_list_organizations()        to authenticated;


-- =====================================================================
-- DEPOIS DE CORRER ESTA MIGRAÇÃO: tornar-te administrador
--
-- Numa nova query, troca o email pelo teu e corre:
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'o-teu-email@exemplo.pt';
--
-- O ecrã de administração só aparece com a autenticação em dois passos ativa
-- e confirmada nesta sessão.
-- =====================================================================
