import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Amostragem (docs/SUPPLIER_SAMPLING.md): aprovada a solicitação, o
 * responsável pelo booking sobe fotos e vídeos de uma amostra e envia; a
 * Wellmix aprova ou reprova com o motivo; reprovada, ele manda outra rodada.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const sampling = await import("@/lib/services/supplier-request-sampling");
const lib = await import("@/lib/supplier-request-sampling");
const { requestTimeline } = await import("@/lib/supplier-requests");
const { canAccessDocument } = await import("@/lib/services/documents");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let supplierB: User;

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
const sheet = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "b.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
const photo = (name = "amostra.png") =>
  new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], name, {
    type: "image/png",
  });
const video = (name = "amostra.mp4") =>
  new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], name, {
    type: "video/mp4",
  });

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

async function approvedRequest() {
  const lot = await lots.createBookingLotFromSheet(
    admin,
    sheet([
      [
        "Shenzhen Supplier A",
        "2026.10.13",
        "S-1",
        "Sample mug 300ml",
        "FOB",
        "USD",
        "1.10",
        "48",
        "12",
        "0.3",
        "0.35",
        "0.12",
        "10",
        "8",
        "20",
        "300",
        "color box",
        "ceramic",
        "1000",
        "2000",
      ],
    ]),
  );
  const items = await getStore().list("booking_items", {
    filter: { lotId: lot.id },
  });
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  await setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  await lots.closeBookingLot(admin, lot.id, null);
  const request = await svc.openSupplierRequest(admin, {
    itemId: items[0].id,
    alternativeIds: [],
    quantity: null,
    needs: null,
    searchQuery: null,
  });
  return request;
}

describe("regras da amostragem", () => {
  it("abre na aprovação; a aprovada antes da etapa vale como pendente", () => {
    const base = {
      status: "approved" as const,
      decidedAt: "2026-11-12T10:00:00.000Z",
      updatedAt: "2026-11-12T11:00:00.000Z",
      sampling: null,
    };
    expect(lib.samplingOf(base)).toMatchObject({
      status: "pending",
      round: 1,
      openedAt: base.decidedAt,
    });
    expect(lib.samplingOf({ ...base, status: "answered" })).toBeNull();
    expect(lib.samplingKind("video/quicktime")).toBe("video");
    expect(lib.samplingKind("image/heic")).toBe("photo");
    expect(lib.samplingKind("application/pdf")).toBeNull();
    const s = lib.openSampling(base.decidedAt, "u1");
    expect(lib.samplingCanUpload(s)).toBe(true);
    expect(lib.samplingCanSubmit(s)).toBe(false);
    expect(lib.samplingTurn(s)).toBe("supplier");
    expect(lib.samplingTurn({ ...s, status: "submitted" })).toBe("wellmix");
    expect(lib.samplingTurn({ ...s, status: "approved" })).toBeNull();
  });
});

