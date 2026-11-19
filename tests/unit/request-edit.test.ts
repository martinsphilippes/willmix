import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Editar a encomenda enviada (dono, 19/11/2026; docs/ORDER_TERMS.md 11.19):
 * enquanto o cliente não confirmou, a Wellmix reabre a encomenda com o
 * formulário como foi enviado (rascunho marcado, mesmo número) e o envio a
 * refaz no lugar: mesmo número, lote e ids. Depois da confirmação, não dá
 * mais; se a nova versão falhar, a de antes volta.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch } = await import("@/lib/services/requests");
const edit = await import("@/lib/services/request-edit");
const confirmation = await import("@/lib/services/customer-confirmation");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const base = () => ({
  customerId: joao.partyId!,
  deadline: null,
  notes: null,
  requestedForUserId: joao.id,
  orderTerms: {
    operationType: "ts",
    carrierCaller: "wellmix",
    redispatchRequired: false,
  } as never,
});
const items = (names: string[]) =>
  names.map((name) => ({
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 100,
    unit: "un",
    sourcingDemand: false,
  }));

/** Envio pela tela TS, com o formulário guardado. */
async function send(names: string[]) {
  const created = await createRequestBatch(admin, base(), items(names));
  const form = new FormData();
  form.append("customerId", joao.partyId!);
  names.forEach((n, i) => form.append(`p${i}.productName`, n));
  form.append("saleFormat", "wd");
  await edit.saveSentForm(created, form, "ts");
  return created;
}

describe("editar a encomenda enviada", () => {
  it("reabre com o formulário enviado e refaz no lugar (mesmo número, lote e ids)", async () => {
    const store = getStore();
    const before = await send(["Garrafa A", "Garrafa B"]);
    expect(await edit.canEditSentRequest(admin, before[0])).toBe(true);
    // O cliente não edita.
    expect(await edit.canEditSentRequest(joao, before[0])).toBe(false);

    const href = await edit.reopenSentRequest(admin, before[1].id);
    expect(href).toMatch(/^\/app\/new-request\/ts\?draft=/);
    const draftId = new URL(href, "http://x").searchParams.get("draft")!;
    const draft = await store.get("request_drafts", draftId);
    expect(draft?.number).toBe(before[0].number);
    expect(draft?.payload).toContainEqual(["saleFormat", "wd"]);
    expect(draft?.payload).toContainEqual([edit.EDIT_FIELD, before[0].id]);
    // Reabrir de novo volta ao mesmo rascunho.
    expect(await edit.reopenSentRequest(admin, before[0].id)).toBe(href);

    // Enviada de novo com três produtos: os dois de antes no lugar.
    const after = await edit.replaceSentRequest(admin, before[0].id, (keep) =>
      createRequestBatch(admin, base(), items(["Garrafa A", "Copo", "Prato"]), {
        ids: keep.ids,
        number: keep.number,
        groupId: keep.groupId,
      }),
    );
    expect(after.map((r) => r.id).slice(0, 2)).toEqual(before.map((r) => r.id));
    expect(after.every((r) => r.number === before[0].number)).toBe(true);
    expect(after.every((r) => r.groupId === before[0].groupId)).toBe(true);
    expect((await store.get("requests", before[1].id))?.productName).toBe(
      "Copo",
    );
    const history = await store.list("audit_log", {
      filter: { action: "request.edited" },
    });
    expect(history).toHaveLength(1);
  });

  it("depois da confirmação do cliente não reabre nem refaz", async () => {
    const [request] = await send(["Pote"]);
    await confirmation.confirmCustomerOrder(joao, request.id, {
      accept: true,
      cnpj: "",
      carrierName: "",
    });
    const confirmed = (await getStore().get("requests", request.id))!;
    expect(await edit.canEditSentRequest(admin, confirmed)).toBe(false);
    await expect(edit.reopenSentRequest(admin, request.id)).rejects.toThrow(
      "edit_not_allowed",
    );
    await expect(
      edit.replaceSentRequest(admin, request.id, async () => []),
    ).rejects.toThrow("edit_not_allowed");
  });

  it("se a nova versão falhar, a encomenda de antes volta como estava", async () => {
    const store = getStore();
    const before = await send(["Jarra 1", "Jarra 2"]);
    await expect(
      edit.replaceSentRequest(admin, before[0].id, async () => {
        throw new Error("below_moq");
      }),
    ).rejects.toThrow("below_moq");
    for (const r of before) {
      const back = await store.get("requests", r.id);
      expect(back?.productName).toBe(r.productName);
      expect(back?.status).toBe("AWAITING_CUSTOMER");
      expect(back?.number).toBe(r.number);
    }
  });
});
