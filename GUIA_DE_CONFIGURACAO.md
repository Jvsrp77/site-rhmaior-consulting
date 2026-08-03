# MaioRH — ativação dos novos recursos

O site e o painel continuam funcionando com as tabelas atuais. Os módulos novos usam uma expansão opcional do Supabase.

## O que já funciona sem configuração adicional

- Site institucional, soluções, cases por contexto, FAQ e página de privacidade.
- Cadastro tradicional no banco de talentos.
- Contatos de empresas.
- Login e consulta dos candidatos já existentes.

## O que precisa da expansão do banco

- Publicação e gestão de vagas.
- Candidaturas vinculadas a uma vaga.
- Funil de candidatos.
- Etiquetas e observações internas.
- Status dos leads empresariais.
- Registro de consentimento LGPD e qualificação comercial ampliada.

Para ativar apenas a publicação e as candidaturas de vagas, use o arquivo `ATIVAR_MODULO_VAGAS.sql`. Ele cria somente as tabelas `vagas` e `candidaturas_vagas`, com leitura pública limitada às vagas ativas e gerenciamento reservado aos usuários autenticados do painel.

## Como ativar

1. Faça um backup do projeto Supabase.
2. Abra o **SQL Editor** no Supabase.
3. Revise o arquivo `supabase_setup.sql`.
4. Execute primeiro em um ambiente de teste, se disponível.
5. Confirme que somente os usuários autorizados conseguem entrar no painel.
6. Teste criação de vaga, atualização de candidato e alteração de lead.

### Correção para substituir um currículo já cadastrado

O arquivo `supabase_setup.sql` agora cria a função controlada `registrar_candidato_publico`. Ela resolve o erro apresentado quando uma pessoa usa novamente o mesmo e-mail para enviar um currículo atualizado.

Se desejar corrigir somente o envio de currículos, execute o arquivo `CORRECAO_ENVIO_CURRICULO.sql`. Ele também libera o upload de PDF para visitantes e para usuários autenticados no painel, sempre limitado ao bucket `curriculos`.

**Erro "O PDF não pôde ser armazenado":** os scripts acima só configuram a política de upload — eles não criam o bucket `curriculos` em si. Se esse bucket nunca foi criado manualmente em Storage no painel do Supabase, o upload falha mesmo com a política certa. Execute `DIAGNOSTICO_BUCKET_CURRICULOS.sql` para criar o bucket (público, aceitando PDF até 10 MB) e reaplicar as políticas de upload e leitura.

A função não concede atualização pública na tabela `candidatos`: ela aceita somente os campos do formulário, valida o e-mail e exige que o currículo pertença ao bucket oficial do projeto. Depois de executar o SQL, atualize a página do site antes de testar novamente.

## Como acessar o painel RH

1. Abra `painel_rh.html` ou, depois da publicação, acesse `https://seu-dominio/painel_rh.html`.
2. Entre com um e-mail e uma senha cadastrados em **Authentication > Users** no Supabase.
3. Caso a conta ainda não exista, crie o usuário no painel do Supabase e mantenha a confirmação automática somente se isso estiver de acordo com a política interna da empresa.
4. O site não contém senha padrão e não cria usuários administrativos pelo navegador.

Em produção, restrinja as políticas RLS às contas autorizadas e evite compartilhar diretamente o endereço do painel como se ele fosse uma proteção. A segurança efetiva deve permanecer no Supabase Auth e nas políticas do banco.

## Configuração do site

O arquivo `config.js` centraliza integrações que dependem dos dados oficiais da empresa. Preencha somente quando possuir os valores confirmados:

- `siteUrl`: endereço publicado, como `https://www.suaempresa.com.br`;
- `whatsappNumber`: número com DDI e DDD, apenas dígitos;
- `schedulingUrl`: link oficial de agendamento;
- `analyticsId`: identificador do Google Analytics, após configurar consentimento de cookies;
- `privacyEmail`: e-mail oficial para solicitações LGPD;
- `organization`: nome legal, cidade, estado, logo e LinkedIn.

Quando esses campos estão vazios, os recursos externos permanecem ocultos e nenhum dado fictício é exibido.

## Páginas individuais e Google Jobs

Cada vaga publicada recebe uma página em `vaga.html?id=IDENTIFICADOR`, com descrição, responsabilidades, requisitos e candidatura direta. Essa página gera dados estruturados `JobPosting` automaticamente.

Depois que o domínio estiver publicado:

1. preencha `siteUrl` em `config.js`;
2. valide algumas vagas no Rich Results Test do Google;
3. cadastre o domínio no Google Search Console;
4. gere um sitemap com as páginas individuais ativas;
5. remova ou desative vagas expiradas.

O script é incremental: não remove dados, tabelas, colunas ou políticas existentes. As políticas atuais das tabelas `candidatos` e `leads_empresas` permanecem responsáveis pelo controle de acesso.

## Identidade visual, SEO e cookies (adicionados)

- `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-512.png`, `favicon.ico` e `apple-touch-icon.png`: ícones gerados a partir da própria marca (o símbolo de três barras) para aba do navegador, atalhos e compartilhamento.
- `og-image.png`: imagem exibida quando o link do site é compartilhado no WhatsApp, LinkedIn etc. Todas essas referências já estão em `index.html` e no `site.webmanifest`.
- `sitemap.xml`: lista as páginas fixas do site. Troque `https://seu-dominio` pelo domínio oficial e adicione as vagas individuais conforme forem publicadas (ou automatize isso depois via uma function do Supabase).
- `robots.txt`: agora referencia o `sitemap.xml` e bloqueia a indexação de `painel_rh.html` (que também recebeu `<meta name="robots" content="noindex,nofollow">` diretamente no HTML).
- Banner de cookies: `index.html` exibe um aviso de consentimento antes de carregar o Google Analytics. O Analytics só é carregado após o clique em "Aceitar"; a escolha fica salva no navegador do visitante. Isso só entra em ação quando `analyticsId` for preenchido em `config.js`.

## Conteúdo que ainda depende da empresa

Para publicar prova social real, substitua os cases genéricos por resultados autorizados e forneça:

- logotipos de clientes com permissão de uso;
- depoimentos aprovados, com nome e cargo;
- indicadores reais de prazo, retenção ou volume;
- e-mail oficial para solicitações de privacidade;
- número oficial de WhatsApp;
- ferramenta ou link oficial para agendamento de reuniões.
