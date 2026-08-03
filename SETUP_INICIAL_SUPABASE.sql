-- MaioRH — configuração inicial completa do Supabase
--
-- Use este script assim que criar o projeto novo no Supabase (é o único
-- que você precisa rodar para começar do zero). Os outros arquivos .sql
-- desta pasta (ATIVAR_MODULO_VAGAS.sql, CORRECAO_*.sql, DIAGNOSTICO_*.sql,
-- supabase_setup.sql) vieram do histórico do projeto irmão (América) e
-- não são necessários aqui — este script já inclui tudo o que eles fazem.
--
-- Como usar:
--   1. Crie o projeto em https://supabase.com (novo projeto, região Brasil
--      se disponível).
--   2. Copie a "Project URL" e a chave "anon public" em
--      Project Settings > API e me envie as duas.
--   3. Abra o SQL Editor do projeto e cole este script inteiro. Rode uma
--      única vez (é seguro rodar de novo, ele não apaga nada existente).
--   4. Em Authentication > Users, crie manualmente o usuário (e-mail e
--      senha) que a equipe vai usar para entrar no Painel RH. O site não
--      cria contas de administrador sozinho.
--
-- Idempotente: pode ser executado mais de uma vez sem apagar tabelas,
-- colunas, dados ou políticas já existentes.

create extension if not exists pgcrypto;

-- ============================================================
-- 1) TABELAS
-- ============================================================

create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  telefone text,
  vaga_interesse text,
  url_curriculo text,
  status_processo text default 'novo',
  tags text,
  observacoes text,
  consentimento_lgpd boolean default false,
  data_consentimento timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.leads_empresas (
  id uuid primary key default gen_random_uuid(),
  nome_contato text not null,
  empresa text not null,
  email_corporativo text not null,
  telefone_empresa text,
  servico_interesse text,
  mensagem text,
  status text default 'novo',
  quantidade_vagas integer,
  urgencia text,
  localidade text,
  modalidade text,
  created_at timestamptz not null default now()
);

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

-- ============================================================
-- 2) BUCKET DE CURRÍCULOS (Storage)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos', 'curriculos', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

-- ============================================================
-- 3) FUNÇÃO DE CADASTRO PÚBLICO CONTROLADO
--    (usada pelo formulário de currículo da home)
-- ============================================================

create or replace function public.registrar_candidato_publico(
  p_nome text,
  p_email text,
  p_telefone text,
  p_vaga_interesse text,
  p_url_curriculo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_normalizado text := lower(trim(p_email));
begin
  if length(trim(p_nome)) < 3 then
    raise exception 'Nome inválido';
  end if;
  if email_normalizado !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido';
  end if;
  if p_url_curriculo not like 'https://SEU-PROJETO.supabase.co/storage/v1/object/public/curriculos/%' then
    raise exception 'Endereço de currículo inválido';
  end if;

  update public.candidatos
     set nome = trim(p_nome),
         telefone = trim(p_telefone),
         vaga_interesse = p_vaga_interesse,
         url_curriculo = p_url_curriculo,
         consentimento_lgpd = true,
         data_consentimento = now()
   where lower(email) = email_normalizado;

  if not found then
    insert into public.candidatos
      (nome, email, telefone, vaga_interesse, url_curriculo, consentimento_lgpd, data_consentimento)
    values
      (trim(p_nome), email_normalizado, trim(p_telefone), p_vaga_interesse, p_url_curriculo, true, now());
  end if;
end;
$$;

revoke all on function public.registrar_candidato_publico(text, text, text, text, text) from public;
grant execute on function public.registrar_candidato_publico(text, text, text, text, text) to anon, authenticated;

-- ============================================================
-- 4) RLS (Row Level Security)
-- ============================================================

alter table public.candidatos enable row level security;
alter table public.leads_empresas enable row level security;
alter table public.vagas enable row level security;
alter table public.candidaturas_vagas enable row level security;

do $$ begin
  -- candidatos: cadastro público (form da home usa a função acima, mas o
  -- formulário de candidatura em uma vaga específica grava direto na
  -- tabela) + leitura/gestão pela equipe autenticada.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidatos' and policyname='Cadastro público de candidatos') then
    create policy "Cadastro público de candidatos" on public.candidatos for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidatos' and policyname='Atualização pública de candidatos') then
    create policy "Atualização pública de candidatos" on public.candidatos for update to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidatos' and policyname='Equipe autenticada gerencia candidatos') then
    create policy "Equipe autenticada gerencia candidatos" on public.candidatos for all to authenticated using (true) with check (true);
  end if;

  -- leads_empresas: qualquer visitante pode enviar um contato; só a
  -- equipe autenticada lê e atualiza o status.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leads_empresas' and policyname='Cadastro público de leads') then
    create policy "Cadastro público de leads" on public.leads_empresas for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leads_empresas' and policyname='Equipe autenticada gerencia leads') then
    create policy "Equipe autenticada gerencia leads" on public.leads_empresas for all to authenticated using (true) with check (true);
  end if;

  -- vagas: só as ativas ficam públicas; equipe autenticada gerencia tudo.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='vagas' and policyname='Vagas ativas são públicas') then
    create policy "Vagas ativas são públicas" on public.vagas for select to anon using (ativa = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='vagas' and policyname='Equipe autenticada gerencia vagas') then
    create policy "Equipe autenticada gerencia vagas" on public.vagas for all to authenticated using (true) with check (true);
  end if;

  -- candidaturas_vagas: qualquer visitante pode se candidatar; equipe
  -- autenticada gerencia tudo.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidaturas_vagas' and policyname='Candidatura pública pode ser criada') then
    create policy "Candidatura pública pode ser criada" on public.candidaturas_vagas for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidaturas_vagas' and policyname='Equipe autenticada gerencia candidaturas') then
    create policy "Equipe autenticada gerencia candidaturas" on public.candidaturas_vagas for all to authenticated using (true) with check (true);
  end if;

  -- storage: upload e leitura pública de PDFs no bucket curriculos.
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Currículos PDF podem ser enviados') then
    create policy "Currículos PDF podem ser enviados" on storage.objects for insert to anon, authenticated with check (bucket_id = 'curriculos' and lower(storage.extension(name)) = 'pdf');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Currículos PDF podem ser lidos publicamente') then
    create policy "Currículos PDF podem ser lidos publicamente" on storage.objects for select to anon, authenticated using (bucket_id = 'curriculos');
  end if;
end $$;

grant insert (nome, email, telefone, vaga_interesse, url_curriculo, consentimento_lgpd, data_consentimento) on public.candidatos to anon;
grant update (nome, email, telefone, vaga_interesse, url_curriculo, consentimento_lgpd, data_consentimento) on public.candidatos to anon;
grant all on public.candidatos to authenticated;
grant insert on public.leads_empresas to anon;
grant all on public.leads_empresas to authenticated;
grant select on public.vagas to anon;
grant all on public.vagas to authenticated;
grant insert on public.candidaturas_vagas to anon;
grant all on public.candidaturas_vagas to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- IMPORTANTE: depois de rodar este script, troque
-- "SEU-PROJETO.supabase.co" acima (dentro da função
-- registrar_candidato_publico) pela URL real do seu projeto e rode de
-- novo só o bloco "create or replace function" para atualizar.
-- ============================================================
