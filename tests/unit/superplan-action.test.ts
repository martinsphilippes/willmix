import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Parâmetros do Superplan: só o administrador grava. Valor inválido não
 * deixa nada pela metade e aponta o campo; linha sem nome sai da tabela e a
 * linha vazia do fim cria uma nova; o antes e o depois ficam na auditoria. A
 * tela é só do administrador (nenhuma função a libera).
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

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { getSettings } = await import("@/lib/settings");
const { DEFAULT_SUPERPLAN, superplanParams } = await import("@/lib/superplan");
const { canOpen } = await import("@/lib/auth/screens");
const { WELLMIX_FUNCTIONS } = await import("@/lib/db/schema");
const { saveSuperplanParamsAction } =
  await import("@/app/app/actions/superplan");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let customer: User;

const last = () => h.redirects.at(-1);
const stored = async () => superplanParams((await getSettings()).superplan);

/** O formulário como a tela manda: as linhas atuais + uma vazia. */
function formOf(patch: Record<string, string> = {}) {
  const p = DEFAULT_SUPERPLAN;
  const f = new FormData();
  f.set("typesCount", String(p.businessTypes.length + 1));
  p.businessTypes.forEach((t, i) => {
    f.set(`types.${i}.name`, t.name);
    f.set(`types.${i}.markup`, String(t.markup).replace(".", ","));
    f.set(`types.${i}.commissionPct`, String(t.commissionPct));
    f.set(`types.${i}.adminExpensesPct`, String(t.adminExpensesPct));
    f.set(`types.${i}.targetProfitPct`, String(t.targetProfitPct));
    f.set(`types.${i}.wdPct`, String(t.wdPct));
  });
  f.set("defaultBusinessType", p.defaultBusinessType);
  f.set("expensesCount", String(p.expenses.length + 1));
  p.expenses.forEach((e, i) => {
    f.set(`expenses.${i}.key`, e.key);
    f.set(`expenses.${i}.label`, e.label);
    f.set(`expenses.${i}.amountBrl`, String(e.amountBrl));
    if (e.customs) f.set(`expenses.${i}.customs`, "on");
  });
  f.set("freightUsd", "3.492");
  f.set("roadFreightBrl", "1500");
  f.set("futureSpreadBrl", "0,25");
  f.set("freightFxPct", "3,02");
  f.set("afrmmPct", "8");
  f.set("afrmmFixedBrl", "700");
  f.set("grossEstimatePct", "8");
  f.set("priceFactors.table", "1,25");
  f.set("priceFactors.wholesale", "1,6");
  f.set("priceFactors.retail", "1,8");
  f.set("saleTaxes.icmsPct", "1,5");
  f.set("saleTaxes.pisPct", "1,65");
  f.set("saleTaxes.cofinsPct", "7,6");
  f.set("saleTaxes.irPct", "2,6");
  f.set("saleTaxes.csllPct", "1,08");
  for (const [k, v] of Object.entries(patch)) f.set(k, v);
  return f;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("tela do Superplan", () => {
  it("só o administrador abre; nenhuma função libera", () => {
    expect(canOpen(admin, "superplan")).toBe(true);
    expect(
      canOpen(
        { role: "operator", functions: [...WELLMIX_FUNCTIONS] },
        "superplan",
      ),
    ).toBe(false);
    expect(canOpen(customer, "superplan")).toBe(false);
    expect(canOpen({ role: "supplier" }, "superplan")).toBe(false);
  });
});

describe("parâmetros do Superplan", () => {
  it("operador e cliente não gravam (nada muda)", async () => {
    for (const who of [operator, customer]) {
      h.current = who;
      await saveSuperplanParamsAction(formOf({ "saleTaxes.icmsPct": "9" }));
      expect(last()).toBe("/app/superplan?error=forbidden#parametros");
    }
    expect((await stored()).saleTaxes.icmsPct).toBe(1.5);
  });

  it("administrador grava: muda, tira e acrescenta linhas; antes e depois na auditoria", async () => {
    h.current = admin;
    const audits = (await getStore().list("audit_log")).length;
    const n = DEFAULT_SUPERPLAN.businessTypes.length;
    const e = DEFAULT_SUPERPLAN.expenses.length;
    await saveSuperplanParamsAction(
      formOf({
        // Muda o markup do primeiro tipo e tira o segundo (nome vazio).
        "types.0.markup": "1,7",
        "types.1.name": "",
        // Tipo novo na linha vazia do fim.
        [`types.${n}.name`]: "WELLMIX - NOVO - CHINA - MERCADO",
        [`types.${n}.markup`]: "2",
        [`types.${n}.commissionPct`]: "4",
        [`types.${n}.adminExpensesPct`]: "10",
        [`types.${n}.targetProfitPct`]: "20",
        [`types.${n}.wdPct`]: "12",
        // Despesa nova e ICMS da venda com o contador.
        [`expenses.${e}.label`]: "Taxa de liberação",
        [`expenses.${e}.amountBrl`]: "1.250",
        "saleTaxes.icmsPct": "4",
      }),
    );
    expect(last()).toBe("/app/superplan?saved=1#parametros");
    const p = await stored();
    expect(p.businessTypes).toHaveLength(n);
    expect(p.businessTypes[0].markup).toBe(1.7);
    expect(p.businessTypes.map((t) => t.name)).not.toContain(
      DEFAULT_SUPERPLAN.businessTypes[1].name,
    );
    expect(p.businessTypes.at(-1)).toEqual({
      name: "WELLMIX - NOVO - CHINA - MERCADO",
      markup: 2,
      commissionPct: 4,
      adminExpensesPct: 10,
      targetProfitPct: 20,
      wdPct: 12,
    });
    expect(p.expenses.at(-1)).toMatchObject({
      label: "Taxa de liberação",
      amountBrl: 1250,
      customs: false,
    });
    expect(p.expenses.find((x) => x.key === "thc")?.customs).toBe(true);
    expect(p.freightUsd).toBe(3492);
    expect(p.saleTaxes.icmsPct).toBe(4);

    const log = await getStore().list("audit_log");
    expect(log.length).toBe(audits + 1);
    const entry = log.find((a) => a.action === "settings.superplan")!;
    expect(entry.userId).toBe(admin.id);
    expect(
      (entry.before as { saleTaxes: { icmsPct: number } }).saleTaxes.icmsPct,
    ).toBe(1.5);
    expect(
      (entry.after as { saleTaxes: { icmsPct: number } }).saleTaxes.icmsPct,
    ).toBe(4);
  });

  it("valor inválido: nada é gravado e a volta aponta os campos", async () => {
    h.current = admin;
    const before = await stored();
    await saveSuperplanParamsAction(
      formOf({
        "types.0.markup": "abc",
        "saleTaxes.pisPct": "150",
      }),
    );
    const url = new URL(last()!, "http://x");
    expect(url.pathname).toBe("/app/superplan");
    expect(url.searchParams.get("error")).toBe("invalid_input");
    expect(url.searchParams.get("fields")?.split(",")).toEqual([
      "types.0.markup",
      "saleTaxes.pisPct",
    ]);
    expect(url.hash).toBe("#parametros");
    expect(await stored()).toEqual(before);
  });

  it("tipo repetido ou tabela vazia: recusado", async () => {
    h.current = admin;
    const before = await stored();
    await saveSuperplanParamsAction(
      formOf({ "types.1.name": DEFAULT_SUPERPLAN.businessTypes[0].name }),
    );
    expect(new URL(last()!, "http://x").searchParams.get("fields")).toBe(
      "types.1.name",
    );
    const empty = formOf();
    for (let i = 0; i <= DEFAULT_SUPERPLAN.businessTypes.length; i++)
      empty.set(`types.${i}.name`, "");
    await saveSuperplanParamsAction(empty);
    expect(new URL(last()!, "http://x").searchParams.get("error")).toBe(
      "invalid_input",
    );
    expect(await stored()).toEqual(before);
  });

  it("folga da embalagem no peso: grava de 0 a 100, com antes e depois na auditoria", async () => {
    h.current = admin;
    const previous = (await stored()).grossEstimatePct;
    expect(previous).toBe(8);
    await saveSuperplanParamsAction(formOf({ grossEstimatePct: "12,5" }));
    expect(last()).toBe("/app/superplan?saved=1#parametros");
    expect((await stored()).grossEstimatePct).toBe(12.5);
    const entry = (await getStore().list("audit_log")).find(
      (a) =>
        a.action === "settings.superplan" &&
        (a.after as { grossEstimatePct?: number }).grossEstimatePct === 12.5,
    )!;
    expect(entry.userId).toBe(admin.id);
    expect(
      (entry.before as { grossEstimatePct: number }).grossEstimatePct,
    ).toBe(8);
    // Fora da faixa, texto ou campo faltando: recusado, apontando o campo.
    const saved = await stored();
    const missing = formOf();
    missing.delete("grossEstimatePct");
    for (const form of [
      formOf({ grossEstimatePct: "150" }),
      formOf({ grossEstimatePct: "-1" }),
      formOf({ grossEstimatePct: "oito" }),
      missing,
    ]) {
      await saveSuperplanParamsAction(form);
      const url = new URL(last()!, "http://x");
      expect(url.searchParams.get("error")).toBe("invalid_input");
      expect(url.searchParams.get("fields")).toBe("grossEstimatePct");
    }
    expect(await stored()).toEqual(saved);
    // Zero vale (peso estimado = o próprio líquido).
    await saveSuperplanParamsAction(formOf({ grossEstimatePct: "0" }));
    expect((await stored()).grossEstimatePct).toBe(0);
  });
});
