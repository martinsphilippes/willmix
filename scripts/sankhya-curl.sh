#!/usr/bin/env bash
# Teste da API do Sankhya por curl (docs/SANKHYA.md).
# Lê as credenciais das variáveis de ambiente (nunca da linha de comando, que
# fica no histórico do terminal):
#   export SANKHYA_CLIENT_ID=...      # Área do Desenvolvedor
#   export SANKHYA_CLIENT_SECRET=...  # Área do Desenvolvedor
#   export SANKHYA_X_TOKEN=...        # Sankhya Om → Configurações Gateway
#   export SANKHYA_BASE_URL=https://api.sankhya.com.br   # opcional (sandbox: https://api.sandbox.sankhya.com.br)
#   bash scripts/sankhya-curl.sh
# Faz: 1) autentica; 2) lê 5 empresas (loadRecords); 3) lê 5 produtos (REST v1).
set -euo pipefail
: "${SANKHYA_CLIENT_ID:?defina SANKHYA_CLIENT_ID}"
: "${SANKHYA_CLIENT_SECRET:?defina SANKHYA_CLIENT_SECRET}"
: "${SANKHYA_X_TOKEN:?defina SANKHYA_X_TOKEN}"
BASE="${SANKHYA_BASE_URL:-https://api.sankhya.com.br}"

echo "== 1) Autenticação em $BASE/authenticate"
AUTH=$(curl -sS -X POST "$BASE/authenticate" \
  -H "X-Token: $SANKHYA_X_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$SANKHYA_CLIENT_ID" \
  --data-urlencode "client_secret=$SANKHYA_CLIENT_SECRET")
TOKEN=$(printf '%s' "$AUTH" | sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "Falhou: $AUTH"
  exit 1
fi
echo "OK (token de ${#TOKEN} caracteres; $(printf '%s' "$AUTH" | grep -o '"expires_in"[^,}]*'))"

echo
echo "== 2) Empresas (CRUDServiceProvider.loadRecords)"
curl -sS -X POST "$BASE/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"serviceName":"CRUDServiceProvider.loadRecords","requestBody":{"dataSet":{"rootEntity":"Empresa","includePresentationFields":"N","offsetPage":"0","entity":{"fieldset":{"list":"CODEMP,NOMEFANTASIA"}}}}}' \
  | head -c 1500
echo

echo
echo "== 3) Produtos (REST GET /v1/produtos)"
curl -sS "$BASE/v1/produtos?page=1" -H "Authorization: Bearer $TOKEN" | head -c 1500
echo

echo
echo "== 4) Dicionário (DbExplorerSP.executeQuery: tabelas com NOTA no nome)"
curl -sS -X POST "$BASE/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"serviceName\":\"DbExplorerSP.executeQuery\",\"requestBody\":{\"sql\":\"SELECT NOMETAB, DESCRTAB FROM TDDTAB WHERE UPPER(DESCRTAB) LIKE '%NOTA%'\"}}" \
  | head -c 1500
echo
