import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Tabela fiscal guardada no Appwrite: o SDK devolve arquivo JSON já "aberto"
 * (objeto). A leitura tem de voltar aos bytes; tabela ilegível não pode
 * derrubar a sugestão de NCM.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { downloadBytes } = await import("@/lib/db/download-bytes");
const { AppwriteStore } = await import("@/lib/db/appwrite-store");
const fs = await import("@/lib/services/fiscal");
const rn = await import("@/lib/services/request-ncm");
const r = await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

function tecCsv() {
  const rows = ["NCM;DESCRIÇÃO;TEC (%)"];
  for (let i = 0; i < 600; i++) rows.push(`${10000000 + i * 7};Item ${i};10`);
  rows.push("7013.37.00;Outros objetos de vidro;18");
  return new TextEncoder().encode(rows.join("\n"));
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  await setSetting("aiMode", "MANUAL");
});

describe("arquivo JSON vindo do Appwrite", () => {
  it("objeto já aberto pelo SDK volta a ser o mesmo JSON", () => {
    const table = { version: 1, rows: { "70133700": { ii: 18, ipi: 9.75 } } };
    const bytes = downloadBytes(JSON.parse(JSON.stringify(table)));
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(table);
    const raw = new TextEncoder().encode("abc");
    expect(downloadBytes(raw.buffer)).toEqual(raw);
    expect(downloadBytes(raw)).toBe(raw);
    expect(new TextDecoder().decode(downloadBytes("abc"))).toBe("abc");
  });

  it("AppwriteStore.getFile entrega os bytes quando o SDK devolve objeto", async () => {
    const store = new AppwriteStore("https://exemplo.invalid/v1", "p", "k");
    const table = { version: 1, rows: { "85171300": { ii: 16 } } };
    (store as unknown as { storage: unknown }).storage = {
      getFile: async () => ({ name: "t.json", mimeType: "application/json" }),
      // Igual ao node-appwrite com content-type application/json.
      getFileDownload: async () => JSON.parse(JSON.stringify(table)),
    };
    const file = await store.getFile("x");
    expect(JSON.parse(new TextDecoder().decode(file!.bytes))).toEqual(table);
  });
});

describe("tabela fiscal ilegível", () => {
  it("não derruba a sugestão de NCM e a tela pede para enviar de novo", async () => {
    const empty = await getStore().putFile(
      new Uint8Array(),
      "tabela.json",
      "application/json",
    );
    const when = new Date().toISOString();
    await setSetting("fiscalTable", {
      fileKey: empty.key,
      tec: {
        updatedAt: when,
        count: 601,
        fileName: "tec.csv",
        source: "upload",
      },
      tipi: null,
    });
    expect(await fs.lookupNcm("70133700")).toBeNull();
    expect(await fs.hasFiscalTable()).toBe(false);
    expect((await fs.fiscalStatus()).unreadable).toBe(true);

    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Jarra de vidro",
      description: "Jarra de vidro",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
    });
    const s = await rn.suggestRequestNcm(admin, request.id);
    expect(s.aiError).toBe("ai_not_configured");
    // Sem tabela legível, confirmar não exige o NCM na tabela.
    await rn.confirmRequestNcm(admin, request.id, "7013.37.00", "manual");

    // Nova TEC: a parte anterior ilegível não é reaproveitada.
    await fs.importFiscalFile(admin, "tec", tecCsv(), "tec.csv", "upload");
    const status = await fs.fiscalStatus();
    expect(status.unreadable).toBe(false);
    expect(status.tec?.count).toBe(601);
    expect(status.tipi).toBeNull();
    expect((await fs.lookupNcm("70133700"))?.ii).toBe(18);
  });
});
