-- MaioRH — correção isolada do envio de currículos
-- Pode ser executada mais de uma vez. Não apaga candidatos ou currículos.
--
-- ATENÇÃO: troque "SEU-PROJETO.supabase.co" abaixo pela URL real do seu
-- projeto Supabase antes de executar (Project Settings > API > Project URL).

alter table public.candidatos add column if not exists consentimento_lgpd boolean default false;
alter table public.candidatos add column if not exists data_consentimento timestamptz;

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

drop policy if exists "Currículos PDF podem ser enviados" on storage.objects;

create policy "Currículos PDF podem ser enviados"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'curriculos'
    and lower(storage.extension(name)) = 'pdf'
  );

-- Confirma para a API que as novas funções estão disponíveis imediatamente.
notify pgrst, 'reload schema';
