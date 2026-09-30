/**
 * Preenche o login solicitante nas solicitações e pedidos já existentes
 * (visibilidade por login do cliente). Idempotente e aditivo: só preenche
 * campos vazios, nunca apaga nem sobrescreve.
 * - Solicitação criada por um login de cliente → solicitante = esse login.
 * - Solicitação criada pela Wellmix → fica sem solicitante (nenhum login do
 *   cliente vê) até a Wellmix indicar um em /app/requests/[id].
 * - Pedido → solicitante da sua solicitação.
 * Uso: set -a && . ./.env.local && set +a && npm run appwrite:backfill-requesters
 */
import { Client, Query, TablesDB } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey) {
  console.error(
    "Faltam NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID ou APPWRITE_API_KEY.",
  );
  process.exit(1);
}
const tables = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey),
);
const databaseId = "willmix";

async function all(tableId: string) {
  const rows: Array<Record<string, unknown> & { $id: string }> = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { rows: Array<{ $id: string }> } = await tables.listRows({
      databaseId,
      tableId,
      queries: [
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    rows.push(...(page.rows as unknown as typeof rows));
    if (page.rows.length < 500) return rows;
    cursor = page.rows[page.rows.length - 1].$id;
  }
}

const users = await all("users");
const requests = await all("requests");
const orders = await all("orders");
const roleOf = (id: unknown) => users.find((u) => u.$id === id)?.role;

let requestsFilled = 0;
for (const r of requests) {
  if (r.requestedForUserId) continue;
  if (roleOf(r.createdByUserId) !== "customer") continue;
  await tables.updateRow({
    databaseId,
    tableId: "requests",
    rowId: r.$id,
    data: { requestedForUserId: r.createdByUserId },
  });
  r.requestedForUserId = r.createdByUserId;
  requestsFilled++;
}
let ordersFilled = 0;
for (const o of orders) {
  if (o.requestedByUserId) continue;
  const request = requests.find((r) => r.$id === o.requestId);
  if (!request?.requestedForUserId) continue;
  await tables.updateRow({
    databaseId,
    tableId: "orders",
    rowId: o.$id,
    data: { requestedByUserId: request.requestedForUserId },
  });
  ordersFilled++;
}
const withoutRequester = orders.filter(
  (o) =>
    !o.requestedByUserId &&
    !requests.find((r) => r.$id === o.requestId)?.requestedForUserId,
).length;
console.log(
  `✓ Solicitações preenchidas: ${requestsFilled}; pedidos preenchidos: ${ordersFilled}; pedidos sem solicitante do cliente (só Wellmix vê): ${withoutRequester}.`,
);
