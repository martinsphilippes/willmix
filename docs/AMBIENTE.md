# Ambiente

## Conexões

| Serviço  | Estado                        | Observações                                                                 |
| -------- | ----------------------------- | --------------------------------------------------------------------------- |
| GitHub   | conectado                     | `martinsphilippes/willmix`. CI em `.github/workflows/ci.yml`.               |
| Vercel   | conectado                     | Projeto `willmix`, time `martinsphilippes`, região `gru1`. Deploy por push. |
| Appwrite | rede liberada, chave pendente | Esquema pronto em `appwrite.config.json`. Ver "Appwrite" abaixo.            |
| Supabase | conectado, não utilizado      | Decisão: um único backend (Appwrite). Ver ARQUITETURA.md.                   |
| Firebase | descartado                    | Substituído pelo Appwrite antes de qualquer módulo de negócio.              |

## Variáveis de ambiente

Fonte única: `.env.example`. As mesmas chaves devem existir em três lugares:

1. `.env.local` (desenvolvimento local, não commitado);
2. Vercel > Project > Settings > Environment Variables (Production e Preview);
3. Ambiente cloud do Claude Code (para automações e testes na sessão).

## Appwrite

### Para a aplicação (Vercel e local)

1. Console Appwrite > Settings > Overview: copie **API Endpoint** e **Project ID** para `NEXT_PUBLIC_APPWRITE_ENDPOINT` e `NEXT_PUBLIC_APPWRITE_PROJECT_ID`.
2. Console > Settings > API keys > Create API key: escopos `sessions.write`, `users.read`, `users.write`, `teams.read`, `teams.write`, `databases.read`, `databases.write`, `files.read`, `files.write`. Cadastre em `APPWRITE_API_KEY`.
3. Console > Settings > Platforms > Add platform > Web: hostname `localhost` e o domínio da Vercel (`willmix.vercel.app`). Sem isso o SDK do browser é bloqueado por CORS.

### Para o Claude operar o projeto (CLI e API)

No ambiente cloud do Claude Code (menu do ambiente na barra de título, depois Editar):

- **Rede**: liberar o host do endpoint do projeto (ex.: `fra.cloud.appwrite.io`, `nyc.cloud.appwrite.io` ou `sfo.cloud.appwrite.io`). Já liberado.
- **Variáveis**: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.

Nunca colar chaves no chat. Depois de alterar, abra uma nova sessão: rede e variáveis são lidas na inicialização.

### Publicar o esquema

```bash
npm run appwrite:connect   # valida as variáveis, configura o CLI e grava projectId/endpoint no config
npm run appwrite:push      # teams, tabelas e buckets de appwrite.config.json (não interativo, --all --force)
npm run appwrite:generate  # wrapper TypeScript tipado (src/generated)
```

`appwrite:connect` recusa valores vazios ou de exemplo ("cole o…") nas três variáveis e testa a chave lendo os teams. O push exige que `endpoint` do config seja igual ao do CLI; o connect cuida disso.

Atenção ao `--force`: o CLI não tem terminal na sessão cloud nem na CI, então o push não pede confirmação. Colunas e índices removidos do config são apagados no servidor (com os dados da coluna). Revise o `git diff` de `appwrite.config.json` antes de publicar.

## Limitações conhecidas da sessão cloud

- `api.vercel.com` é bloqueado pela política de rede: o Vercel CLI não funciona na sessão. Use o conector Vercel ou push no GitHub.
- `*.cloud.appwrite.io` está liberado (verificado em 2026-09-23). As variáveis `NEXT_PUBLIC_APPWRITE_*` e `APPWRITE_API_KEY` ainda contêm os textos de exemplo no ambiente cloud: preencha-as e abra nova sessão.
- `www.wellmix.com.br` é bloqueado: o entendimento do negócio veio de fontes públicas indexadas.
