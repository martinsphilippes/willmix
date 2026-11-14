import { describe, expect, it, vi } from "vitest";
import { kickStaleSummaries } from "@/lib/services/summary-kick";

/*
 * Resumos de formato antigo depois de um deploy (auditoria de performance,
 * 14/11/2026): a tela que encontra o formato antigo pede a reconstrução ao
 * job, em vez de todas as telas lerem tabelas inteiras até a madrugada. Só em
 * produção, só para cima, no máximo uma vez a cada 2 minutos por instância.
 */
const prod = {
  VERCEL_ENV: "production",
  VERCEL_URL: "wellmix-abc.vercel.app",
  CRON_SECRET: "s3cret",
};

function fakeFetch() {
  const calls: Array<{ url: string; auth: string | undefined }> = [];
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      auth: (init?.headers as Record<string, string> | undefined)
        ?.authorization,
    });
    return new Response("{}");
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

// O relógio de cada caso fica bem adiante do anterior (a trava é por instância).
let clock = 1_000_000_000;
const later = () => (clock += 10 * 60_000);

describe("reconstrução dos resumos de formato antigo", () => {
  it("formato gravado mais velho em produção: chama o job da própria publicação, com o segredo", async () => {
    const { calls, fetcher } = fakeFetch();
    expect(kickStaleSummaries(6, 8, { env: prod, now: later(), fetcher })).toBe(
      true,
    );
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      url: "https://wellmix-abc.vercel.app/api/jobs/summaries",
      auth: "Bearer s3cret",
    });
  });

  it("no máximo uma vez a cada 2 minutos por instância", async () => {
    const { calls, fetcher } = fakeFetch();
    const t = later();
    expect(kickStaleSummaries(7, 8, { env: prod, now: t, fetcher })).toBe(true);
    expect(
      kickStaleSummaries(7, 8, { env: prod, now: t + 60_000, fetcher }),
    ).toBe(false);
    expect(
      kickStaleSummaries(7, 8, { env: prod, now: t + 2 * 60_000, fetcher }),
    ).toBe(true);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it("formato em dia, mais novo (rollback), fora de produção ou sem resumo: não chama", () => {
    const { calls, fetcher } = fakeFetch();
    const cases: Array<[number | null, Record<string, string>]> = [
      [8, prod],
      [9, prod],
      [null, prod],
      [6, { ...prod, VERCEL_ENV: "preview" }],
      [6, { VERCEL_ENV: "production" }],
      [6, {}],
    ];
    for (const [stored, env] of cases)
      expect(
        kickStaleSummaries(stored, 8, { env, now: later(), fetcher }),
      ).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("falha na chamada não derruba a tela", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("rede fora");
    }) as unknown as typeof fetch;
    expect(kickStaleSummaries(6, 8, { env: prod, now: later(), fetcher })).toBe(
      true,
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });
});
