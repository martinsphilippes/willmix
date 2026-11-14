"use client";

import { useRef, useState } from "react";
import { cx } from "./ui";

/*
 * Foto da linha que abre a galeria do produto: tocar na miniatura mostra
 * todas as fotos em quadrados pequenos (cabem muitas) e uma grande em cima;
 * tocar num quadrado troca a grande. Os arquivos vêm de /api/files, que
 * confere o acesso de quem está vendo.
 */

export interface GalleryPhoto {
  id: string;
  label: string | null;
}

export function PhotoGallery({
  photos,
  name,
  labels,
  className = "h-10 w-10",
}: {
  photos: GalleryPhoto[];
  name: string;
  labels: {
    title: string;
    close: string;
    open: string;
    count: string;
    noPhoto: string;
  };
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(0);
  const base =
    "shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100";
  if (!photos.length)
    return (
      <span
        aria-label={labels.noPhoto}
        className={cx(
          base,
          "flex items-center justify-center text-lg text-zinc-400",
          className,
        )}
      >
        <span aria-hidden>📷</span>
      </span>
    );
  const shown = photos[Math.min(current, photos.length - 1)];
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCurrent(0);
          dialog.current?.showModal();
        }}
        title={labels.title}
        aria-label={labels.title}
        className={cx(
          base,
          "relative block cursor-zoom-in transition hover:ring-2 hover:ring-brand-500 focus-visible:outline-2 focus-visible:outline-brand-600",
          className,
        )}
        data-gallery-open
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
        <img
          src={`/api/files/${photos[0].id}?thumb=1`}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {photos.length > 1 ? (
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-zinc-900/75 px-1 text-[10px] font-semibold leading-4 text-white">
            {photos.length}
          </span>
        ) : null}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl backdrop:bg-zinc-900/50"
        onClick={(e) => {
          // Toque fora do quadro fecha.
          if (e.target === dialog.current) dialog.current?.close();
        }}
        data-gallery
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-900">
              {name}
            </h2>
            <p className="text-xs text-zinc-500">{labels.count}</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={labels.close}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 p-4">
          <a
            href={`/api/files/${shown.id}`}
            target="_blank"
            rel="noreferrer"
            title={labels.open}
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={`/api/files/${shown.id}`}
              alt={shown.label ?? name}
              className="mx-auto h-[45vh] w-full rounded-lg bg-zinc-50 object-contain"
            />
          </a>
          {shown.label ? (
            <p className="text-center text-xs text-zinc-600">{shown.label}</p>
          ) : null}
          <ul
            className="grid grid-cols-[repeat(auto-fill,4.5rem)] gap-2"
            data-gallery-grid
          >
            {photos.map((ph, i) => (
              <li key={ph.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(i)}
                  title={ph.label ?? undefined}
                  className={cx(
                    "block aspect-square w-full overflow-hidden rounded-md border bg-zinc-50",
                    i === current
                      ? "border-brand-600 ring-2 ring-brand-600"
                      : "border-zinc-200 hover:border-zinc-400",
                  )}
                  data-gallery-item
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img
                    src={`/api/files/${ph.id}?thumb=1`}
                    alt={ph.label ?? name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
