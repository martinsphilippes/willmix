import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { towerScenario } from "./helpers/tower-fixture";

/*
 * Indicador da Control Tower vencido dentro de uma requisição (16/11/2026):
 * a tela não recalcula antes de responder (com milhares de pedidos vencidos
 * ao mesmo tempo, estourava a memória e a tela depois do login não abria).
 * Mostra o último agregado e agenda a reconstrução para depois da resposta.
 */
const h = vi.hoisted(() => ({
  inRequest: false,
  queued: [] as Array<() => Promise<void>>,
}));
vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  return {
    ...real,
    after: (fn: () => Promise<void>) => {
      if (!h.inRequest) throw new Error("after fora de requisição");
      h.queued.push(fn);
    },
  };
});

withTempStore();

const k = await import("@/lib/services/tower-kpis");
const summary = await import("@/lib/services/order-summary");

const NOW = new Date();

beforeAll(async () => {
  await towerScenario(NOW);
  await summary.rebuildOrderSummaries(NOW);
});

describe("indicador vencido", () => {
  it("fora de uma requisição, reconstrói antes de responder (como sempre)", async () => {
    const first = (await k.readTowerKpis(NOW))!;
    expect(first).not.toBeNull();
    const later = new Date(Date.parse(first.validUntil!) + 1_000);
    const again = (await k.readTowerKpis(later))!;
    expect(again.computedAt).toBe(later.toISOString());
    expect(h.queued).toHaveLength(0);
  });

  it("na requisição, devolve o último agregado e reconstrói depois da resposta", async () => {
    const current = (await k.readTowerKpis(NOW))!;
    const later = new Date(Date.parse(current.validUntil!) + 1_000);
    h.inRequest = true;
    try {
      const served = (await k.readTowerKpis(later))!;
      // O mesmo agregado gravado, sem esperar a reconstrução.
      expect(served.computedAt).toBe(current.computedAt);
      expect(h.queued).toHaveLength(1);
      // Outra tela logo depois, na mesma instância: não agenda de novo.
      await k.readTowerKpis(later);
      expect(h.queued).toHaveLength(1);
    } finally {
      h.inRequest = false;
    }
    // Depois da resposta: o agregado é refeito e gravado.
    await h.queued[0]();
    const rebuilt = (await k.readTowerKpis(new Date()))!;
    expect(rebuilt.computedAt).not.toBe(current.computedAt);
  });

  it("refaz as vencidas em lotes e no máximo um teto por rodada", () => {
    expect(k.STALE_CHUNK).toBeGreaterThan(0);
    expect(k.STALE_MAX).toBeGreaterThanOrEqual(k.STALE_CHUNK);
    expect(k.STALE_MAX).toBeLessThan(5_000);
  });
});
