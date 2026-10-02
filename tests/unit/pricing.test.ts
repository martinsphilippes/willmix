import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Preço ao cliente (custo importado + margem) e câmbio PTAX diário. */
withTempStore();

const { priceToCustomer, resolveMargin, totalCbmFor } =
  await import("@/lib/pricing");
const { getFxRates, fetchPtax } = await import("@/lib/services/fx");
const { getSettings, setSetting } = await import("@/lib/settings");

const ptaxResponse = (rate: number, when = "2026-10-01 13:10:00.000") =>
  new Response(
    JSON.stringify({
      value: [
        {
          cotacaoVenda: rate - 0.1,
          dataHoraCotacao: "2026-10-01 10:00:00.000",
          tipoBoletim: "Abertura",
        },
        {
          cotacaoVenda: rate,
          dataHoraCotacao: when,
          tipoBoletim: "Fechamento PTAX",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

describe("preço ao cliente", () => {
  it("custo importado: FOB + frete + II sobre CIF + IPI sobre CIF+II, mais margem", () => {
    const r = priceToCustomer({
      unitPrice: 10,
      currency: "USD",
      quantity: 1000,
      totalCbm: 2,
      importTaxPercent: 20,
      ipiPercent: 10,
      marginPercent: 30,
      fx: { USD: 5 },
      freight: { perCbm: 100, perCbmCurrency: "USD" },
    });
    // FOB 10×1000×5 = 50.000; frete 2×100×5 = 1.000; CIF 51.000
    expect(r.fobBrl).toBe(50000);
    expect(r.freightBrl).toBe(1000);
    expect(r.importTaxBrl).toBe(10200); // 20% de 51.000
    expect(r.ipiBrl).toBe(6120); // 10% de 61.200
    expect(r.landedBrl).toBe(67320);
    expect(r.sellBrl).toBe(87516); // + 30%
    expect(r.missing).toEqual([]);
  });

  it("frete do transportador substitui o por CBM; faltas ficam listadas", () => {
    const r = priceToCustomer({
      unitPrice: 2,
      currency: "RMB",
      quantity: 100,
      totalCbm: null,
      importTaxPercent: null,
      ipiPercent: null,
      marginPercent: 0,
      fx: { RMB: 0.7 },
      freight: { carrierBrl: 500, perCbm: 100 },
    });
    expect(r.freightSource).toBe("carrier");
    expect(r.sellBrl).toBe(640); // 140 + 500
    expect(r.missing).toEqual(["importTax", "ipi"]);
    const noFx = priceToCustomer({
      unitPrice: 2,
      currency: "EUR",
      quantity: 1,
      totalCbm: 1,
      importTaxPercent: 0,
      ipiPercent: 0,
      marginPercent: 10,
      fx: {},
      freight: {},
    });
    expect(noFx.sellBrl).toBeNull();
    expect(noFx.missing).toContain("fx");
  });

  it("CBM total arredonda caixas para cima", () => {
    expect(totalCbmFor(1001, 100, 0.1)).toBeCloseTo(1.1, 6);
    expect(totalCbmFor(10, null, 0.1)).toBeNull();
  });

  it("margem: cliente > linha > geral", () => {
    const s = {
      marginPercent: 25,
      marginByLine: { l1: 35 },
      marginByCustomer: { c1: 15 },
    };
    expect(resolveMargin(s, "c1", "l1")).toEqual({
      percent: 15,
      source: "customer",
    });
    expect(resolveMargin(s, "c2", "l1")).toEqual({
      percent: 35,
      source: "line",
    });
    expect(resolveMargin(s, null, null)).toEqual({
      percent: 25,
      source: "default",
    });
  });
});

describe("câmbio PTAX", () => {
  it("usa o fechamento PTAX mais recente", async () => {
    const r = await fetchPtax("USD", "2026-10-02", async () =>
      ptaxResponse(5.3),
    );
    expect(r.rate).toBe(5.3);
  });

  it("busca uma vez por dia, guarda e usa a última se a busca falhar", async () => {
    let calls = 0;
    const ok = async () => {
      calls++;
      return ptaxResponse(5.5);
    };
    const day1 = new Date("2026-10-02T15:00:00Z");
    const first = await getFxRates({ now: day1, fetcher: ok as typeof fetch });
    expect(first.status).toBe("today");
    expect(first.rates.USD).toBe(5.5);
    expect(first.source).toBe("ptax");
    const afterFirst = calls;
    // Mesmo dia: não busca de novo.
    await getFxRates({ now: day1, fetcher: ok as typeof fetch });
    expect(calls).toBe(afterFirst);
    // Dia seguinte com falha: última PTAX como sugestão.
    const fail = async () => new Response("down", { status: 503 });
    const next = await getFxRates({
      now: new Date("2026-10-03T15:00:00Z"),
      fetcher: fail as typeof fetch,
    });
    expect(next.status).toBe("stale");
    expect(next.day).toBe("2026-10-02");
    expect(next.rates.USD).toBe(5.5);
  });

  it("monta a URL da PTAX com os parâmetros OData sem codificar", async () => {
    let url = "";
    await fetchPtax("RMB", "2026-10-02", async (input) => {
      url = String(input);
      return ptaxResponse(0.75);
    });
    expect(url).toContain("?@moeda='CNY'&@dataInicial='09-25-2026'");
    expect(url).toContain("@dataFinalCotacao='10-02-2026'&$format=json");
  });

  it("Banco Central fora: usa a AwesomeAPI; Buscar agora ignora a espera", async () => {
    await setSetting("fxPtax", null);
    const now = new Date("2026-10-05T15:00:00Z");
    // Falha recente registrada: sem force, nem tenta.
    await setSetting("fxPtaxFailedAt", now.toISOString());
    let calls = 0;
    const fetcher = async (input: RequestInfo | URL) => {
      calls++;
      if (String(input).includes("bcb.gov.br"))
        return new Response("down", { status: 503 });
      return new Response(
        JSON.stringify({
          USDBRL: { ask: "5.42", create_date: "2026-10-05 12:00:00" },
          CNYBRL: { ask: "0.76", create_date: "2026-10-05 12:00:00" },
          EURBRL: { ask: "6.31", create_date: "2026-10-05 12:00:00" },
        }),
        { status: 200 },
      );
    };
    const skipped = await getFxRates({ now, fetcher: fetcher as typeof fetch });
    expect(calls).toBe(0);
    expect(skipped.status).not.toBe("today");
    const forced = await getFxRates({
      now,
      fetcher: fetcher as typeof fetch,
      force: true,
    });
    expect(forced.status).toBe("today");
    expect(forced.source).toBe("awesomeapi");
    expect(forced.rates).toEqual({ USD: 5.42, RMB: 0.76, EUR: 6.31 });
    expect((await getSettings()).fxPtax?.source).toBe("awesomeapi");
  });

  it("BC e AwesomeAPI fora: usa o Banco Central Europeu; tudo fora: guarda o motivo", async () => {
    await setSetting("fxPtax", null);
    await setSetting("fxPtaxFailedAt", null);
    const now = new Date("2026-10-06T15:00:00Z");
    const ecbOnly = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("frankfurter"))
        return new Response("forbidden", { status: 403 });
      const base = new URL(url).searchParams.get("base");
      const brl = { USD: 5.35, CNY: 0.74, EUR: 6.25 }[base ?? ""] ?? 0;
      return new Response(
        JSON.stringify({ base, date: "2026-10-05", rates: { BRL: brl } }),
        { status: 200 },
      );
    };
    const ecb = await getFxRates({
      now,
      fetcher: ecbOnly as typeof fetch,
      force: true,
    });
    expect(ecb.source).toBe("ecb");
    expect(ecb.rates).toEqual({ USD: 5.35, RMB: 0.74, EUR: 6.25 });

    const down = async () => new Response("forbidden", { status: 403 });
    const failed = await getFxRates({
      now: new Date("2026-10-07T15:00:00Z"),
      fetcher: down as typeof fetch,
      force: true,
    });
    expect(failed.status).toBe("stale");
    expect(failed.lastError).toContain("ptax: ptax_http_403");
    expect(failed.lastError).toContain("ecb: http 403");
    expect((await getSettings()).fxLastError).toContain("awesomeapi");
  });

  it("sem PTAX guardada e sem rede: câmbio manual", async () => {
    await setSetting("fxPtax", null);
    await setSetting("fxManualRates", { USD: 5.1, RMB: null, EUR: null });
    const fail = async () => {
      throw new Error("offline");
    };
    const r = await getFxRates({ fetcher: fail as typeof fetch });
    expect(r.status).toBe("manual");
    expect(r.rates).toEqual({ USD: 5.1 });
    expect((await getSettings()).fxPtax).toBeNull();
  });
});
