# Supabase (troca do Appwrite)

Decisão da Wellmix (11/11/2026): o banco definitivo é o Supabase. O Appwrite segue em produção até a virada; depois fica parado e intacto por algumas semanas como volta de segurança.

Projeto: **wellmix** (`rokbtrvkzllowyqzcauq`), região São Paulo (sa-east-1). Login: **Supabase Auth** (opção escolhida pela Wellmix): na virada, cada usuário define uma senha nova pelo link recebido por e-mail.

## Etapas

| #   | Etapa                                                                                                                                                                                                                                                                               | Situação |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Banco: `SupabaseStore` (PostgREST + Storage, chave service_role) e esquema gerado do `schema.ts` (`supabase/schema.sql`, `npm run supabase:sql`), com o botão "Publicar esquema Supabase"                                                                                           | feito    |
| 2   | Arquivos: envio direto do navegador ao Supabase Storage por link assinado (`createSignedUpload`, PUT com progresso); chave no formato dos ids do Appwrite, então as ações não mudam                                                                                                 | feito    |
| 3   | Login pelo Supabase Auth: o Supabase confere a senha, a sessão é o cookie assinado do portal; acesso novo cria a conta no Auth; "Esqueci minha senha" (/login/forgot) e "Definir nova senha" (/login/reset)                                                                         | feito    |
| 4   | Cópia Appwrite → Supabase na tela Configurações → Supabase (`src/lib/services/supabase-copy.ts`): tabelas com o mesmo id e datas, arquivos com a mesma chave e as contas no Supabase Auth; lotes de ~40 s com "Rodar até o fim"; "Recomeçar do zero" esvazia as tabelas do Supabase | feito    |
| 5   | Virada: janela sem uso, cópia, `DATA_MODE=supabase` na Vercel, publicar                                                                                                                                                                                                             | a fazer  |

## Como o banco fica

- Uma tabela por tabela do `schema.ts`, com `id` (texto), `createdAt` e `updatedAt`; colunas com o nome do portal (camelCase entre aspas).
- Tipos: texto → `text`; int → `bigint`; float → `double precision`; bool → `boolean`; data → `timestamptz`; json → `jsonb`. Sem NOT NULL além do id (linhas antigas do Appwrite podem ter obrigatórias vazias).
- RLS ligado em todas as tabelas e nenhuma política: só o servidor, com a chave service_role, lê e grava. Toda escrita continua passando por Server Action com zod e papel.
- `next_number(chave)`: contador atômico (número de pedido e de solicitação), só para service_role.
- Arquivos: bucket privado `arquivos` (50 MB por arquivo, como no Appwrite). Chave `<32 hex>_<nome>_<extensão>` (letras, números, "_" e "-", até 64 caracteres: o mesmo formato que as ações conferem nos ids do Appwrite); o nome do arquivo volta da chave. Arquivo grande: o servidor gera um link assinado (`/storage/v1/object/upload/sign`) e o navegador sobe direto com PUT, sem o limite de 4 MB da Vercel; depois a ação só registra o documento, conferindo tamanho e tipo.
- Datas voltam em ISO com "Z" (igual ao modo memória).

## Publicar o esquema

1. No Supabase: Project Settings → Database → Connection string (URI, modo Session) do projeto wellmix, com a senha do banco.
2. No GitHub: Settings → Secrets and variables → Actions → New secret `SUPABASE_DB_URL` com essa URI (no ambiente production ou no repositório). Ninguém precisa colar a senha em chat.
3. Actions → "Publicar esquema Supabase" → Run workflow. Só adiciona; rodar de novo não muda nada.

Toda mudança no `schema.ts` passa a exigir as duas publicações (Appwrite e Supabase) até a virada.

## Variáveis (Vercel, só na virada)

- `DATA_MODE=supabase`
- `SUPABASE_URL` (https://rokbtrvkzllowyqzcauq.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API; secreta, só servidor)

Sem `DATA_MODE=supabase` o portal continua no Appwrite.

## Login (Supabase Auth)

- `src/lib/auth/supabase-auth.ts`: conferir senha (`/auth/v1/token?grant_type=password`), criar e apagar conta (admin), mandar o link de senha (`/auth/v1/recover`) e gravar a nova senha com o token do link (`PUT /auth/v1/user`).
- Sessão: o mesmo cookie assinado do modo memória (`wm_session`, 7 dias). Segredo = `SESSION_SECRET`; sem ele, derivado da chave service_role (nunca o padrão de desenvolvimento). Conta desativada no portal perde o acesso na hora (a cada página o usuário é lido do banco).
- Acesso novo (Equipe/Parceiros): cria a conta no Supabase Auth com a senha que o admin definiu; se o cadastro do portal falhar, a conta é apagada.
- "Esqueci minha senha": `/login/forgot` manda o link; o link abre `/login/reset`, que lê o token (depois do "#", só no navegador) e grava a nova senha.

**Configurar no painel do Supabase antes da virada** (Authentication):

1. URL Configuration → Site URL = endereço de produção do portal; Redirect URLs = `https://<endereço>/login/reset` (e o dos previews da Vercel, se quiser testar lá).
2. E-mails: o envio padrão do Supabase só entrega para membros da equipe do projeto e com limite baixo por hora. Para mandar o link a todos os usuários, configure um SMTP próprio (Authentication → Emails → SMTP Settings, ex.: Resend, SendGrid ou o e-mail da empresa).
3. Templates (opcional): o texto do e-mail de "Reset password" em português.

As contas dos usuários de hoje são criadas na etapa 4 (cópia), e cada um recebe o link para definir a senha.

## Cópia e virada

Tela **Configurações → Supabase** (só admin; desligada quando o portal já está no Supabase). Usa as chaves do Appwrite e do Supabase que já estão na Vercel.

1. **Tabelas**: todas as do `schema.ts`, 500 linhas por lote, na ordem interna do Appwrite (cursor pelo id), gravadas com o mesmo id, `createdAt` e `updatedAt` (`upsertRaw`: rodar de novo atualiza, não duplica). A marcação da própria cópia (`settings.supabase.copy`) não vai.
2. **Arquivos**: o arquivo de cada documento vai para o Supabase Storage com a mesma chave (o que já está lá é pulado).
3. **Contas**: cada usuário ativo ganha a conta no Supabase Auth, sem senha.

O andamento fica em `settings.supabase.copy` (no Appwrite). "Recomeçar do zero" (palavra COPIAR) esvazia as tabelas do Supabase e zera o andamento; o Appwrite não é tocado.

**Roteiro da virada**

1. Antes: configurar no Supabase as URLs de retorno e o SMTP (seção Login) e fazer uma cópia de ensaio (dá para conferir os números por tabela).
2. Janela sem uso do portal (avisar a equipe).
3. "Recomeçar do zero" e "Rodar até o fim" até Concluída (cópia final, sem nada de ensaio sobrando).
4. Na Vercel: `DATA_MODE=supabase` e publicar de novo (Redeploy).
5. Conferir login, pedidos, estoque e um download de arquivo. Cada pessoa usa "Esqueci minha senha" no primeiro acesso para definir a senha (ou o admin pede o link por ela).
6. Se algo der errado: tirar `DATA_MODE` na Vercel e publicar de novo; o portal volta ao Appwrite intacto.
