-- MaioRH — ativação isolada do módulo de vagas
-- Seguro para executar mais de uma vez. Não apaga tabelas, dados ou políticas existentes.

create extension if not exists pgcrypto;

create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  area text not null,
  cidade text,
  modalidade text not null default 'Presencial',
  tipo text not null default 'Efetivo',
  resumo text,
  descricao text,
  responsabilidades text,
  requisitos text,
  salario text,
  validade date,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidaturas_vagas (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas(id) on delete cascade,
  candidato_email text not null,
  status text not null default 'nova',
  created_at timestamptz not null default now(),
  unique (vaga_id, candidato_email)
);

alter table public.vagas enable row level security;
alter table public.candidaturas_vagas enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vagas'
      and policyname = 'Vagas ativas são públicas'
  ) then
    create policy "Vagas ativas são públicas"
      on public.vagas for select to anon
      using (ativa = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vagas'
      and policyname = 'Equipe autenticada gerencia vagas'
  ) then
    create policy "Equipe autenticada gerencia vagas"
      on public.vagas for all to authenticated
      using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidaturas_vagas'
      and policyname = 'Candidatura pública pode ser criada'
  ) then
    create policy "Candidatura pública pode ser criada"
      on public.candidaturas_vagas for insert to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidaturas_vagas'
      and policyname = 'Equipe autenticada gerencia candidaturas'
  ) then
    create policy "Equipe autenticada gerencia candidaturas"
      on public.candidaturas_vagas for all to authenticated
      using (true) with check (true);
  end if;
end $$;

grant select on public.vagas to anon;
grant select, insert, update, delete on public.vagas to authenticated;
grant insert on public.candidaturas_vagas to anon;
grant select, insert, update, delete on public.candidaturas_vagas to authenticated;

notify pgrst, 'reload schema';

-- Verificação: as duas linhas abaixo devem retornar os nomes das tabelas.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('vagas', 'candidaturas_vagas')
order by table_name;
