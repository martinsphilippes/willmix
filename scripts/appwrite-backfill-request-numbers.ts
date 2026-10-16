/**
 * Numera as solicitações que nasceram sem número (antes da coluna
 * requests.number existir). Idempotente e aditivo: só preenche o número
 * vazio, nunca troca um número existente; o lote divide um número; as antigas
 * recebem números na ordem de criação. Ajusta o contador "request_number" para
 * as próximas continuarem a sequência.
 * Roda sozinho no botão "Publicar esquema Appwrite", logo depois do push.
 * Uso manual: set -a && . ./.env.local && set +a && npm run appwrite:backfill-request-numbers
 */
import { Client, ID, Query, TablesDB } from "node-appwrite";
import { planRequestNumbers } from "../src/lib/request-numbering.ts";

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
const COUNTER = "request_number";

type Row = Record<string, unknown> & { $id: string; $createdAt: string };

async function all(tableId: string, queries: string[] = []) {
  const rows: Row[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { rows: Row[] } = (await tables.listRows({
      databaseId,
      tableId,
      queries: [
        ...queries,
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    })) as unknown as { rows: Row[] };
    rows.push(...page.rows);
    if (page.rows.length < 500) return rows;
    cursor = page.rows[page.rows.length - 1].$id;
  }
}

const requests = await all("requests");
const [counterRow] = await all("counters", [Query.equal("key", COUNTER)]);
const plan = planRequestNumbers(
  requests.map((r) => ({
    id: r.$id,
    createdAt: r.$createdAt,
    groupId: typeof r.groupId === "string" ? r.groupId : null,
    number: typeof r.number === "number" ? r.number : null,
  })),
  typeof counterRow?.value === "number" ? counterRow.value : null,
);

for (const u of plan.updates)
  await tables.updateRow({
    databaseId,
    tableId: "requests",
    rowId: u.id,
    data: { number: u.number },
  });

// Contador: as próximas solicitações continuam depois do maior número em uso.
// Relido agora: se alguém pediu um número enquanto isto rodava, vale o maior.
const [fresh] = await all("counters", [Query.equal("key", COUNTER)]);
const current = typeof fresh?.value === "number" ? fresh.value : 0;
if (!fresh)
  await tables.createRow({
    databaseId,
    tableId: "counters",
    rowId: ID.unique(),
    data: { key: COUNTER, value: plan.counter },
  });
else if (plan.counter > current)
  await tables.updateRow({
    databaseId,
    tableId: "counters",
    rowId: fresh.$id,
    data: { value: plan.counter },
  });

console.log(
  `✓ Solicitações numeradas agora: ${plan.updates.length} (de ${requests.length}); próximo número: ${Math.max(plan.counter, current) + 1}.`,
);
