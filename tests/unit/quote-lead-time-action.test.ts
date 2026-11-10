import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Resposta da cotação sem a "Programação de compra" (pedido do dono): o bloco
 * saiu da tela da cotação (é do pedido), o prazo de produção é informado
 * direto em dias e o que já estava gravado na programação não se perde.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));
vi.mock("@/i18n/server", async () => {
  const { translator } = await import("@/i18n");
  return { getT: async () => translator("pt") };
});

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const { answerQuoteWithSheetAction } =
  await import("@/app/app/actions/purchase-sheet");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let quoteId: string;

const last = () => h.redirects.at(-1) ?? "";
const query = (url: string) => new URL(url, "http://x").searchParams;
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  f.set("quoteId", quoteId);
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const quote = () => getStore().get("quotes", quoteId);

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  const joao = users.find((u) => u.email === "joao@lojista.com")!;
  const request = await r.createRequest(joao, {
    customerId: joao.partyId!,
    productId: "prod-jarra",
    productName: "Jarra de vidro",
    description: "Jarra de vidro com tampa",
    quantity: 1200,
    unit: "un",
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [q] = await getStore().list("quotes", {
    filter: { requestId: request.id, supplierId: "fornecedor-a" },
  });
  quoteId = q.id;
  h.current = supplierA;
});

describe("cotação sem a programação de compra", () => {
  it("a programação não é exigida para enviar a cotação", async () => {
    const view = (await qs.getQuoteSheetForUser(supplierA, quoteId))!;
    expect(view.missing).not.toContain("lot1");
    expect(view.missing).not.toContain("productionStartAt");
  });

  it("salvar guarda o prazo digitado em dias e não mexe na programação já gravada", async () => {
    // Programação gravada antes (ficha de antes da mudança).
    await qs.saveQuoteSheet(supplierA, quoteId, {
      lots: [{ departureIntervalDays: 30, masterCartons: 42 }],
      productionStartAt: "2026-12-01T00:00:00.000Z",
    });
    await answerQuoteWithSheetAction(
      form({ intent: "save", leadTimeDays: "45", conditions: "FOB Ningbo" }),
    );
    expect(query(last()).get("error")).toBeNull();
    expect((await quote())?.leadTimeDays).toBe(45);
    const sheet = (await qs.getQuoteSheet(quoteId))!;
    // O formulário não envia mais a programação: o que estava fica.
    expect(sheet.lots?.[0]).toMatchObject({
      departureIntervalDays: 30,
      masterCartons: 42,
    });
    expect(sheet.productionStartAt?.slice(0, 10)).toBe("2026-12-01");
  });

  it("prazo ilegível aponta o campo e não envia; prazo vazio pede o prazo", async () => {
    await answerQuoteWithSheetAction(
      form({ intent: "send", leadTimeDays: "muitos", conditions: "" }),
    );
    expect(query(last()).get("error")).toBe("invalid_fields");
    expect(query(last()).get("fields")).toContain("leadTimeDays");
    expect((await quote())?.status).toBe("invited");
    for (const bad of ["0", "-3", "4000"]) {
      await answerQuoteWithSheetAction(
        form({ intent: "send", leadTimeDays: bad, conditions: "" }),
      );
      expect(query(last()).get("fields")).toContain("leadTimeDays");
    }
  });
});
