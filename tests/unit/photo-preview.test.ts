import { describe, expect, it } from "vitest";
import {
  PREVIEW_GAP,
  PREVIEW_MARGIN,
  PREVIEW_MAX,
  isPreviewablePhoto,
  placePhotoPreview,
} from "@/lib/photo-preview";

/*
 * Prévia da foto ao passar o mouse: mantém a proporção, cabe na janela,
 * não cobre a miniatura e não aparece quando a foto já está grande.
 */
const VIEW = { width: 1280, height: 800 };
const thumb = (left: number, top: number, size = 48) => ({
  left,
  top,
  width: size,
  height: size,
});

function inside(box: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  expect(box.left).toBeGreaterThanOrEqual(PREVIEW_MARGIN);
  expect(box.top).toBeGreaterThanOrEqual(PREVIEW_MARGIN);
  expect(box.left + box.width).toBeLessThanOrEqual(VIEW.width - PREVIEW_MARGIN);
  expect(box.top + box.height).toBeLessThanOrEqual(
    VIEW.height - PREVIEW_MARGIN,
  );
}

describe("placePhotoPreview", () => {
  it("abre à direita da miniatura, na proporção original", () => {
    const box = placePhotoPreview(
      thumb(100, 300),
      { width: 1600, height: 1200 },
      VIEW,
    )!;
    expect(box.width).toBe(PREVIEW_MAX);
    expect(box.height).toBe(480);
    expect(box.left).toBe(100 + 48 + PREVIEW_GAP);
    inside(box);
  });

  it("vai para a esquerda quando a miniatura está na borda direita", () => {
    const anchor = thumb(1200, 300);
    const box = placePhotoPreview(anchor, { width: 1600, height: 1200 }, VIEW)!;
    expect(box.left + box.width).toBe(anchor.left - PREVIEW_GAP);
    inside(box);
  });

  it("não sai da janela com a miniatura no canto de baixo", () => {
    const box = placePhotoPreview(
      thumb(20, 740),
      { width: 900, height: 1600 },
      VIEW,
    )!;
    expect(box.width / box.height).toBeCloseTo(900 / 1600, 2);
    inside(box);
  });

  it("janela estreita: abre abaixo ou acima, sem cobrir a miniatura", () => {
    const view = { width: 400, height: 800 };
    const anchor = thumb(176, 100);
    const box = placePhotoPreview(anchor, { width: 1200, height: 1200 }, view)!;
    expect(box.top).toBe(anchor.top + anchor.height + PREVIEW_GAP);
    expect(box.left + box.width).toBeLessThanOrEqual(
      view.width - PREVIEW_MARGIN,
    );
    expect(box.top + box.height).toBeLessThanOrEqual(
      view.height - PREVIEW_MARGIN,
    );
  });

  it("não amplia além do tamanho do arquivo", () => {
    const box = placePhotoPreview(
      thumb(100, 300),
      { width: 200, height: 100 },
      VIEW,
    )!;
    expect(box).toMatchObject({ width: 200, height: 100 });
  });

  it("foto que já está grande na tela fica sem prévia", () => {
    expect(
      placePhotoPreview(
        { left: 100, top: 100, width: 500, height: 500 },
        { width: 1600, height: 1600 },
        VIEW,
      ),
    ).toBeNull();
    expect(
      placePhotoPreview(thumb(100, 300), { width: 60, height: 60 }, VIEW),
    ).toBeNull();
    expect(
      placePhotoPreview(thumb(100, 300), { width: 0, height: 0 }, VIEW),
    ).toBeNull();
  });
});

describe("isPreviewablePhoto", () => {
  it("fotos sim, arquivos da marca não", () => {
    expect(isPreviewablePhoto("/api/files/abc")).toBe(true);
    expect(isPreviewablePhoto("/brand/wellmix-logo.svg")).toBe(false);
  });
});
