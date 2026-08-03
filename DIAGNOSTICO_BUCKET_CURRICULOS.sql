-- MaioRH — diagnóstico e correção do bucket de currículos
-- Pode ser executado mais de uma vez com segurança. Não apaga arquivos,
-- candidatos, tabelas ou políticas existentes.
--
-- Motivo provável do erro "O PDF não pôde ser armazenado. Verifique a
-- política de upload do bucket curriculos.": os scripts anteriores
-- (CORRECAO_ENVIO_CURRICULO.sql e supabase_setup.sql) criam apenas a
-- POLÍTICA de upload, mas nunca criam o BUCKET em si. Se o bucket
-- "curriculos" nunca foi criado manualmente em Storage no painel do
-- Supabase, o upload falha mesmo com a política correta.

-- 1) Garante que o bucket existe, é público (necessário para o link do
--    currículo funcionar) e aceita PDFs de até 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos', 'curriculos', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

-- 2) Garante a política de upload (mesma lógica já usada nos scripts
--    anteriores, reaplicada aqui por segurança).
drop policy if exists "Currículos PDF podem ser enviados" on storage.objects;

create policy "Currículos PDF podem ser enviados"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'curriculos'
    and lower(storage.extension(name)) = 'pdf'
  );

-- 3) Leitura pública dos arquivos do bucket (necessária para o link do
--    currículo abrir no painel RH e nas notificações da equipe).
drop policy if exists "Currículos PDF podem ser lidos publicamente" on storage.objects;

create policy "Currículos PDF podem ser lidos publicamente"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'curriculos');

notify pgrst, 'reload schema';

-- Depois de executar: envie um currículo de teste pelo site. Se o erro
-- persistir, abra Storage > curriculos no painel do Supabase e confirme
-- que o bucket aparece marcado como "Public".
