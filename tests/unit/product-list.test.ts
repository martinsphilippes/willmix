import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PRODUCT_PAGE_SIZE,
  inProductFilter,
  matchesProduct,
  productPage,
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

describe("galeria de fotos da linha", () => {
  it("principal primeiro, sem repetir, e inclui a principal fora da lista", async () => {
    const { productPhotoList } = await import("@/lib/services/product-list");
    const photos = [
      {
        productId: "p1",
        documentId: "a",
        isPrimary: false,
        kind: "original" as const,
      },
      {
        productId: "p1",
        documentId: "b",
        isPrimary: true,
        kind: "commercial" as const,
      },
      {
        productId: "p1",
        documentId: "c",
        isPrimary: false,
        kind: "packaging" as const,
      },
      {
        productId: "p2",
        documentId: "z",
        isPrimary: false,
        kind: "other" as const,
      },
    ];
    expect(
      productPhotoList({ id: "p1", primaryPhotoDocumentId: "c" }, photos).map(
        (p) => p.documentId,
      ),
    ).toEqual(["c", "b", "a"]);
    expect(
      productPhotoList({ id: "p1", primaryPhotoDocumentId: "x" }, photos).map(
        (p) => p.documentId,
      ),
    ).toEqual(["x", "b", "a", "c"]);
    expect(
      productPhotoList({ id: "p3", primaryPhotoDocumentId: null }, photos),
    ).toEqual([]);
  });
});

describe("páginas da lista de produtos", () => {
  it("mostra 50 por página e diz o intervalo de cada uma", () => {
    expect(PRODUCT_PAGE_SIZE).toBe(50);
    expect(productPage(19618, undefined)).toEqual({
      page: 1,
      pages: 393,
      start: 0,
      end: 50,
    });
    expect(productPage(19618, "2")).toMatchObject({ start: 50, end: 100 });
    // A última página traz só o resto.
    expect(productPage(19618, "393")).toEqual({
      page: 393,
      pages: 393,
      start: 19600,
      end: 19618,
    });
  });

  it("página fora do intervalo ou ilegível vira a mais próxima válida", () => {
    expect(productPage(120, "99").page).toBe(3);
    expect(productPage(120, "0").page).toBe(1);
    expect(productPage(120, "-4").page).toBe(1);
    expect(productPage(120, "abc").page).toBe(1);
    expect(productPage(120, "1.5").page).toBe(1);
    expect(productPage(120, ["2", "3"]).page).toBe(2);
  });

  it("lista vazia ou menor que uma página tem uma página só", () => {
    expect(productPage(0, undefined)).toEqual({
      page: 1,
      pages: 1,
      start: 0,
      end: 0,
    });
    expect(productPage(50, "1")).toEqual({
      page: 1,
      pages: 1,
      start: 0,
      end: 50,
    });
  });
});
