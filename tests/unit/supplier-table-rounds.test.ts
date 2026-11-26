import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupplierRequest } from "@/lib/db/schema";

/*
 * Tabela dos produtos da solicitação (dono, 26/11/2026): a programação vira
 * sublinhas do produto (<nº>.<programação>, a mesma informação do item com a
 * quantidade da programação) e o item com embalagem modificada conta sets,
 * com a coluna "Peças por set".
 */
const { translator } = await import("@/i18n");
const { SupplierRequestTable } =
  await import("@/app/app/supplier-requests/_components/supplier-table");

const request = (over: Partial<SupplierRequest> = {}): SupplierRequest =>
  ({
    id: "sr-6",
    createdAt: "2026-11-26T14:19:35.336Z",
    updatedAt: "2026-11-26T14:19:35.336Z",
    number: 6,
    status: "open",
    supplierId: "sup-1",
    bookingItemId: "bi-1",
    bookingLotId: "lot-1",
    alternativeItemIds: null,
    item: {
      itemNumber: null,
      factoryItemCode: null,
      productName: null,
      description: "ESPELHO",
      incoterm: "EXW",
      currency: "RMB",
      price: 7.2,
      masterCartonQty: 24,
      innerQty: null,
      netWeightPcKg: 0.328,
      grossWeightPcKg: 0.351,
      cbmPerCarton: 0.08,
      lengthCm: 23,
      widthCm: 7,
      heightCm: 19.5,
      capacityMl: 1,
      packageType: "COLOUR BOX",
      material: "PP + GLASS",
      colorAssortment: "ESPELHO VERMELHO",
      powerDetail: "N",
      moq: 500,
      photoDocumentId: null,
    },
    quantity: 1800,
    unit: "pcs",
    needs: null,
    searchQuery: null,
    supplierCanDo: null,
    supplierPrice: null,
    supplierCurrency: null,
    supplierMoq: null,
    supplierLeadTimeDays: null,
    supplierNote: null,
    respondedAt: null,
    respondedByUserId: null,
    decidedAt: null,
    decidedByUserId: null,
    decisionNote: null,
    createdByUserId: "u-1",
    negotiation: [],
    batchId: "b-6",
    schedule: {
      intervalDays: 30,
      firstDate: "2027-01-10",
      items: [
        { index: 1, quantity: 600, expectedAt: "2027-01-10" },
        { index: 2, quantity: 600, expectedAt: "2027-02-09" },
        { index: 3, quantity: 600, expectedAt: "2027-03-11" },
      ],
    },
    variant: {
      key: "ESPELHO VERMELHO|2",
      variation: "ESPELHO VERMELHO",
      units: 2,
      pieceCarton: 48,
      mix: false,
      artDocumentId: null,
      selectionGroupId: "g-1",
    },
    ...over,
  }) as SupplierRequest;

const render = (rows: SupplierRequest[]) =>
  renderToStaticMarkup(
    createElement(SupplierRequestTable, {
      rows,
      currentId: rows[0].id,
      slaMinutes: 1440,
      wellmix: false,
      legacy: new Map(),
      t: translator("pt"),
    }),
  );

describe("tabela da solicitação: programação em sublinhas", () => {
  it("uma sublinha por programação, numerada <nº>.<programação>", () => {
    const html = render([request()]);
    expect(html.match(/data-supplier-table-round="/g)).toHaveLength(3);
    for (const n of ["6.1", "6.2", "6.3"]) expect(html).toContain(`>${n}<`);
    // O produto e as programações num grupo próprio (abrem com os Detalhes).
    expect(html).toContain('data-supplier-table-group="sr-6"');
    expect(html).toContain('data-supplier-table-details="sr-6"');
    // Cada sublinha com a quantidade da programação.
    expect(
      html.match(/data-supplier-table-round-quantity="true">600</g),
    ).toHaveLength(3);
  });

  it("sem programação: um tbody só, sem sublinhas", () => {
    const html = render([request({ schedule: null, variant: null })]);
    expect(html).not.toContain("data-supplier-table-round=");
    expect(html).not.toContain("data-supplier-table-group=");
  });
});

describe("tabela da solicitação: embalagem modificada conta sets", () => {
  it("títulos em sets, a coluna Peças por set e o MOQ em sets", () => {
    const html = render([request()]);
    expect(html).toContain("Total de sets");
    expect(html).toContain("Sets por programação");
    expect(html).toContain("Sets/caixa master");
    expect(html).toContain("Peças por set");
    expect(html).toContain('data-supplier-table-pieces-per-set="sr-6">2<');
    expect(html).toContain("500 sets");
    // Sem a linha cinza com o total de peças.
    expect(html).not.toContain("3.600 peças");
  });

  it("sem embalagem modificada: peças, como sempre", () => {
    const html = render([request({ variant: null, schedule: null })]);
    expect(html).toContain("Total de peças");
    expect(html).not.toContain("Peças por set");
    expect(html).not.toContain("Total de sets");
  });
});
