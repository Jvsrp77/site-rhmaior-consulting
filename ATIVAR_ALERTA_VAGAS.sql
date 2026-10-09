-- RHMaior Consulting — alerta de novas vagas por e-mail
-- Seguro para executar mais de uma vez. Não apaga tabelas, dados ou políticas existentes
-- e NÃO altera a chave do Resend já configurada pelo ATIVAR_NOTIFICACOES_EMAIL.sql.
--
-- O QUE ISSO FAZ:
--  1. A pessoa se cadastra na página de vagas (e-mail + área + unidade).
--  2. Ela recebe um e-mail pedindo para CONFIRMAR o cadastro (evita que alguém
--     cadastre o e-mail de outra pessoa).
--  3. Quando uma vaga compatível é publicada no Painel RH, quem confirmou recebe
--     um e-mail com o link da vaga e um link para cancelar os avisos.
--
-- ANTES DE RODAR:
--  - Rode primeiro o ATIVAR_NOTIFICACOES_EMAIL.sql (cria a tabela de configuração
--    e guarda a chave do Resend). Sem a chave, este script funciona mas nenhum
--    e-mail é enviado.
--  - IMPORTANTE: com o remetente de testes do Resend (onboarding@resend.dev) os
--    e-mails só chegam para o dono da conta Resend. Para enviar aos candidatos é
--    preciso verificar um domínio próprio no Resend (Domains) e trocar o valor
--    'from_email' abaixo/na tabela notification_settings, por exemplo
--    'RHMaior <vagas@maiorh.com.br>'.

create extension if not exists pg_net;
create extension if not exists pgcrypto;
create extension if not exists unaccent schema extensions;

create table if not exists public.notification_settings (
  key text primary key,
  value text not null
);
alter table public.notification_settings enable row level security;

-- Endereço público do site (usado nos links dos e-mails). Não sobrescreve se já existir.
insert into public.notification_settings (key, value) values
  ('site_url', 'https://glowing-pithivier-f2a82e.netlify.app')
on conflict (key) do nothing;

-- ============================================================
-- 1) TABELA DE ASSINANTES
-- ============================================================
create table if not exists public.alertas_vagas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  area text,                          -- palavra-chave da área; nulo = qualquer área
  unidade text,                       -- cidade da unidade; nulo = qualquer unidade
  token uuid not null default gen_random_uuid(),
  confirmado boolean not null default false,
  ativo boolean not null default true,
  consentimento boolean not null,
  created_at timestamptz not null default now(),
  constraint alertas_vagas_consentimento_ok check (consentimento = true),
  constraint alertas_vagas_email_ok check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160)
);
create unique index if not exists alertas_vagas_token_idx on public.alertas_vagas (token);
create unique index if not exists alertas_vagas_unico_idx
  on public.alertas_vagas (lower(email), coalesce(area, ''), coalesce(unidade, ''));

