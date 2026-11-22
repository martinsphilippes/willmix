"use client";

import { useState } from "react";

/*
 * Copia uma imagem para a área de transferência (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Imagens na tela do item"): quem negocia copia a
 * foto que está vendo e cola no chat, para citar um ponto. A imagem vai como
 * PNG (o formato que os navegadores aceitam copiar). Sem suporte no
 * navegador, copia o endereço da imagem.
 */

async function pngBlob(src: string): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob"))),
      "image/png",
    ),
  );
}

export function CopyImageButton({
  src,
  label,
  doneLabel,
}: {
  src: string;
  /** "Copiar a imagem para colar no chat". */
  label: string;
  /** "Copiada". */
  doneLabel: string;
}) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      if (!("ClipboardItem" in window)) throw new Error("unsupported");
      await navigator.clipboard.write([
        // A promessa vai direto no item: o Safari exige a cópia no clique.
        new ClipboardItem({ "image/png": pngBlob(src) }),
      ]);
    } catch {
      try {
        await navigator.clipboard.writeText(
          new URL(src, window.location.href).toString(),
        );
      } catch {
        return;
      }
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={done ? doneLabel : label}
      aria-label={done ? doneLabel : label}
      data-copy-image={done ? "done" : "idle"}
      className="absolute right-0.5 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-zinc-600 shadow ring-1 ring-zinc-200 transition hover:bg-white hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      {done ? (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5 text-emerald-600"
          aria-hidden
        >
          <path
            d="m4 10 4 4 8-8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <rect x="7" y="7" width="9" height="9" rx="1.5" />
          <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
        </svg>
      )}
    </button>
  );
}
