/**
 * Ficha de compra na Preparação (planilha COMPRAS) para os dados que já existem.
 * Aditivo e idempotente; por padrão só mostra o que faria (use --apply para gravar).
 * - Linhas de produto com o checklist original sem personalização (dieline,
 *   foto profissional, peso, foto na balança, etiqueta) passam ao checklist novo
 *   (ficha de compra + foto na balança + peso; os outros três opcionais).
 *   Linhas personalizadas não mudam (aparecem no relatório).
 * - Pedidos com a Preparação ainda não concluída ganham o item "Ficha de compra"
 *   (obrigatório); dieline, foto profissional e etiqueta ainda pendentes viram
 *   opcionais. Nada é apagado: o que já foi enviado continua lá.
 * Uso: set -a && . ./.env.local && set +a && npm run appwrite:purchase-sheet -- --apply
 */
import { Client, ID, Query, TablesDB } from "node-appwrite";

const apply = process.argv.includes("--apply");
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

/** Mesmo conteúdo de DEFAULT_PREPARATION_REQUIREMENTS (src/lib/workflow/stages.ts). */
const NEW_DEFAULT = [
  {
    key: "purchase_sheet",
    label: "Ficha de compra",
    type: "text",
    required: true,
    role: "supplier",
  },
  {
    key: "photo_scale",
    label: "Foto na balança",
    type: "photo",
    required: true,
    role: "supplier",
  },
  {
    key: "weight",
    label: "Peso (kg)",
    type: "number",
    required: true,
    role: "supplier",
  },
  {
    key: "dieline",
    label: "Dieline",
    type: "file",
    required: false,
    role: "supplier",
  },
  {
    key: "photo_pro",
    label: "Foto profissional",
    type: "photo",
    required: false,
    role: "supplier",
  },
  {
    key: "label",
    label: "Etiqueta",
    type: "file",
    required: false,
    role: "supplier",
  },
];
const LEGACY_KEYS = ["dieline", "photo_pro", "weight", "photo_scale", "label"];
const NOW_OPTIONAL = ["dieline", "photo_pro", "label"];

type Row = Record<string, unknown> & { $id: string };

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

const parse = (v: unknown) => {
  if (Array.isArray(v)) return v as Array<{ key: string }>;
  try {
    return JSON.parse(String(v ?? "[]")) as Array<{ key: string }>;
  } catch {
    return [];
  }
};

let changes = 0;

// 1) Linhas de produto
for (const line of await all("product_lines")) {
  const reqs = parse(line.requirements);
  const keys = reqs
    .map((r) => r.key)
    .sort()
    .join(",");
  if (reqs.some((r) => r.key === "purchase_sheet")) continue;
  if (keys !== [...LEGACY_KEYS].sort().join(",")) {
    console.log(
      `= linha "${line.name}" personalizada: mantida (${keys || "vazia"})`,
    );
    continue;
  }
  console.log(`~ linha "${line.name}": checklist novo da Preparação`);
  changes++;
  if (apply)
    await tables.updateRow({
      databaseId,
      tableId: "product_lines",
      rowId: line.$id,
      data: { requirements: JSON.stringify(NEW_DEFAULT) },
    });
}

// 2) Pedidos com a Preparação não concluída
for (const stage of await all("stages", [
  Query.equal("key", "PREPARATION"),
  Query.notEqual("status", "done"),
])) {
  const reqs = await all("requirements", [Query.equal("stageId", stage.$id)]);
  if (!reqs.some((r) => r.key === "purchase_sheet")) {
    console.log(`+ pedido ${stage.orderId}: item "Ficha de compra"`);
    changes++;
    if (apply)
      await tables.createRow({
        databaseId,
        tableId: "requirements",
        rowId: ID.unique(),
        data: {
          orderId: stage.orderId,
          stageId: stage.$id,
          key: "purchase_sheet",
          label: "Ficha de compra",
          type: "text",
          required: true,
          role: "supplier",
          status: "pending",
          value: null,
          documentId: null,
          submittedByUserId: null,
          submittedAt: null,
          note: null,
        },
      });
  }
  for (const r of reqs) {
    if (!NOW_OPTIONAL.includes(String(r.key))) continue;
    if (r.status === "done" || r.required === false) continue;
    console.log(`~ pedido ${stage.orderId}: "${r.label}" opcional`);
    changes++;
    if (apply)
      await tables.updateRow({
        databaseId,
        tableId: "requirements",
        rowId: r.$id,
        data: { required: false },
      });
  }
}

console.log(
  apply
    ? `Feito: ${changes} alteração(ões).`
    : `Simulação: ${changes} alteração(ões). Rode com --apply para gravar.`,
);