alter table public.alertas_vagas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alertas_vagas' and policyname='Cadastro público de alertas') then
    create policy "Cadastro público de alertas" on public.alertas_vagas
      for insert to anon with check (consentimento = true and confirmado = false and ativo = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alertas_vagas' and policyname='Equipe autenticada gerencia alertas') then
    create policy "Equipe autenticada gerencia alertas" on public.alertas_vagas
      for all to authenticated using (true) with check (true);
  end if;
end $$;
-- Nenhuma política de leitura para anon: a lista de e-mails nunca fica exposta ao site.

-- ============================================================
-- 2) CONFIRMAR / CANCELAR (chamadas pelas páginas alerta.html)
-- ============================================================
create or replace function public.confirmar_alerta(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare linhas int;
begin
  update public.alertas_vagas set confirmado = true, ativo = true where token = p_token;
  get diagnostics linhas = row_count;
  return linhas > 0;
end;
$$;

create or replace function public.cancelar_alerta(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare linhas int;
begin
  update public.alertas_vagas set ativo = false where token = p_token;
  get diagnostics linhas = row_count;
  return linhas > 0;
end;
$$;

revoke all on function public.confirmar_alerta(uuid) from public;
revoke all on function public.cancelar_alerta(uuid) from public;
grant execute on function public.confirmar_alerta(uuid) to anon, authenticated;
grant execute on function public.cancelar_alerta(uuid) to anon, authenticated;

-- ============================================================
-- 3) E-MAIL DE CONFIRMAÇÃO (ao se cadastrar)
-- ============================================================
create or replace function public.html_escape(texto text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(coalesce(texto, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

create or replace function public.enviar_confirmacao_alerta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  from_addr text;
  site text;
  link text;
begin
  select value into api_key   from public.notification_settings where key = 'resend_api_key';
  select value into from_addr from public.notification_settings where key = 'from_email';
  select value into site      from public.notification_settings where key = 'site_url';

  if api_key is null or api_key = 'COLE_SUA_CHAVE_RESEND_AQUI' or from_addr is null then
    return new; -- e-mail ainda não configurado: o cadastro fica salvo, sem aviso
  end if;

  link := rtrim(site, '/') || '/alerta.html?acao=confirmar&token=' || new.token;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', from_addr,
      'to', jsonb_build_array(new.email),
      'subject', 'Confirme seu alerta de vagas — RHMaior Consulting',
      'html',
        '<p>Olá!</p>' ||
        '<p>Recebemos o pedido para avisar você sobre novas vagas da RHMaior Consulting' ||
        case when new.area is not null then ' na área <b>' || public.html_escape(new.area) || '</b>' else '' end ||
        case when new.unidade is not null then ' (unidade <b>' || public.html_escape(new.unidade) || '</b>)' else '' end ||
        '.</p>' ||
        '<p><a href="' || link || '">Clique aqui para confirmar o cadastro</a></p>' ||
        '<p style="color:#666;font-size:13px">Se não foi você, ignore este e-mail: nada será enviado sem a confirmação.</p>'
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_confirmacao_alerta on public.alertas_vagas;
create trigger trg_confirmacao_alerta
  after insert on public.alertas_vagas
  for each row execute function public.enviar_confirmacao_alerta();

-- ============================================================
-- 4) AVISO DE VAGA NOVA (quando uma vaga é publicada)
-- ============================================================
create or replace function public.avisar_vaga_nova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  from_addr text;
  site text;
  assinante record;
begin
  if new.ativa is not true then return new; end if;
  if TG_OP = 'UPDATE' and old.ativa is true then return new; end if; -- só quando passa a ficar ativa

  select value into api_key   from public.notification_settings where key = 'resend_api_key';
  select value into from_addr from public.notification_settings where key = 'from_email';
  select value into site      from public.notification_settings where key = 'site_url';

  if api_key is null or api_key = 'COLE_SUA_CHAVE_RESEND_AQUI' or from_addr is null then
    return new;
  end if;

  for assinante in
    select email, token from public.alertas_vagas
    where confirmado and ativo
      and (area is null
           or extensions.unaccent(lower(coalesce(new.area, '') || ' ' || coalesce(new.titulo, '')))
              like '%' || extensions.unaccent(lower(area)) || '%')
      and (unidade is null
           or new.modalidade = 'Remoto'
           or extensions.unaccent(lower(coalesce(new.cidade, ''))) like '%' || extensions.unaccent(lower(unidade)) || '%')
    limit 90
  loop
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', from_addr,
        'to', jsonb_build_array(assinante.email),
        'subject', 'Nova vaga: ' || coalesce(new.titulo, 'oportunidade') || ' — RHMaior Consulting',
        'html',
          '<p><strong>Nova vaga publicada</strong></p>' ||
          '<p><b>' || public.html_escape(new.titulo) || '</b><br>' ||
          public.html_escape(new.area) || ' · ' || public.html_escape(new.modalidade) || ' · ' || public.html_escape(new.cidade) || '</p>' ||
          case when new.resumo is not null and new.resumo <> '' then '<p>' || public.html_escape(new.resumo) || '</p>' else '' end ||
          '<p><a href="' || rtrim(site, '/') || '/vaga.html?id=' || new.id || '">Ver a vaga e se candidatar</a></p>' ||
          '<hr><p style="color:#666;font-size:12px">Você recebe este aviso porque cadastrou um alerta de vagas. ' ||
          '<a href="' || rtrim(site, '/') || '/alerta.html?acao=cancelar&token=' || assinante.token || '">Cancelar avisos</a></p>'
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_avisar_vaga_nova on public.vagas;
create trigger trg_avisar_vaga_nova
  after insert or update of ativa on public.vagas
  for each row execute function public.avisar_vaga_nova();

-- Verificação: deve listar 2 gatilhos e a tabela alertas_vagas.
select trigger_name, event_object_table
from information_schema.triggers
where trigger_name in ('trg_confirmacao_alerta', 'trg_avisar_vaga_nova');
