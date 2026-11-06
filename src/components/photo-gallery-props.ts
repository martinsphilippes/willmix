import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import type { GalleryPhoto } from "./photo-gallery";

/** Fotos e textos da galeria da linha, já no idioma de quem vê. */
export function galleryProps(
  t: Translate,
  list: { documentId: string; kind: string | null }[],
): {
  photos: GalleryPhoto[];
  labels: {
    title: string;
    close: string;
    open: string;
    count: string;
    noPhoto: string;
  };
} {
  const kindLabel = (kind: string | null) => {
    if (!kind) return null;
    const key = `catalog.photoKind.${kind}` as DictionaryKey;
    const text = t(key);
    return text === key ? null : text;
  };
  return {
    photos: list.map((p) => ({ id: p.documentId, label: kindLabel(p.kind) })),
    labels: {
      title: t("prodList.gallery.title"),
      close: t("prodList.gallery.close"),
      open: t("prodList.gallery.open"),
      count: t("prodList.gallery.count", { n: list.length }),
      noPhoto: t("prodList.noPhoto"),
    },
  };
}
