#!/usr/bin/env bash
# Teste da API do Sankhya por curl (docs/SANKHYA.md).
# Lê as credenciais das variáveis de ambiente (nunca da linha de comando, que
# fica no histórico do terminal):
#   export SANKHYA_CLIENT_ID=...      # Área do Desenvolvedor
#   export SANKHYA_CLIENT_SECRET=...  # Área do Desenvolvedor
#   export SANKHYA_X_TOKEN=...        # Sankhya Om → Configurações Gateway
#   export SANKHYA_BASE_URL=https://api.sankhya.com.br   # opcional (sandbox: https://api.sandbox.sankhya.com.br)
#   bash scripts/sankhya-curl.sh           # teste da conexão (passos 1 a 5)
#   bash scripts/sankhya-curl.sh codigos   # códigos para o pedido (passo 6)
# Faz: 1) autentica; 2) lê 5 empresas (loadRecords); 3) lê 5 produtos (REST v1);
# 4) busca tabelas no dicionário (SQL); 5) mostra as colunas de TDDLIG e TDDINS.
# "codigos": 6) lista TOPs de compra, tipos de negociação, vendedores/compradores,
# locais de estoque e as colunas de AD_NFIMPORTACAO. Tudo só leitura.
set -euo pipefail
: "${SANKHYA_CLIENT_ID:?defina SANKHYA_CLIENT_ID}"
: "${SANKHYA_CLIENT_SECRET:?defina SANKHYA_CLIENT_SECRET}"
: "${SANKHYA_X_TOKEN:?defina SANKHYA_X_TOKEN}"
BASE="${SANKHYA_BASE_URL:-https://api.sankhya.com.br}"
OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT
# Mostra só o começo da resposta. A saída vai para um arquivo temporário antes
# do corte: com "curl | head" o curl recebe erro 23 e o pipefail encerra o script.
show() { head -c "${1:-1500}" "$OUT"; echo; }

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

# SQL só leitura (DbExplorerSP.executeQuery); o texto não pode ter aspas duplas.
sql() {
  curl -sS -X POST "$BASE/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"serviceName\":\"DbExplorerSP.executeQuery\",\"requestBody\":{\"sql\":\"$1\"}}" \
    -o "$OUT"
  show 6000
}

if [ "${1:-}" = "codigos" ]; then
  echo
  echo "== 6a) TOPs de compra (TGFTOP; TIPMOV O = pedido de compra, J = solicitação, C = compra)"
  sql "SELECT DISTINCT CODTIPOPER, DESCROPER, TIPMOV FROM TGFTOP WHERE TIPMOV IN ('O', 'J', 'C') ORDER BY TIPMOV, CODTIPOPER"
  echo
  echo "== 6b) Tipos de negociação (TGFTPV)"
  sql "SELECT DISTINCT CODTIPVENDA, DESCRTIPVENDA FROM TGFTPV ORDER BY CODTIPVENDA"
  echo
  echo "== 6c) Vendedores e compradores ativos (TGFVEN; TIPVEND C = comprador)"
  sql "SELECT CODVEND, APELIDO, TIPVEND FROM TGFVEN WHERE ATIVO = 'S' ORDER BY CODVEND"
  echo
  echo "== 6d) Locais de estoque (TGFLOC)"
  sql "SELECT CODLOCAL, DESCRLOCAL FROM TGFLOC ORDER BY CODLOCAL"
  echo
  echo "== 6e) Colunas de AD_NFIMPORTACAO (Notas Importação Wellmix)"
  sql "SELECT * FROM AD_NFIMPORTACAO WHERE 1 = 0"
  exit 0
fi

echo
echo "== 2) Empresas (CRUDServiceProvider.loadRecords)"
curl -sS -X POST "$BASE/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"serviceName":"CRUDServiceProvider.loadRecords","requestBody":{"dataSet":{"rootEntity":"Empresa","includePresentationFields":"N","offsetPage":"0","entity":{"fieldset":{"list":"CODEMP,NOMEFANTASIA"}}}}}' \
  -o "$OUT"
show

echo
echo "== 3) Produtos (REST GET /v1/produtos)"
curl -sS "$BASE/v1/produtos?page=1" -H "Authorization: Bearer $TOKEN" -o "$OUT"
show

echo
echo "== 4) Dicionário (DbExplorerSP.executeQuery: tabelas com NOTA no nome)"
curl -sS -X POST "$BASE/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"serviceName\":\"DbExplorerSP.executeQuery\",\"requestBody\":{\"sql\":\"SELECT NOMETAB, DESCRTAB FROM TDDTAB WHERE UPPER(DESCRTAB) LIKE '%NOTA%'\"}}" \
  -o "$OUT"
show

echo
echo "== 5) Colunas do dicionário (TDDLIG e TDDINS, sem linhas: só fieldsMetadata)"
for TAB in TDDLIG TDDINS; do
  echo "-- $TAB"
  curl -sS -X POST "$BASE/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"serviceName\":\"DbExplorerSP.executeQuery\",\"requestBody\":{\"sql\":\"SELECT * FROM $TAB WHERE 1 = 0\"}}" \
    -o "$OUT"
  show
done
