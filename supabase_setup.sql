-- MaioRH — expansão opcional do banco
-- Revise em um ambiente de teste antes de executar no SQL Editor do Supabase.
-- Este script não remove tabelas, colunas, dados ou políticas existentes.
--
-- ATENÇÃO: antes de executar, troque TODAS as ocorrências de
-- "SEU-PROJETO.supabase.co" abaixo pela URL real do seu projeto Supabase
-- (Project Settings > API > Project URL). Sem essa troca, o cadastro de
-- candidatos falha silenciosamente (o link do currículo nunca bate com
-- o endereço esperado).

create extension if not exists pgcrypto;

alter table public.candidatos add column if not exists status_processo text default 'novo';
alter table public.candidatos add column if not exists tags text;
alter table public.candidatos add column if not exists observacoes text;
alter table public.candidatos add column if not exists consentimento_lgpd boolean default false;
alter table public.candidatos add column if not exists data_consentimento timestamptz;

-- Entrada pública controlada: permite cadastrar ou substituir apenas os campos
-- enviados pelo formulário, sem conceder UPDATE direto à tabela para visitantes.
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
  if p_url_curriculo not like 'https://qaviuelxsokbdpllqrap.supabase.co/storage/v1/object/public/curriculos/%' then
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

-- Política mínima para receber PDFs. Não concede leitura da tabela candidatos.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Currículos PDF podem ser enviados'
  ) then
    create policy "Currículos PDF podem ser enviados"
      on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'curriculos' and lower(storage.extension(name)) = 'pdf');
  end if;
end $$;

alter table public.leads_empresas add column if not exists status text default 'novo';
alter table public.leads_empresas add column if not exists quantidade_vagas integer;
alter table public.leads_empresas add column if not exists urgencia text;
alter table public.leads_empresas add column if not exists localidade text;
alter table public.leads_empresas add column if not exists modalidade text;

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

alter table public.vagas add column if not exists descricao text;
alter table public.vagas add column if not exists responsabilidades text;
alter table public.vagas add column if not exists requisitos text;
alter table public.vagas add column if not exists salario text;
alter table public.vagas add column if not exists validade date;

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
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='vagas' and policyname='Vagas ativas são públicas') then
    create policy "Vagas ativas são públicas" on public.vagas for select to anon using (ativa = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='vagas' and policyname='Equipe autenticada gerencia vagas') then
    create policy "Equipe autenticada gerencia vagas" on public.vagas for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidaturas_vagas' and policyname='Candidatura pública pode ser criada') then
    create policy "Candidatura pública pode ser criada" on public.candidaturas_vagas for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='candidaturas_vagas' and policyname='Equipe autenticada gerencia candidaturas') then
    create policy "Equipe autenticada gerencia candidaturas" on public.candidaturas_vagas for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select on public.vagas to anon;
grant all on public.vagas to authenticated;
grant insert on public.candidaturas_vagas to anon;
grant all on public.candidaturas_vagas to authenticated;
grant update (status_processo, tags, observacoes) on public.candidatos to authenticated;
grant update (status) on public.leads_empresas to authenticated;

-- As políticas RLS já existentes de candidatos e leads continuam valendo.
-- Se a equipe autenticada não puder atualizar esses registros, crie políticas
-- específicas após revisar quais usuários podem acessar o painel administrativo.
