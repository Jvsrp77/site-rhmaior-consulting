-- RHMaior Consulting — aviso automático por e-mail de novos candidatos e leads
-- Seguro para executar mais de uma vez. Não apaga tabelas, dados ou políticas existentes.
--
-- O QUE ISSO FAZ: sempre que alguém se cadastra no banco de talentos
-- (tabela candidatos) ou uma empresa entra em contato (tabela
-- leads_empresas), o próprio banco de dados dispara um e-mail para você,
-- usando o serviço Resend (https://resend.com). Não depende de nenhum
-- servidor externo além do Resend — roda dentro do Supabase.
--
-- ANTES DE RODAR ESTE SCRIPT:
-- 1. Crie uma conta gratuita em https://resend.com (o plano free permite
--    3.000 e-mails/mês, mais do que suficiente para começar).
-- 2. Em "API Keys", crie uma chave e copie o valor (começa com "re_").
-- 3. Em "Domains", você pode usar o domínio de testes do Resend
--    (algo como "onboarding@resend.dev") enquanto não configura um
--    domínio próprio verificado.
-- 4. Substitua os três valores no bloco INSERT abaixo antes de rodar:
--    - 'COLE_SUA_CHAVE_RESEND_AQUI'   -> a chave de API do Resend
--    - 'seuemail@rhmaior.com.br'      -> para onde os avisos devem chegar
--    - 'onboarding@resend.dev'        -> remetente (use o domínio de
--                                        testes do Resend até configurar
--                                        um domínio verificado)

create extension if not exists pg_net;

create table if not exists public.notification_settings (
  key text primary key,
  value text not null
);
alter table public.notification_settings enable row level security;
-- Nenhuma política é criada de propósito: isso bloqueia qualquer acesso
-- via anon/authenticated (front-end). Só funções internas do banco,
-- rodando com privilégio elevado, conseguem ler esta tabela.

insert into public.notification_settings (key, value) values
  ('resend_api_key', 'COLE_SUA_CHAVE_RESEND_AQUI'),
  ('notify_email', 'seuemail@rhmaior.com.br'),
  ('from_email', 'onboarding@resend.dev')
on conflict (key) do update set value = excluded.value;

create or replace function public.notify_new_lead_or_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  notify_to text;
  from_addr text;
  subject text;
  body_html text;
begin
  select value into api_key   from public.notification_settings where key = 'resend_api_key';
  select value into notify_to from public.notification_settings where key = 'notify_email';
  select value into from_addr from public.notification_settings where key = 'from_email';

  if api_key is null or api_key = 'COLE_SUA_CHAVE_RESEND_AQUI' or notify_to is null then
    return new; -- ainda não configurado: não faz nada, não gera erro
  end if;

  if TG_TABLE_NAME = 'candidatos' then
    subject := 'Novo candidato no banco de talentos: ' || coalesce(new.nome, 'sem nome');
    body_html :=
      '<p><strong>Novo candidato cadastrado.</strong></p>' ||
      '<p><b>Nome:</b> ' || coalesce(new.nome, '-') || '<br>' ||
      '<b>E-mail:</b> ' || coalesce(new.email, '-') || '<br>' ||
      '<b>Telefone:</b> ' || coalesce(new.telefone, '-') || '<br>' ||
      '<b>Área de interesse:</b> ' || coalesce(new.vaga_interesse, '-') || '</p>';
  elsif TG_TABLE_NAME = 'leads_empresas' then
    subject := 'Nova empresa interessada: ' || coalesce(new.empresa, 'sem nome');
    body_html :=
      '<p><strong>Nova empresa entrou em contato.</strong></p>' ||
      '<p><b>Empresa:</b> ' || coalesce(new.empresa, '-') || '<br>' ||
      '<b>Contato:</b> ' || coalesce(new.nome_contato, '-') || '<br>' ||
      '<b>E-mail:</b> ' || coalesce(new.email_corporativo, '-') || '<br>' ||
      '<b>Telefone:</b> ' || coalesce(new.telefone_empresa, '-') || '<br>' ||
      '<b>Serviço de interesse:</b> ' || coalesce(new.servico_interesse, '-') || '<br>' ||
      '<b>Mensagem:</b> ' || coalesce(new.mensagem, '-') || '</p>';
  else
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', from_addr,
      'to', jsonb_build_array(notify_to),
      'subject', subject,
      'html', body_html
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_new_candidato on public.candidatos;
create trigger trg_notify_new_candidato
  after insert on public.candidatos
  for each row execute function public.notify_new_lead_or_candidate();

drop trigger if exists trg_notify_new_lead on public.leads_empresas;
create trigger trg_notify_new_lead
  after insert on public.leads_empresas
  for each row execute function public.notify_new_lead_or_candidate();

-- Verificação: deve retornar 2 linhas (uma para cada gatilho criado).
select trigger_name, event_object_table
from information_schema.triggers
where trigger_name in ('trg_notify_new_candidato', 'trg_notify_new_lead');
