-- =====================================================================
-- RevyAuto — Migração 0007: convites e gestão da equipa
--
-- Cria:
--   • organization_invites  → códigos de convite para funcionários
--   • invite_attempts       → tentativas de usar um código (contra adivinhação)
--   • create_invite         → o Dono gera um código (válido 7 dias, uso único)
--   • revoke_invite         → o Dono cancela um código ainda não usado
--   • accept_invite         → quem tem o código entra na oficina como Funcionário
--   • list_team             → lista da equipa (nome, email, papel)
--   • remove_member         → o Dono remove um Funcionário
--   • leave_organization    → um Funcionário sai da oficina
--
-- Segurança:
--   • O código só é mostrado uma vez. Na base de dados fica apenas o seu
--     resumo (SHA-256), por isso nem quem lê a tabela consegue usá-lo.
--   • Códigos expiram ao fim de 7 dias e só podem ser usados uma vez.
--   • Máximo de 10 tentativas por hora por conta (impede adivinhar códigos).
--   • Máximo de 10 convites ativos e 25 pessoas por oficina.
--   • Ninguém escreve diretamente nas tabelas: só através destas funções.
--   • MFA: se ativo, tem de estar confirmado (como em todo o resto).
--
-- Como aplicar: Supabase → SQL Editor → New query → colar tudo → Run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table public.organization_invites (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code_hash        bytea not null unique,
  role             public.organization_role not null default 'member' check (role = 'member'),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_by          uuid references auth.users (id) on delete set null,
  used_at          timestamptz,
  revoked_at       timestamptz
);

comment on table public.organization_invites is 'Convites para entrar numa oficina. Guarda só o resumo do código.';

create index organization_invites_org_idx on public.organization_invites (organization_id, created_at desc);

create table public.invite_attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index invite_attempts_user_idx on public.invite_attempts (user_id, created_at desc);

alter table public.organization_invites enable row level security;
alter table public.invite_attempts      enable row level security;

revoke all on public.organization_invites from anon, authenticated;
revoke all on public.invite_attempts      from anon, authenticated;

-- O Dono vê os convites da oficina, mas nunca o resumo do código
grant select (id, organization_id, role, created_by, created_at, expires_at, used_by, used_at, revoked_at)
  on public.organization_invites to authenticated;

create policy "Dono vê os convites da oficina"
  on public.organization_invites for select to authenticated
  using (private.is_org_owner(organization_id));
create policy "MFA confirmado quando ativo"
  on public.organization_invites as restrictive for all to authenticated
  using (private.mfa_ok()) with check (private.mfa_ok());
-- invite_attempts: sem regras = ninguém lê nem escreve a partir da app


-- ---------------------------------------------------------------------
-- 2. Funções internas
-- ---------------------------------------------------------------------

