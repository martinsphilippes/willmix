import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { SupplierRequest, SupplierRequestVariant } from "@/lib/db/schema";
import { variantFacts } from "@/lib/selection-packing";
import type { RequestBookSpecs } from "@/lib/supplier-request-specs";
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

/**
 * Rótulos do preço, do mínimo, da caixa e dos pesos quando a cotação conta
 * embalagens (variação × embalagem com N ≥ 2): o fornecedor responde por
 * embalagem, não por peça (dono, 26/11/2026).
 */
export function packLabels(
  units: number | null | undefined,
  t: Translate,
): {
  price: string;
  moq: string;
  master: string | null;
  net: string | null;
  gross: string | null;
} {
  const n = Math.max(1, units ?? 1);
  return n > 1
    ? {
        price: t("supplierRequests.variant.label.price", { n }),
        moq: t("supplierRequests.variant.label.moq"),
        master: t("supplierRequests.variant.label.master"),
        net: t("supplierRequests.variant.label.net"),
        gross: t("supplierRequests.variant.label.gross"),
      }
    : {
        price: t("negotiationScreen.f.price"),
        moq: t("negotiationScreen.f.moq"),
        master: null,
        net: null,
        gross: null,
      };
}

function Fact({
  label,
  mark,
  children,
}: {
  label: string;
  mark: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0" data-request-variant-fact={mark}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="break-words text-sm text-zinc-900">{children}</dd>
    </div>
  );
}

/*
 * Variação × embalagem da cotação (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Embalagens e variações"): tudo o que a Seleção pôs no SKU, para o
 * fornecedor continuar de onde o trabalho parou: a variação (digitada ou do
 * Book), a embalagem, a caixa master (com a alteração e a do Book), o CBM, o
 * preço e o mínimo por embalagem e por peça, a quantidade em embalagens,
 * peças e caixas (por entrega), o Mix de cores e a arte de exemplo. A
 * Wellmix e o fornecedor veem o mesmo; o preço, só com `showPrice`.
 */
export function RequestVariant({
  request,
  book,
  showPrice,
  t,
}: {
  request: Pick<SupplierRequest, "variant" | "item" | "quantity" | "schedule">;
  /** O item do Book, para o que a cotação não guardou (abertas antes). */
  book?: Partial<RequestBookSpecs> | null;
  showPrice: boolean;
  t: Translate;
}) {
  const f = variantFacts(request, book);
  if (!f) return null;
  const num = (v: number | null, max = 4) =>
    v === null ? "—" : v.toLocaleString(t.intl, { maximumFractionDigits: max });
  const money = (v: number | null) =>
    v === null ? "—" : `${num(v)}${f.currency ? ` ${f.currency}` : ""}`;
  const packed = f.units > 1;
  const inUnits = (n: number | null) =>
    n === null
      ? "—"
      : packed
        ? t("supplierRequests.variant.packs", { n: num(n, 0) })
        : t("supplierRequests.detail.pieces", { n: num(n, 0) });
  const piecesParen = (n: number | null) =>
    packed && n !== null
      ? ` ${t("supplierRequests.variant.piecesParen", { n: num(n, 0) })}`
      : "";
  return (
    <section
      className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3"
      data-request-variant={f.key}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
            {t("supplierRequests.variant.title")}
            {f.mix ? (
              <Badge tone="info">{t("supplierRequests.variant.mix")}</Badge>
            ) : null}
          </p>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {f.variation ? (
              <Fact
                label={t("supplierRequests.variant.f.variation")}
                mark="variation"
              >
                <span className="font-medium" data-request-variant-variation>
                  {f.variation}
                </span>
                {f.custom ? (
                  <span className="block text-xs text-zinc-600">
                    {t("supplierRequests.variant.custom")}
                  </span>
                ) : null}
              </Fact>
            ) : null}
            <Fact label={t("supplierRequests.variant.f.pack")} mark="pack">
              <span data-request-variant-pack={f.units}>
                {packed
                  ? t("supplierRequests.variant.pack", {
                      n: f.units,
                      m: num(f.perCarton, 0),
                    })
                  : t("supplierRequests.variant.unit", {
                      m: num(f.perCarton, 0),
                    })}
              </span>
            </Fact>
            <Fact label={t("supplierRequests.variant.f.carton")} mark="carton">
              <span data-request-variant-carton={f.pieceCarton ?? ""}>
                {t("supplierRequests.variant.cartonPieces", {
                  n: num(f.pieceCarton, 0),
                })}
              </span>
              {f.altered ? (
                <span
                  className="block text-xs text-amber-800"
                  data-request-variant-altered={f.bookCarton ?? ""}
                >
                  {t("supplierRequests.variant.altered", {
                    n: num(f.bookCarton, 0),
                  })}
                </span>
              ) : null}
            </Fact>
            <Fact label={t("supplierRequests.variant.f.cbm")} mark="cbm">
              <span data-request-variant-cbm>
                {t("supplierRequests.variant.cbmValue", { v: num(f.cbm) })}
              </span>
              {f.altered && f.bookCbm !== null ? (
                <span className="block text-xs text-amber-800">
                  {t("supplierRequests.variant.cbmAltered", {
                    v: num(f.bookCbm),
                    to: num(f.pieceCarton, 0),
                    from: num(f.bookCarton, 0),
                  })}
                </span>
              ) : null}
            </Fact>
            {showPrice ? (
              <Fact label={t("supplierRequests.variant.f.price")} mark="price">
                <span data-request-variant-price>
                  {packed
                    ? t("supplierRequests.variant.pricePack", {
                        p: money(f.price),
                      })
                    : t("supplierRequests.variant.pricePiece", {
                        p: money(f.price),
                      })}
                </span>
                {packed && f.piecePrice !== null ? (
                  <span className="block text-xs text-zinc-600">
                    {t("supplierRequests.variant.priceFrom", {
                      p: money(f.piecePrice),
                      n: f.units,
                    })}
                  </span>
                ) : null}
              </Fact>
            ) : null}
            <Fact label={t("supplierRequests.variant.f.moq")} mark="moq">
              <span data-request-variant-moq>
                {inUnits(f.moq)}
                {piecesParen(f.moqPieces)}
              </span>
            </Fact>
            <Fact
              label={t("supplierRequests.variant.f.quantity")}
              mark="quantity"
            >
              <span className="font-medium" data-request-variant-quantity>
                {inUnits(f.quantity)}
                {piecesParen(f.pieces)}
              </span>
              {f.cartons !== null ? (
                <span className="block text-xs text-zinc-600">
                  {t("supplierRequests.variant.cartons", {
                    n: num(f.cartons, 0),
                  })}
                </span>
              ) : null}
            </Fact>
          </dl>
          {packed ? (
            <p className="text-xs text-zinc-600" data-request-variant-note>
              {t("supplierRequests.variant.unitsNote", { n: f.units })}
            </p>
          ) : null}
        </div>
        <figure
          className="space-y-1"
          data-request-variant-art={f.artDocumentId ?? ""}
        >
          {f.artDocumentId ? (
            <a
              href={`/api/files/${f.artDocumentId}`}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
              <img
                src={`/api/files/${f.artDocumentId}`}
                alt={t("supplierRequests.variant.art")}
                className="h-40 w-40 rounded-lg border border-zinc-200 bg-white object-contain"
              />
            </a>
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-2 text-center text-xs text-zinc-500">
              {t("supplierRequests.variant.noArt")}
            </div>
          )}
          <figcaption
            className="max-w-40 text-[11px] text-zinc-500"
            title={t("supplierRequests.variant.artHint")}
          >
            {f.mix
              ? t("supplierRequests.variant.artMix")
              : t("supplierRequests.variant.art")}
          </figcaption>
        </figure>
      </div>
      <RoundsTable f={f} t={t} />
    </section>
  );
}

