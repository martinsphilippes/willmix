import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Leitura da lista de Encomendas e da fila de Reposição (dono, 16/11/2026):
 * o banco devolve só o que ainda é encomenda; as encerradas (excluídas e com
 * pedido cancelado) só em "Ver canceladas e excluídas"; o que virou pedido
 * fica de fora das duas. O Estoque Wellmix é todo reposição e sai de
 * Encomendas (dono, 26/11/2026).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const data = await import("@/lib/services/request-list-data");
const { listDemands } = await import("@/lib/services/purchase-demand");

const ids: Record<string, string> = {};

beforeAll(async () => {
  const store = getStore();
  let n = 9000;
  const order = (status: string) =>
    store.create("orders", { status, customerId: "c1", number: n++ } as never);
  const live = await order("NEW_ORDER");
  const dead = await order("CANCELLED");
  const request = async (
    key: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) => {
    const row = await store.create("requests", {
      customerId: "c1",
      productName: key,
      description: key,
      quantity: 1,
      unit: "un",
      status,
      origin: "manual",
      orderId: null,
      ...extra,
    } as never);
    ids[key] = row.id;
  };
  await request("aberta", "REQUESTED", { groupId: "g1" });
  await request("aguardando", "AWAITING_CUSTOMER");
  await request("pedida", "ORDERED", { orderId: live.id, groupId: "g1" });
  await request("pedido-cancelado", "ORDERED", { orderId: dead.id });
  await request("excluida", "CANCELLED");
  await request("outro-cliente", "REQUESTED", { customerId: "c2" });
  await request("reposicao-aberta", "REQUESTED", { origin: "replenishment" });
  await request("reposicao-pedida", "ORDERED", {
    origin: "replenishment",
    orderId: live.id,
  });
  // Do Estoque Wellmix (dono, 26/11/2026): a Pre-order 1100 do Sankhya, a
  // compra para estoque da Nova solicitação e uma excluída.
  const stock = { customerId: "wellmix-estoque" };
  await request("estoque-sankhya", "REQUESTED", {
    ...stock,
    origin: "replenishment",
  });
  await request("estoque-manual", "REQUESTED", stock);
  await request("estoque-excluida", "CANCELLED", {
    ...stock,
    origin: "replenishment",
  });
});

const names = (rows: { productName: string }[]) =>
  rows.map((r) => r.productName).sort();

describe("lista de Encomendas pelo banco", () => {
  it("só o que ainda é encomenda: sem pedido, sem excluída", async () => {
    expect(names(await data.activeRequests())).toEqual([
      "aberta",
      "aguardando",
      "estoque-manual",
      "estoque-sankhya",
      "outro-cliente",
      "reposicao-aberta",
    ]);
    // O cliente: só as dele.
    expect(names(await data.activeRequests({ customerId: "c2" }))).toEqual([
      "outro-cliente",
    ]);
  });

  it("a lista de Encomendas não mostra o Estoque Wellmix (é reposição)", async () => {
    expect(names(await data.listedRequests())).toEqual([
      "aberta",
      "aguardando",
      "outro-cliente",
      "reposicao-aberta",
    ]);
    expect(names(await data.listedRequests({ customerId: "c2" }))).toEqual([
      "outro-cliente",
    ]);
  });

  it("encerradas: excluídas e com pedido cancelado, com a contagem igual", async () => {
    const { rows, cancelled } = await data.closedRequests();
    // A excluída do estoque também fica fora de Encomendas.
    expect(names(rows)).toEqual(["excluida", "pedido-cancelado"]);
    expect(cancelled.size).toBe(1);
    expect(await data.closedRequestCount()).toBe(2);
    expect(await data.closedRequestCount({ customerId: "c2" })).toBe(0);
  });

  it("o lote mostra todas as situações e conta todas", async () => {
    expect(names(await data.groupRequests("g1"))).toEqual(["aberta", "pedida"]);
    expect((await data.groupSizes(["g1", "g1"])).get("g1")).toBe(2);
  });
});

describe("fila de Reposição", () => {
  it("a reposição que virou pedido sai da fila; o Estoque Wellmix entra todo", async () => {
    expect(names(await listDemands("replenishment"))).toEqual([
      "estoque-manual",
      "estoque-sankhya",
      "reposicao-aberta",
    ]);
  });
});
