"use client";

import { useState } from "react";
import { cx } from "./ui";

/**
 * Galeria da página do produto na vitrine: foto grande e miniaturas (toque
 * troca a foto). As fotos vêm de /api/files, que confere o acesso.
 */
export function ExploreGallery({
  photos,
  noPhotoLabel,
  photoLabel,
}: {
  photos: { documentId: string; caption: string }[];
  noPhotoLabel: string;
  /** "Foto {n} de {total}" já traduzido, com {n} e {total} a preencher. */
  photoLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? photos[0];
  if (!current)
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl border border-zinc-200/80 bg-zinc-50 text-sm text-zinc-400">
        {noPhotoLabel}
      </div>
    );
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {photos.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto sm:max-h-[32rem] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
          {photos.map((photo, i) => (
            <li key={photo.documentId} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                onMouseEnter={() => setIndex(i)}
                aria-label={photoLabel
                  .replace("{n}", String(i + 1))
                  .replace("{total}", String(photos.length))}
                aria-current={i === index ? "true" : undefined}
                className={cx(
                  "h-16 w-16 overflow-hidden rounded-xl border bg-white p-1 transition",
                  i === index
                    ? "border-brand-600 ring-2 ring-brand-200"
                    : "border-zinc-200 hover:border-zinc-400",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                <img
                  src={`/api/files/${photo.documentId}`}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
        <img
          src={`/api/files/${current.documentId}`}
          alt={current.caption}
          className="h-full w-full object-contain p-4"
          data-explore-main-photo={current.documentId}
        />
      </div>
    </div>
  );
}
