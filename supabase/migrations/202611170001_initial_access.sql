-- IEV Avança | Etapa 1: identidade, empresas e acesso
-- Executar no SQL Editor do projeto Supabase com papel administrativo.
-- Não implementa agendamentos, audit trails, backup ou administração de usuários via UI.
-- Migração inicial apenas para projeto novo; revisar antes de reaplicar em banco existente.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) >= 2),
  responsavel_nome text,
  telefone text,
  email text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete restrict,
  empresa_id uuid references public.empresas(id) on delete restrict,
  nome text not null check (length(btrim(nome)) >= 2),
  email text not null,
  perfil text not null check (perfil in ('ADMIN_GERAL', 'ADMIN_EMPRESA', 'PARCEIRO', 'DESBLOQUEIO')),
  ativo boolean not null default true,
  troca_senha_pendente boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  constraint vinculo_empresa_por_perfil check (
    (perfil in ('ADMIN_GERAL', 'DESBLOQUEIO') and empresa_id is null)
    or (perfil in ('ADMIN_EMPRESA', 'PARCEIRO') and empresa_id is not null)
  )
);

create index if not exists usuarios_empresa_perfil_idx on public.usuarios(empresa_id, perfil);
create index if not exists usuarios_ativo_idx on public.usuarios(ativo);

-- Defesa em profundidade: RLS ativo e SEM políticas de leitura/escrita direta
-- nesta etapa. Apenas a função meu_perfil pode revelar os dados próprios mínimos.
alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
revoke all on table public.empresas from anon, authenticated;
revoke all on table public.usuarios from anon, authenticated;

-- Atualização de timestamp nas alterações feitas por administradores/servidor.
create or replace function public.atualizar_timestamp_ieva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists empresas_atualizado_em on public.empresas;
create trigger empresas_atualizado_em
before update on public.empresas
for each row execute function public.atualizar_timestamp_ieva();

drop trigger if exists usuarios_atualizado_em on public.usuarios;
create trigger usuarios_atualizado_em
before update on public.usuarios
for each row execute function public.atualizar_timestamp_ieva();

-- O sinalizador da senha provisória não pode ser desligado pela interface.
-- Uma alteração efetiva do hash no Supabase Auth libera o primeiro acesso.
-- No futuro, qualquer redefinição ADMINISTRATIVA de senha provisória deverá
-- marcar troca_senha_pendente=true DEPOIS de mudar a senha no Auth.
create or replace function public.sincronizar_auth_ieva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and new.encrypted_password is not null then
    update public.usuarios
       set troca_senha_pendente = false
     where id = new.id and troca_senha_pendente = true;
  end if;

  if new.email is distinct from old.email and new.email is not null then
    update public.usuarios
       set email = new.email
     where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists ieva_auth_usuario_atualizado on auth.users;
create trigger ieva_auth_usuario_atualizado
  after update of encrypted_password, email on auth.users
  for each row execute function public.sincronizar_auth_ieva();

-- Função de leitura de perfil limitada ao auth.uid() recebido do Supabase.
-- Ela não aceita IDs de usuários por argumento; não há listagem de terceiros.
create or replace function public.meu_perfil()
returns table (
  id uuid,
  nome text,
  email text,
  perfil text,
  empresa_id uuid,
  empresa_nome text,
  ativo boolean,
  empresa_ativa boolean,
  troca_senha_pendente boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nome, u.email, u.perfil, u.empresa_id,
         e.nome as empresa_nome, u.ativo,
         case when u.empresa_id is null then true else coalesce(e.ativa, false) end as empresa_ativa,
         u.troca_senha_pendente
  from public.usuarios as u
  left join public.empresas as e on e.id = u.empresa_id
  where u.id = (select auth.uid())
  limit 1;
$$;

-- Funções de gatilho não devem poder ser chamadas pela API.
revoke all on function public.atualizar_timestamp_ieva() from public, anon, authenticated;
revoke all on function public.sincronizar_auth_ieva() from public, anon, authenticated;
revoke all on function public.meu_perfil() from public, anon, authenticated;
grant execute on function public.meu_perfil() to authenticated;

comment on function public.meu_perfil() is
  'Perfil próprio mínimo, sem leitura direta de usuarios/empresas; revalida ativo e empresa_ativa.';
