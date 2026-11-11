# Supabase (troca do Appwrite)

Decisão da Wellmix (11/11/2026): o banco definitivo é o Supabase. O Appwrite segue em produção até a virada; depois fica parado e intacto por algumas semanas como volta de segurança.

Projeto: **wellmix** (`rokbtrvkzllowyqzcauq`), região São Paulo (sa-east-1). Login: **Supabase Auth** (opção escolhida pela Wellmix): na virada, cada usuário define uma senha nova pelo link recebido por e-mail.

## Etapas

| #   | Etapa                                                                                                                                                                                     | Situação |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Banco: `SupabaseStore` (PostgREST + Storage, chave service_role) e esquema gerado do `schema.ts` (`supabase/schema.sql`, `npm run supabase:sql`), com o botão "Publicar esquema Supabase" | feito    |
| 2   | Arquivos: envio direto do navegador ao Supabase Storage por link assinado (`createSignedUpload`, PUT com progresso); chave no formato dos ids do Appwrite, então as ações não mudam       | feito    |
| 3   | Login pelo Supabase Auth: contas criadas na virada, convite/troca de senha por e-mail, sessão em cookie                                                                                   | a fazer  |
| 4   | Cópia Appwrite → Supabase: todas as tabelas com o mesmo id e as datas de origem (`upsertRaw`), arquivos e contadores; pode rodar de novo                                                  | a fazer  |
| 5   | Virada: janela sem uso, cópia, `DATA_MODE=supabase` na Vercel, publicar                                                                                                                   | a fazer  |

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
