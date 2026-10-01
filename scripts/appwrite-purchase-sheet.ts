/**
 * Preparação só com a ficha de compra (planilha COMPRAS), para os dados que já existem.
 * Idempotente; por padrão só mostra o que faria (use --apply para gravar).
 * - Linhas de produto com o checklist padrão antigo (dieline, foto profissional,
 *   peso, foto na balança, etiqueta; com ou sem a ficha) passam a ter só a ficha.
 *   Linhas personalizadas não mudam (aparecem no relatório).
 * - Pedidos com a Preparação em aberto ganham o item "Ficha de compra" e perdem
 *   esses cinco itens quando estão vazios (pendentes, sem valor nem arquivo).
 *   Item já enviado fica: nada que alguém preencheu é apagado.
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
];
const LEGACY_KEYS = ["dieline", "photo_pro", "weight", "photo_scale", "label"];

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
const legacy = [...LEGACY_KEYS].sort().join(",");
const legacyWithSheet = [...LEGACY_KEYS, "purchase_sheet"].sort().join(",");
for (const line of await all("product_lines")) {
  const keys = parse(line.requirements)
    .map((r) => r.key)
    .sort()
    .join(",");
  if (keys === "purchase_sheet") continue;
  if (keys !== legacy && keys !== legacyWithSheet) {
    console.log(
      `= linha "${line.name}" personalizada: mantida (${keys || "vazia"})`,
    );
    continue;
  }
  console.log(`~ linha "${line.name}": Preparação só com a ficha de compra`);
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
    if (!LEGACY_KEYS.includes(String(r.key))) continue;
    // Só itens vazios: nada que alguém enviou é apagado.
    if (r.status !== "pending" || r.value || r.documentId || r.submittedAt) {
      console.log(
        `= pedido ${stage.orderId}: "${r.label}" já preenchido, mantido`,
      );
      continue;
    }
    console.log(`- pedido ${stage.orderId}: "${r.label}" (vazio) removido`);
    changes++;
    if (apply)
      await tables.deleteRow({
        databaseId,
        tableId: "requirements",
        rowId: r.$id,
      });
  }
}

console.log(
  apply
    ? `Feito: ${changes} alteração(ões).`
    : `Simulação: ${changes} alteração(ões). Rode com --apply para gravar.`,
);
