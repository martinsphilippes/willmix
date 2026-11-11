import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Carga do Sankhya no servidor: a fila segue a ordem (locais antes de
 * produtos), uma rodada por chamada do agendador, passa para a próxima
 * entidade quando termina, desliga sozinha; parar, travar rodadas
 * simultâneas, cinco erros seguidos param e a chave do agendador confere.
 */
withTempStore();

const runs: string[] = [];
const doneAfter: Record<string, number> = {};
const fail = { next: false };
vi.mock("@/lib/integrations/sankhya-full-load", () => ({
  getFullLoadProgress: async (entity: string) => ({
    done: entity === "paymentConditions",
  }),
  runFullLoad: async (_user: unknown, entity: string) => {
    if (fail.next) throw new Error("ERP fora");
    runs.push(entity);
    doneAfter[entity] = (doneAfter[entity] ?? 2) - 1;
    return { progress: { done: doneAfter[entity] <= 0 }, lines: [] };
  },
}));

const { seedDemo } = await import("@/lib/seed");
const q = await import("@/lib/integrations/sankhya-load-queue");
const { readSetting } = await import("@/lib/integrations/sankhya-settings");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("carga do Sankhya no servidor", () => {
  it("enfileira na ordem, roda uma rodada por chamada e desliga no fim", async () => {
    await expect(q.startServerLoad(joao)).rejects.toThrow("forbidden");
    expect(await q.runServerLoadTick()).toEqual({ ran: false, reason: "idle" });

    const s = await q.startServerLoad(admin, ["products", "stockLocations"]);
    // Ordem fixa (locais antes de produtos); condições já terminadas não entram.
    expect(s.queue).toEqual(["stockLocations", "products"]);
    expect(s.active).toBe(true);
    const token = await readSetting<string>(q.CRON_TOKEN_KEY);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(await q.cronTokenOk(token)).toBe(true);
    expect(await q.cronTokenOk("errado")).toBe(false);
    expect(await q.cronTokenOk(null)).toBe(false);

    for (let i = 0; i < 4; i++) await q.runServerLoadTick();
    expect(runs).toEqual([
      "stockLocations",
      "stockLocations",
      "products",
      "products",
    ]);
    const end = await q.getServerLoad();
    expect(end.active).toBe(false);
    expect(end.queue).toEqual([]);
    expect(end.finishedAt).not.toBeNull();
    expect(await q.runServerLoadTick()).toEqual({ ran: false, reason: "idle" });
  });

  it("não roda duas ao mesmo tempo, para quando pedem e com 5 erros", async () => {
    runs.length = 0;
    await q.startServerLoad(admin, ["orders"]);
    // Rodada em andamento (trava): a próxima chamada espera.
    const { writeSetting } =
      await import("@/lib/integrations/sankhya-settings");
    const s = await q.getServerLoad();
    await writeSetting("sankhya.load.server", {
      ...s,
      lockUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(await q.runServerLoadTick()).toEqual({ ran: false, reason: "busy" });
    await writeSetting("sankhya.load.server", { ...s, lockUntil: null });

    await q.stopServerLoad(admin);
    expect(await q.runServerLoadTick()).toEqual({ ran: false, reason: "idle" });
    expect(runs).toEqual([]);

    await q.startServerLoad(admin, ["orders"]);
    fail.next = true;
    for (let i = 0; i < 5; i++) await q.runServerLoadTick();
    fail.next = false;
    const end = await q.getServerLoad();
    expect(end.active).toBe(false);
    expect(end.failures).toBe(5);
    expect(end.lastError).toBe("ERP fora");
    expect(end.queue).toEqual(["orders"]);
  });
});
