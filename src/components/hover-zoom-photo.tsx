"use client";

import { useState } from "react";
import { cx } from "./ui";

/** Tamanho da foto ampliada (px). */
const ZOOM = 256;

/**
 * Miniatura da foto do produto que amplia ao passar o mouse (dono,
 * 19/11/2026): a foto grande aparece ao lado, por cima da tela (posição
 * fixa: não é cortada pela lista com rolagem). Sem foto, um quadro vazio do
 * mesmo tamanho, para os nomes ficarem alinhados.
 */
export function HoverZoomPhoto({
  photoId,
  className,
  size = "h-10 w-10",
}: {
  photoId: string | null;
  className?: string;
  size?: string;
}) {
  const [zoom, setZoom] = useState<{ left: number; top: number } | null>(null);
  if (!photoId)
    return (
      <span
        aria-hidden
        className={cx(
          size,
          "shrink-0 rounded-md border border-dashed border-zinc-200 bg-zinc-50",
          className,
        )}
        data-hover-zoom-empty
      />
    );
  const src = `/api/files/${photoId}`;
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    // À direita da miniatura; sem espaço, à esquerda. Sempre dentro da tela.
    const right = r.right + 8 + ZOOM <= window.innerWidth;
    const left = right ? r.right + 8 : Math.max(8, r.left - 8 - ZOOM);
    const top = Math.min(
      Math.max(8, r.top + r.height / 2 - ZOOM / 2),
      Math.max(8, window.innerHeight - ZOOM - 8),
    );
    setZoom({ left, top });
  };
  return (
    <span
      className={cx("relative shrink-0", className)}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setZoom(null)}
      data-hover-zoom
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cx(
          size,
          "rounded-md border border-zinc-200 bg-white object-cover",
        )}
        data-hover-zoom-thumb
      />
      {zoom ? (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
        <img
          src={src}
          alt=""
          aria-hidden
          className="pointer-events-none fixed z-[70] rounded-xl border border-zinc-200 bg-white object-contain shadow-xl"
          style={{
            left: zoom.left,
            top: zoom.top,
            width: ZOOM,
            height: ZOOM,
          }}
          data-hover-zoom-large
        />
      ) : null}
    </span>
  );
}
