"use client";

/* eslint-disable @next/next/no-img-element -- prévia de arquivo protegido em /api/files; next/image não se aplica. */
import { useEffect, useRef } from "react";
import { isPreviewablePhoto, placePhotoPreview } from "@/lib/photo-preview";

/*
 * Prévia grande e flutuante de qualquer foto do portal ao passar o mouse.
 * Fica uma vez só no layout raiz e escuta o documento inteiro: toda <img>
 * (miniatura de tabela, galeria, anexo) ganha a prévia sem mudar a tela que
 * a desenha, então tamanho, posição e clique da foto continuam como estão.
 * A prévia abre na camada do topo do navegador (popover), por cima de
 * tabelas, cartões e janelas, e não recebe o mouse. Só o mouse abre: toque
 * e caneta seguem como antes. Regras de tamanho e posição em
 * src/lib/photo-preview.ts.
 */
export function PhotoHoverPreview() {
  const box = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const layer = box.current;
    const big = image.current;
    if (!layer || !big) return;
    let current: HTMLImageElement | null = null;

    const hide = () => {
      if (!current) return;
      current.removeEventListener("load", place);
      current = null;
      layer.style.display = "none";
      try {
        layer.hidePopover?.();
      } catch {
        // já estava fechada
      }
      big.removeAttribute("src");
    };

    function place() {
      const thumb = current;
      if (!thumb || !thumb.isConnected) return hide();
      const rect = thumb.getBoundingClientRect();
      const spot = placePhotoPreview(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        { width: thumb.naturalWidth, height: thumb.naturalHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      if (!spot) {
        layer!.style.display = "none";
        return;
      }
      const src = thumb.currentSrc || thumb.src;
      if (big!.getAttribute("src") !== src) big!.src = src;
      layer!.style.left = `${spot.left}px`;
      layer!.style.top = `${spot.top}px`;
      layer!.style.width = `${spot.width}px`;
      layer!.style.height = `${spot.height}px`;
      layer!.style.display = "block";
      try {
        // Reabre para ficar por cima de janela aberta depois (camada do topo).
        layer!.hidePopover?.();
        layer!.showPopover?.();
      } catch {
        // navegador sem popover: fica como camada fixa
      }
    }

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target;
      if (target === current) return;
      hide();
      if (!(target instanceof HTMLImageElement) || layer.contains(target))
        return;
      let pathname: string;
      try {
        pathname = new URL(target.currentSrc || target.src, location.href)
          .pathname;
      } catch {
        return;
      }
      if (!isPreviewablePhoto(pathname)) return;
      current = target;
      // Foto ainda carregando: a prévia aparece quando o tamanho for conhecido.
      if (target.complete && target.naturalWidth > 0) place();
      else target.addEventListener("load", place, { once: true });
    };
    const onOut = (event: PointerEvent) => {
      if (event.target === current) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    // Clique (abre galeria, link), rolagem e troca de janela fecham a prévia.
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <div
      ref={box}
      popover="manual"
      aria-hidden="true"
      data-photo-preview
      style={{ display: "none" }}
      className="pointer-events-none fixed inset-auto z-[1000] m-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 shadow-2xl"
    >
      <img ref={image} alt="" className="h-full w-full object-contain" />
    </div>
  );
}