-- Normaliza o código: maiúsculas, sem espaços nem traços
create function private.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function private.invite_code_hash(p_code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.sha256(convert_to('revyauto-convite:' || private.normalize_invite_code(p_code), 'UTF8'));
$$;

revoke all on function private.normalize_invite_code(text) from public, anon, authenticated;
revoke all on function private.invite_code_hash(text)      from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Criar um convite (só o Dono)
--    Devolve o código em claro UMA vez, no formato XXXX-XXXX-XXXX.
-- ---------------------------------------------------------------------
create function public.create_invite(p_organization_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Sem 0/O, 1/I/L, para não haver confusões ao ditar o código
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_user_id  uuid := (select auth.uid());
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

  if (select count(*) from public.organization_invites i
      where i.organization_id = p_organization_id
        and i.used_at is null and i.revoked_at is null and i.expires_at > now()) >= 10 then
    raise exception 'Já tem 10 convites por usar. Cancele algum antes de criar outro.' using errcode = '22023';
  end if;

  if (select count(*) from public.organization_members m where m.organization_id = p_organization_id) >= 25 then
    raise exception 'A oficina atingiu o limite de 25 pessoas.' using errcode = '22023';
  end if;

  -- 12 caracteres aleatórios (≈ 59 bits), a partir de dois UUID aleatórios
  v_bytes := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  for i in 0..11 loop
    v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;

  insert into public.organization_invites (organization_id, code_hash, role, created_by, expires_at)
  values (p_organization_id, private.invite_code_hash(v_raw), 'member', v_user_id, v_expires);

  code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
  expires_at := v_expires;
  return next;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Cancelar um convite ainda não usado (só o Dono)
-- ---------------------------------------------------------------------
create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if not private.mfa_ok() then
    raise exception 'Confirme primeiro o código de autenticação em dois passos.' using errcode = '42501';
  end if;

  select i.organization_id into v_org from public.organization_invites i where i.id = p_invite_id;
  if v_org is null or not private.is_org_owner(v_org) then
    raise exception 'Convite não encontrado.' using errcode = '42501';
  end if;

  update public.organization_invites
     set revoked_at = now()
   where id = p_invite_id and used_at is null and revoked_at is null;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Aceitar um convite
--    Devolve o id da oficina, ou NULL se o código não for válido
--    (não diz porquê, para não ajudar quem tenta adivinhar).
--    Não lança erro nesse caso, para que a tentativa fique registada.
-- ---------------------------------------------------------------------
create function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
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

  select * into v_invite
    from public.organization_invites i
   where i.code_hash = private.invite_code_hash(p_code)
     and i.used_at is null and i.revoked_at is null and i.expires_at > now()
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

  -- Uma entrada bem-sucedida limpa as tentativas anteriores
  delete from public.invite_attempts where user_id = v_user_id;

  return v_invite.organization_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Lista da equipa (qualquer membro da oficina)
--    O email vem de auth.users, que a app não consegue ler diretamente.
-- ---------------------------------------------------------------------
create function public.list_team(p_organization_id uuid)
returns table (user_id uuid, full_name text, email text, role public.organization_role, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.mfa_ok() or not private.is_org_member(p_organization_id) then
    raise exception 'Sem acesso a esta oficina.' using errcode = '42501';
  end if;

  return query
    select m.user_id, p.full_name, u.email::text, m.role, m.created_at
      from public.organization_members m
      join public.profiles p on p.id = m.user_id
      join auth.users u on u.id = m.user_id
     where m.organization_id = p_organization_id
     order by (m.role = 'owner') desc, m.created_at;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Remover um Funcionário (só o Dono; Donos não podem ser removidos)
-- ---------------------------------------------------------------------
create function public.remove_member(p_organization_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.organization_role;
begin
  if not private.mfa_ok() or not private.is_org_owner(p_organization_id) then
    raise exception 'Só o Dono da oficina pode remover pessoas.' using errcode = '42501';
  end if;

  select m.role into v_role from public.organization_members m
   where m.organization_id = p_organization_id and m.user_id = p_user_id;

  if v_role is null then
    raise exception 'Esta pessoa não pertence à oficina.' using errcode = '22023';
  end if;
  if v_role = 'owner' then
    raise exception 'Não é possível remover o Dono da oficina.' using errcode = '22023';
  end if;

  delete from public.organization_members
   where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Sair da oficina (Funcionário). O Dono não pode sair.
-- ---------------------------------------------------------------------
create function public.leave_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role    public.organization_role;
begin
  if v_user_id is null or not private.mfa_ok() then
    raise exception 'É necessário ter sessão iniciada.' using errcode = '42501';
  end if;

  select m.role into v_role from public.organization_members m
   where m.organization_id = p_organization_id and m.user_id = v_user_id;

  if v_role is null then
    raise exception 'Não pertence a esta oficina.' using errcode = '22023';
  end if;
  if v_role = 'owner' then
    raise exception 'O Dono não pode sair da oficina.' using errcode = '22023';
  end if;

  delete from public.organization_members
   where organization_id = p_organization_id and user_id = v_user_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Permissões das funções
-- ---------------------------------------------------------------------
revoke all on function public.create_invite(uuid)              from public, anon;
revoke all on function public.revoke_invite(uuid)              from public, anon;
revoke all on function public.accept_invite(text)              from public, anon;
revoke all on function public.list_team(uuid)                  from public, anon;
revoke all on function public.remove_member(uuid, uuid)        from public, anon;
revoke all on function public.leave_organization(uuid)         from public, anon;
grant execute on function public.create_invite(uuid)           to authenticated;
grant execute on function public.revoke_invite(uuid)           to authenticated;
grant execute on function public.accept_invite(text)           to authenticated;
grant execute on function public.list_team(uuid)               to authenticated;
grant execute on function public.remove_member(uuid, uuid)     to authenticated;
grant execute on function public.leave_organization(uuid)      to authenticated;
