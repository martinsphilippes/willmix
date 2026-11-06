import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  inProductFilter,
  matchesProduct,
  productThumbId,
  readProductFilter,
} from "@/lib/services/product-list";

const base = {
  name: "Jarra de vidro 1,5 L",
  sku: "JAR-15",
  supplierSku: "220057",
  category: "Cozinha",
  notes: "Caixa de cores",
  specification: null,
};

describe("lista de produtos", () => {
  it("busca sem acento por nome, código do fornecedor, observação e fornecedor", () => {
    expect(matchesProduct(base, "Ningbo", "")).toBe(true);
    expect(matchesProduct(base, "Ningbo", "220057")).toBe(true);
    expect(matchesProduct(base, "Ningbo", "CAIXA")).toBe(true);
    expect(matchesProduct(base, "Ningbo", "ningbo")).toBe(true);
    expect(
      matchesProduct({ ...base, category: "Decoração" }, "", "decoracao"),
    ).toBe(true);
    expect(matchesProduct(base, "Ningbo", "panela")).toBe(false);
  });

  it("filtra por linha e por fornecedor principal ou vinculado", () => {
    const p = { id: "p1", lineId: "l1", supplierId: "s1" };
    expect(inProductFilter(p, { lineId: "", supplierId: "" }, new Set())).toBe(
      true,
    );
    expect(
      inProductFilter(p, { lineId: "l2", supplierId: "" }, new Set()),
    ).toBe(false);
    expect(
      inProductFilter(p, { lineId: "", supplierId: "s1" }, new Set()),
    ).toBe(true);
    expect(
      inProductFilter(p, { lineId: "", supplierId: "s2" }, new Set(["s2"])),
    ).toBe(true);
    expect(
      inProductFilter(p, { lineId: "", supplierId: "s3" }, new Set(["s2"])),
    ).toBe(false);
  });

  it("foto da linha: principal, depois a marcada, depois a primeira", () => {
    const photos = [
      { productId: "p1", documentId: "d1", isPrimary: false },
      { productId: "p1", documentId: "d2", isPrimary: true },
      { productId: "p2", documentId: "d3", isPrimary: false },
    ];
    expect(
      productThumbId({ id: "p1", primaryPhotoDocumentId: "d0" }, photos),
    ).toBe("d0");
    expect(
      productThumbId({ id: "p1", primaryPhotoDocumentId: null }, photos),
    ).toBe("d2");
    expect(
      productThumbId({ id: "p2", primaryPhotoDocumentId: null }, photos),
    ).toBe("d3");
    expect(
      productThumbId({ id: "p9", primaryPhotoDocumentId: null }, photos),
    ).toBeNull();
  });

  it("lê filtros da URL com limite de tamanho", () => {
    expect(readProductFilter({ q: ["  jarra ", "x"], line: "l1" })).toEqual({
      q: "jarra",
      lineId: "l1",
      supplierId: "",
    });
    expect(readProductFilter({ q: "a".repeat(200) }).q.length).toBe(120);
  });
});
