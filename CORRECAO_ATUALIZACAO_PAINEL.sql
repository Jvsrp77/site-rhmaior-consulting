-- MaioRH — correção da atualização de candidatos e leads pelo painel
-- Pode ser executado mais de uma vez com segurança. Não apaga dados,
-- tabelas, colunas ou políticas existentes.
--
-- Motivo: o supabase_setup.sql concede permissão de COLUNA (grant update)
-- para status_processo/tags/observacoes em candidatos e status em
-- leads_empresas, mas isso não é suficiente. Com RLS (Row Level Security)
-- ativado, também é preciso uma política que libere a atualização de
-- LINHAS para a equipe autenticada. Sem essa política, o Supabase aceita
-- o pedido sem erro, mas não altera nenhuma linha — por isso o painel
-- mostra "Acompanhamento atualizado" e nada muda de verdade no banco.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidatos'
      and policyname = 'Equipe autenticada atualiza candidatos'
  ) then
    create policy "Equipe autenticada atualiza candidatos"
      on public.candidatos
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads_empresas'
      and policyname = 'Equipe autenticada atualiza leads'
  ) then
    create policy "Equipe autenticada atualiza leads"
      on public.leads_empresas
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';

-- Depois de executar: no Painel RH, abra um candidato, mude a etapa e
-- salve. O funil ("Etapas do processo") deve refletir a mudança assim
-- que você atualizar a página (F5).
