import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cliente sem RCA na Nova solicitação (dono, 19/11/2026; docs/CUSTOMER_RCA.md
 * seção 7): o campo abre para escolher um RCA da lista de vendedores; cada
 * escolhido entra nos RCAs do cliente (pode haver vários); quando o cliente
 * confirma o pedido, o RCA dele fecha a venda e fica como padrão por 30 dias.
 * O cliente com RCA no cadastro (Sankhya ou portal) não muda.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const rca = await import("@/lib/services/rca");
type User = import("@/lib/db").User;

let admin: User;
/** Cliente sem RCA (filial do grupo da demonstração; "0" = sem RCA). */
const OPEN = "cliente-grupo-loja2";

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  await getStore().update("parties", OPEN, { rcaCode: rca.NO_RCA });
});

describe("RCA do cliente sem RCA vinculado", () => {
  it("abre a lista, guarda os RCAs escolhidos e prende o que fechou a venda", async () => {
    const store = getStore();
    const open = await rca.customerRcaField(admin, OPEN);
    expect(open.rca).toBeNull();
    expect(open.open?.candidates).toEqual([]);
    // Só os vendedores ativos (Carla, 103, está inativa).
    expect(open.open?.sellers.map((s) => s.code).sort()).toEqual([
      "101",
      "102",
    ]);
    expect(open.open?.sellers.find((s) => s.code === "101")?.label).toBe(
      "5101 - Ana Representações",
    );

    // Vendedor inativo ou fora da lista: recusado.
    await expect(rca.resolveRequestRca(admin, OPEN, "103")).rejects.toThrow(
      "rca_invalid",
    );
    await expect(rca.resolveRequestRca(admin, OPEN, "999")).rejects.toThrow(
      "rca_invalid",
    );
    // Sem escolha: o pedido fica sem RCA.
    expect(await rca.resolveRequestRca(admin, OPEN, "")).toBeNull();

    // Dois vendedores escolhidos em pedidos diferentes: os dois ficam.
    expect(await rca.resolveRequestRca(admin, OPEN, "101")).toEqual({
      code: "101",
      source: "chosen",
    });
    await rca.resolveRequestRca(admin, OPEN, "102");
    await rca.resolveRequestRca(admin, OPEN, "101");
    expect(rca.rcaCandidatesOf(await store.get("parties", OPEN))).toEqual([
      "101",
      "102",
    ]);
    const two = await rca.customerRcaField(admin, OPEN);
    expect(two.open?.candidates.map((c) => c.code)).toEqual(["101", "102"]);
    expect(two.open?.sellers).toEqual([]);

    // O cliente confirma o pedido do Bruno (102): ele fica por 30 dias.
    const now = new Date("2026-11-19T12:00:00Z");
    expect(
      await rca.lockRcaOnSale(
        admin,
        {
          id: "req-x",
          customerId: OPEN,
          orderTerms: { rca: { code: "102", source: "chosen" } },
        },
        now,
      ),
    ).toBe(true);
    const party = await store.get("parties", OPEN);
    expect(party?.rcaPortal?.lockedCode).toBe("102");
    expect(party?.rcaPortal?.lockedUntil).toBe("2026-12-19T12:00:00.000Z");
    expect(rca.lockedRcaOf(party, new Date("2026-12-01"))?.code).toBe("102");
    // Passados os 30 dias, volta a ficar em aberto.
    expect(rca.lockedRcaOf(party, new Date("2026-12-20"))).toBeNull();

    // Nova venda do mesmo RCA (hoje): renova os 30 dias a partir de agora.
    expect(
      await rca.lockRcaOnSale(admin, {
        id: "req-z",
        customerId: OPEN,
        orderTerms: { rca: { code: "102", source: "locked" } },
      }),
    ).toBe(true);
    // Enquanto vale, o pedido leva o RCA preso (o formulário não muda).
    const locked = await rca.customerRcaField(admin, OPEN);
    expect(locked.locked).not.toBeNull();
    expect(locked.open).toBeNull();
    expect(locked.rca?.code).toBe("102");
    expect(await rca.resolveRequestRca(admin, OPEN, "101")).toEqual({
      code: "102",
      source: "locked",
    });
  });

  it("cliente com RCA no cadastro: o do cadastro, e nada é preso", async () => {
    expect(await rca.resolveRequestRca(admin, "cliente-joao", "102")).toEqual({
      code: "101",
      source: "customer",
    });
    expect(
      await rca.lockRcaOnSale(admin, {
        id: "req-y",
        customerId: "cliente-joao",
        orderTerms: { rca: { code: "101", source: "customer" } },
      }),
    ).toBe(false);
    const field = await rca.customerRcaField(admin, "cliente-joao");
    expect(field.rca?.code).toBe("101");
    expect(field.open).toBeNull();
  });
});
