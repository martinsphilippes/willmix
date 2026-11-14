import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

withTempStore();
const { approveSample } = await import("./helpers/sampling");

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const product = await import("@/lib/services/supplier-request-product");
const po = await import("@/lib/services/purchase-order");
const engine = await import("@/lib/workflow/engine");
const { uploadDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];
const row = (sku: string, desc: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  desc,
  "FOB",
  "USD",
  "1.25",
  "48",
  "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  "20",
  "350",
  "color box",
  "glass",
  "1000",
  "3000",
];
const sheet = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "po.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: "application/pdf",
  });

async function requirementsOf(orderId: string) {
  return getStore().list("requirements", { filter: { orderId } });
}

async function submit(
  user: User,
  orderId: string,
  key: string,
  input: { value?: string; file?: string },
) {
  const req = (await requirementsOf(orderId)).find((r) => r.key === key)!;
  const documentId = input.file
    ? (
        await uploadDocument(user, pdf(input.file), {
          orderId,
          requirementId: req.id,
          type: "attachment",
        })
      ).id
    : undefined;
  await engine.submitRequirement(user, req.id, {
    value: input.value ?? null,
    documentId,
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

/** Solicitações aprovadas do fornecedor A (com produto), cada uma com a sua programação. */
async function approvedWith(
  codes: string[],
  schedules: Array<import("@/lib/db").RequestSchedule | null>,
) {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(
    admin,
    sheet(codes.map((c, i) => row(c, `Scheduled item ${c} ${i}`))),
  );
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  await setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  await lots.closeBookingLot(admin, lot.id, null);
  const lineId = (await store.list("product_lines"))[0].id;
  const out = [];
  for (const [i, item] of items.entries()) {
    const request = await svc.openSupplierRequest(admin, {
      itemId: item.id,
      alternativeIds: [],
      quantity: null,
      needs: null,
      searchQuery: null,
      schedule: schedules[i] ?? null,
    });
    await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 2,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 30,
      note: null,
    });
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    await approveSample(admin, request.id);
    await product.createProductFromRequest(admin, request.id, {
      name: `Produto rodada ${codes[i]}`,
      lineId,
      itemIds: [item.id],
    });
    out.push((await store.get("supplier_requests", request.id))!);
  }
  return { lot, items, requests: out };
}

/*
 * "+" do die-cut e da foto em alta (pedido do dono, 14/11/2026): cada foto
 * vira um anexo próprio do item; excluir tira só a escolhida; as regras de
 * quem envia continuam as do item.
 */
const dieCut = await import("@/lib/services/die-cut-step");
const png = (name: string) =>
  new File(
    [
      Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        ),
        (c) => c.charCodeAt(0),
      ),
    ],
    name,
    { type: "image/png" },
  );

describe("fotos a mais no die-cut e na foto em alta", () => {
  it("acrescenta, mostra todas, exclui só a escolhida e respeita quem envia", async () => {
    const store = getStore();
    const { requests } = await approvedWith(["DC-1"], [null]);
    const order = await po.createPurchaseOrder(admin, [
      { requestId: requests[0].id, quantity: null },
    ]);
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    const key = (base: string) => `${base}__${item.id}`;
    const reqOf = async (base: string) =>
      (await requirementsOf(order.id)).find((r) => r.key === key(base))!;

    // Antes de enviar o item, o "+" não vale.
    await expect(
      dieCut.addDieCutPhotos(
        supplierA,
        order.id,
        (await reqOf("hd_photo")).id,
        {
          files: [png("a.png")],
          uploadedIds: [],
        },
      ),
    ).rejects.toThrow("die_cut_send_first");

    await submit(supplierA, order.id, key("die_cut"), { file: "faca.pdf" });
    await submit(supplierA, order.id, key("hd_photo"), { file: "foto.pdf" });
    const hd = await reqOf("hd_photo");
    const dl = await reqOf("die_cut");
    for (const r of [dl, hd])
      expect(
        await dieCut.addDieCutPhotos(supplierA, order.id, r.id, {
          files: [png("b.png"), png("c.png")],
          uploadedIds: [],
        }),
      ).toBe(2);

    let view = (await dieCut.getDieCutView(supplierA, order.id))!;
    // A faca (PDF) continua e as fotos novas são anexos à parte.
    expect(view.attachments.get(dl.id)!.map((d) => d.name)).toEqual([
      "faca.pdf",
      "b.png",
      "c.png",
    ]);
    expect(view.attachments.get(hd.id)).toHaveLength(3);
    expect((await reqOf("die_cut")).documentId).toBe(dl.documentId);

    // Só imagem; outro fornecedor não mexe.
    await expect(
      dieCut.addDieCutPhotos(supplierA, order.id, hd.id, {
        files: [pdf("x.pdf")],
        uploadedIds: [],
      }),
    ).rejects.toThrow("mime");
    const [supplierB] = await store.list("users", {
      filter: { email: "supplier.b@china.com" },
    });
    await expect(
      dieCut.addDieCutPhotos(supplierB, order.id, hd.id, {
        files: [png("z.png")],
        uploadedIds: [],
      }),
    ).rejects.toThrow();

    // Excluir uma foto a mais tira só ela.
    const extra = view.attachments.get(hd.id)![1];
    await dieCut.removeDieCutPhoto(supplierA, order.id, hd.id, extra.id);
    view = (await dieCut.getDieCutView(supplierA, order.id))!;
    expect(view.attachments.get(hd.id)).toHaveLength(2);
    expect((await reqOf("hd_photo")).status).toBe("done");

    // Excluir a principal: a mais recente vira a principal, o item segue feito.
    const main = (await reqOf("hd_photo")).documentId!;
    await dieCut.removeDieCutPhoto(supplierA, order.id, hd.id, main);
    const after = await reqOf("hd_photo");
    expect(after.status).toBe("done");
    expect(after.documentId).not.toBe(main);
    // A última: o item volta a pendente, como a exclusão de sempre.
    await dieCut.removeDieCutPhoto(
      supplierA,
      order.id,
      hd.id,
      after.documentId!,
    );
    expect((await reqOf("hd_photo")).status).toBe("pending");
    view = (await dieCut.getDieCutView(supplierA, order.id))!;
    expect(view.attachments.get(hd.id) ?? []).toHaveLength(0);
    // O die-cut não foi tocado.
    expect(view.attachments.get(dl.id)).toHaveLength(3);
  });
});