type Facts = NonNullable<ReturnType<typeof variantFacts>>;

/** As entregas da variação, em embalagens, peças e caixas. */
function RoundsTable({ f, t }: { f: Facts; t: Translate }) {
  if (!f.rounds.length) return null;
  const num = (v: number | null, max = 4) =>
    v === null ? "—" : v.toLocaleString(t.intl, { maximumFractionDigits: max });
  const packed = f.units > 1;
  return (
    <div className="overflow-x-auto" data-request-variant-rounds>
      <table className="min-w-full text-left text-xs">
        <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-1 pr-3 font-semibold">
              {t("purchaseRounds.col.round")}
            </th>
            <th className="py-1 pr-3 font-semibold">
              {t("purchaseRounds.col.date")}
            </th>
            {packed ? (
              <th className="py-1 pr-3 text-right font-semibold">
                {t("supplierRequests.variant.col.packs")}
              </th>
            ) : null}
            <th className="py-1 pr-3 text-right font-semibold">
              {t("purchaseRounds.col.pieces")}
            </th>
            <th className="py-1 text-right font-semibold">
              {t("supplierRequests.variant.col.cartons")}
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-zinc-800">
          {f.rounds.map((r) => (
            <tr
              key={r.index}
              className="border-t border-brand-100"
              data-request-variant-round={r.index}
            >
              <td className="py-1 pr-3">{r.index}</td>
              <td className="py-1 pr-3">
                {r.expectedAt
                  ? new Date(`${r.expectedAt}T12:00:00`).toLocaleDateString(
                      t.intl,
                    )
                  : "—"}
              </td>
              {packed ? (
                <td className="py-1 pr-3 text-right">{num(r.quantity, 0)}</td>
              ) : null}
              <td className="py-1 pr-3 text-right">{num(r.pieces, 0)}</td>
              <td className="py-1 text-right">{num(r.cartons, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Só as entregas da variação × embalagem (dono, 27/11/2026): a tela do
 * fornecedor tirou o quadro "Variação e embalagem" (informação repetida) e
 * mostra a programação na própria seção. Nulo sem variação ou sem entregas.
 */
export function VariantRoundsTable({
  request,
  book,
  t,
}: {
  request: Pick<SupplierRequest, "variant" | "item" | "quantity" | "schedule">;
  book?: Partial<RequestBookSpecs> | null;
  t: Translate;
}) {
  const f = variantFacts(request, book);
  return f ? <RoundsTable f={f} t={t} /> : null;
}
