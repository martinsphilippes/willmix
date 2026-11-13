/*
 * Prévia grande da foto ao passar o mouse (src/components/photo-hover-preview.tsx).
 * Regras puras: tamanho e posição da prévia, sempre dentro da janela e sem
 * cobrir a miniatura. Medidas em px de tela.
 */

export interface PreviewBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PreviewSize {
  width: number;
  height: number;
}

/** Folga entre a prévia e a borda da janela. */
export const PREVIEW_MARGIN = 12;
/** Distância entre a miniatura e a prévia. */
export const PREVIEW_GAP = 12;
/** Maior lado da prévia. */
export const PREVIEW_MAX = 640;
/** A prévia só aparece se ficar pelo menos este tanto maior que a foto na tela. */
export const PREVIEW_MIN_GAIN = 1.5;

/** Arquivos da marca (logo, ícone) não são fotos: ficam sem prévia. */
export function isPreviewablePhoto(pathname: string): boolean {
  return !pathname.startsWith("/brand/");
}

/**
 * Onde a prévia cabe: ao lado da miniatura (direita, esquerda), senão abaixo
 * ou acima; ganha o lado em que ela fica maior. Mantém a proporção original,
 * não amplia além do tamanho do arquivo e devolve `null` quando a foto já
 * está grande na tela (a prévia não acrescentaria nada).
 */
export function placePhotoPreview(
  anchor: PreviewBox,
  natural: PreviewSize,
  viewport: PreviewSize,
): PreviewBox | null {
  if (natural.width <= 0 || natural.height <= 0) return null;
  const fullW = viewport.width - 2 * PREVIEW_MARGIN;
  const fullH = viewport.height - 2 * PREVIEW_MARGIN;
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  const beside = (space: number) => space - PREVIEW_GAP - PREVIEW_MARGIN;
  const sides = [
    { side: "right", w: beside(viewport.width - right), h: fullH },
    { side: "left", w: beside(anchor.left), h: fullH },
    { side: "bottom", w: fullW, h: beside(viewport.height - bottom) },
    { side: "top", w: fullW, h: beside(anchor.top) },
  ] as const;

  let best: { side: (typeof sides)[number]["side"]; scale: number } | null =
    null;
  for (const s of sides) {
    const scale = Math.min(
      1,
      PREVIEW_MAX / natural.width,
      PREVIEW_MAX / natural.height,
      s.w / natural.width,
      s.h / natural.height,
    );
    if (scale > 0 && (!best || scale > best.scale + 1e-6))
      best = { side: s.side, scale };
  }
  if (!best) return null;

  const width = Math.round(natural.width * best.scale);
  const height = Math.round(natural.height * best.scale);
  if (
    width < anchor.width * PREVIEW_MIN_GAIN &&
    height < anchor.height * PREVIEW_MIN_GAIN
  )
    return null;

  const clamp = (value: number, size: number, limit: number) =>
    Math.max(PREVIEW_MARGIN, Math.min(value, limit - PREVIEW_MARGIN - size));
  const centerX = anchor.left + anchor.width / 2 - width / 2;
  const centerY = anchor.top + anchor.height / 2 - height / 2;
  let left: number;
  let top: number;
  if (best.side === "right" || best.side === "left") {
    left =
      best.side === "right"
        ? right + PREVIEW_GAP
        : anchor.left - PREVIEW_GAP - width;
    top = clamp(centerY, height, viewport.height);
  } else {
    left = clamp(centerX, width, viewport.width);
    top =
      best.side === "bottom"
        ? bottom + PREVIEW_GAP
        : anchor.top - PREVIEW_GAP - height;
  }
  return { left: Math.round(left), top: Math.round(top), width, height };
}
