import type { Translate } from "@/i18n";
import type { SupplierRequestVariant } from "@/lib/db/schema";
import { Badge } from "@/components/ui";

/** A variação e a embalagem numa linha ("AZUL · Emb. 3 pç"); nulo sem variação. */
export function variantText(
  variant: SupplierRequestVariant | null | undefined,
  t: Translate,
): string | null {
  if (!variant) return null;
  const pack =
    variant.units > 1
      ? t("packing.option.pack", { n: variant.units })
      : t("packing.option.unit");
  return variant.variation ? `${variant.variation} · ${pack}` : pack;
}

/*
 * Variação × embalagem da cotação (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Embalagens e variações"): o SKU que a Wellmix está considerando, com a
 * variação, a embalagem (peças por embalagem e embalagens por caixa), o Mix
 * de cores e a arte de exemplo. A Wellmix e o fornecedor veem o mesmo.
 */
export function RequestVariant({
  variant,
  cartonQty,
  t,
}: {
  variant: SupplierRequestVariant | null | undefined;
  /** Embalagens por caixa master (a cópia do item da cotação). */
  cartonQty: number | null;
  t: Translate;
}) {
  if (!variant) return null;
  const per = cartonQty === null ? "—" : cartonQty.toLocaleString(t.intl);
  return (
    <section
      className="flex flex-wrap items-start gap-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3"
      data-request-variant={variant.key}
    >
      <div className="min-w-0 flex-1 space-y-1 text-sm text-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
          {t("supplierRequests.variant.title")}
        </p>
        {variant.variation ? (
          <p className="font-medium" data-request-variant-variation>
            {t("supplierRequests.variant.variation", { v: variant.variation })}
          </p>
        ) : null}
        <p data-request-variant-pack={variant.units}>
          {variant.units > 1
            ? t("supplierRequests.variant.pack", { n: variant.units, m: per })
            : t("supplierRequests.variant.unit", { m: per })}
        </p>
        {variant.units > 1 ? (
          <p className="text-xs text-zinc-600" data-request-variant-note>
            {t("supplierRequests.variant.unitsNote", { n: variant.units })}
          </p>
        ) : null}
        {variant.mix ? (
          <Badge tone="info">{t("supplierRequests.variant.mix")}</Badge>
        ) : null}
      </div>
      {variant.artDocumentId ? (
        <figure className="space-y-1" data-request-variant-art>
          <a
            href={`/api/files/${variant.artDocumentId}`}
            target="_blank"
            rel="noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={`/api/files/${variant.artDocumentId}`}
              alt={t("supplierRequests.variant.art")}
              className="h-28 w-28 rounded-lg border border-zinc-200 bg-white object-contain"
            />
          </a>
          <figcaption
            className="max-w-40 text-[11px] text-zinc-500"
            title={t("supplierRequests.variant.artHint")}
          >
            {t("supplierRequests.variant.art")}
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