describe("amostragem da solicitação ao fornecedor", () => {
  it("o responsável envia fotos e vídeos; a Wellmix reprova e depois aprova", async () => {
    const request = await approvedRequest();
    // Antes da aprovação, não há amostragem.
    await expect(
      sampling.addSamplingFile(supplierA, request.id, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("sampling_not_open");
    await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 1.1,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 30,
      note: null,
    });
    const approved = await svc.decideSupplierRequest(
      admin,
      request.id,
      "approved",
      null,
    );
    expect(approved.sampling).toMatchObject({ status: "pending", round: 1 });
    // O responsável é avisado para enviar a amostra.
    const notes = await getStore().list("notifications", {
      filter: { userId: supplierA.id, channel: "inapp" },
    });
    expect(notes.some((n) => n.link?.endsWith("#amostragem"))).toBe(true);
    // Pendência do responsável, na etapa Amostragem.
    expect(
      (await pendingTasksFor(supplierA)).some(
        (t) => t.kind === "sampling" && t.link.includes(request.id),
      ),
    ).toBe(true);

    // Só o responsável envia; outro fornecedor não vê; tipo errado recusa.
    await expect(
      sampling.addSamplingFile(admin, request.id, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("sampling_supplier_only");
    await expect(
      sampling.addSamplingFile(supplierB, request.id, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("not_found");
    await expect(
      sampling.addSamplingFile(supplierA, request.id, {
        file: new File([new Uint8Array([1])], "x.pdf", {
          type: "application/pdf",
        }),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("sampling_file_type");
    // Sem arquivo não envia.
    await expect(
      sampling.submitSampling(supplierA, request.id, null),
    ).rejects.toThrow("sampling_file_missing");

    await sampling.addSamplingFile(supplierA, request.id, {
      file: photo(),
      uploadedFileId: null,
    });
    const withVideo = await sampling.addSamplingFile(supplierA, request.id, {
      file: video(),
      uploadedFileId: null,
    });
    expect(withVideo.sampling!.files.map((f) => f.kind)).toEqual([
      "photo",
      "video",
    ]);
    // O arquivo abre para a Wellmix e o responsável; outro fornecedor, não.
    const doc = (await getStore().get(
      "documents",
      withVideo.sampling!.files[1].documentId,
    ))!;
    expect(doc.supplierRequestId).toBe(request.id);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    // Tira um arquivo antes de enviar.
    const removed = await sampling.removeSamplingFile(
      supplierA,
      request.id,
      withVideo.sampling!.files[0].documentId,
    );
    expect(removed.sampling!.files).toHaveLength(1);

    // A Wellmix não valida antes do envio.
    await expect(
      sampling.reviewSampling(admin, request.id, "approve", null),
    ).rejects.toThrow("sampling_not_submitted");
    const submitted = await sampling.submitSampling(
      supplierA,
      request.id,
      "Amostra do lote piloto",
    );
    expect(submitted.sampling!.status).toBe("submitted");
    // Enviada: não aceita arquivo; vira pendência da Wellmix.
    await expect(
      sampling.addSamplingFile(supplierA, request.id, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("sampling_closed");
    expect(
      (await pendingTasksFor(admin)).some(
        (t) => t.kind === "sampling_validate" && t.link.includes(request.id),
      ),
    ).toBe(true);
    // O fornecedor não valida; reprovar pede o motivo.
    await expect(
      sampling.reviewSampling(supplierA, request.id, "approve", null),
    ).rejects.toThrow("not_found");
    await expect(
      sampling.reviewSampling(admin, request.id, "reject", "  "),
    ).rejects.toThrow("sampling_reason_required");

    const rejected = await sampling.reviewSampling(
      admin,
      request.id,
      "reject",
      "Mostrar a alça de perto",
    );
    expect(rejected.sampling).toMatchObject({ status: "rejected", round: 2 });
    // Nova rodada: os arquivos da anterior ficam guardados, fora do envio.
    expect(lib.samplingRoundFiles(rejected.sampling!)).toEqual([]);
    await sampling.addSamplingFile(supplierA, request.id, {
      file: photo("alca.png"),
      uploadedFileId: null,
    });
    await sampling.submitSampling(supplierA, request.id, null);
    const ok = await sampling.reviewSampling(
      admin,
      request.id,
      "approve",
      null,
    );
    expect(ok.sampling).toMatchObject({ status: "approved", round: 2 });
    expect(ok.sampling!.files.map((f) => f.round)).toEqual([1, 2]);
    expect(ok.sampling!.history.map((e) => e.kind)).toEqual([
      "open",
      "submit",
      "reject",
      "submit",
      "approve",
    ]);
    // Linha do tempo com os passos da amostragem.
    expect(
      requestTimeline(ok)
        .filter((e) => e.kind === "sampling")
        .map((e) => e.outcome),
    ).toEqual(["submit", "reject", "submit", "approve"]);
    // Aprovada: sai das pendências dos dois lados.
    expect(
      (await pendingTasksFor(supplierA)).some(
        (t) => t.kind === "sampling" && t.link.includes(request.id),
      ),
    ).toBe(false);
    expect(
      (await pendingTasksFor(admin)).some(
        (t) => t.kind === "sampling_validate" && t.link.includes(request.id),
      ),
    ).toBe(false);
  });
});
