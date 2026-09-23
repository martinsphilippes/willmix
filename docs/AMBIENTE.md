# Ambiente

## Conexões

| Serviço  | Estado                   | Observações                                                       |
| -------- | ------------------------ | ----------------------------------------------------------------- |
| GitHub   | conectado                | `martinsphilippes/willmix`. CI em `.github/workflows/ci.yml`.     |
| Vercel   | conectado                | Time `martinsphilippes`, plano Hobby. Deploy automático por push. |
| Firebase | aguardando credencial    | Ver "Credenciais do Firebase" abaixo.                             |
| Supabase | conectado, não utilizado | Decisão: um único backend (Firebase). Ver ARQUITETURA.md.         |

## Variáveis de ambiente

Fonte única: `.env.example`. As mesmas chaves devem existir em três lugares:

1. `.env.local` (desenvolvimento local, não commitado);
2. Vercel > Project > Settings > Environment Variables (Production e Preview);
3. Ambiente cloud do Claude Code (para automações e testes na sessão).

Chaves públicas (`NEXT_PUBLIC_*`) vêm do app Web no console do Firebase. As chaves do Admin SDK vêm de uma service account.

## Credenciais do Firebase

### Para a aplicação (Vercel e local)

1. Console Firebase > Configurações do projeto > Contas de serviço > Gerar nova chave privada.
2. Converta o JSON para base64 e cadastre em `FIREBASE_SERVICE_ACCOUNT_BASE64`.
   Alternativa: preencha `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`.
3. Cadastre as `NEXT_PUBLIC_FIREBASE_*` do app Web.

### Para o Claude operar o projeto (CLI e API)

A sessão do Claude Code lê as variáveis do ambiente cloud. Duas opções, da mais simples para a mais completa:

- `FIREBASE_TOKEN`: token do `firebase login:ci`. Permite `firebase deploy`, `firebase projects:list`, emuladores etc.
- `GOOGLE_APPLICATION_CREDENTIALS` apontando para um JSON de service account, ou o mesmo `FIREBASE_SERVICE_ACCOUNT_BASE64` acima. Permite usar o Admin SDK e a API de gerenciamento.

Recomendação: service account com papéis mínimos (`Firebase Admin` no projeto de desenvolvimento). Nunca colar credenciais no chat.

Depois de adicionar a variável, abra uma nova sessão: variáveis são lidas na inicialização.

### Vincular o projeto Firebase ao repositório

```bash
npx firebase use --add     # cria .firebaserc com o project id
npm run firebase:deploy:rules
```

## Limitações conhecidas da sessão cloud

- `api.vercel.com` é bloqueado pela política de rede: o Vercel CLI não funciona na sessão. Use o conector Vercel ou push no GitHub.
- `www.wellmix.com.br` é bloqueado: o entendimento do negócio veio de fontes públicas indexadas.
