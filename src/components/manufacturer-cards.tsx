import type { Translate } from "@/i18n";
import type { ManufacturerCard } from "@/lib/db";
import type { ProductCardRow } from "@/lib/services/manufacturer-cards";
import { updateManufacturerCardAction } from "@/app/app/actions/manufacturer-cards";
import { Badge, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

/** Selos do cartão: fábrica, possível intermediário, não lido, mock. */
function CardBadges({ t, card }: { t: Translate; card: ManufacturerCard }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {card.isFactory === true ? (
        <Badge tone="success">{t("card.factory")}</Badge>
      ) : card.isFactory === false ? (
        <Badge tone="warning">
          <span data-card-middleman="">{t("card.middleman")}</span>
        </Badge>
      ) : null}
      {card.source === "mock" ? (
        <Badge tone="warning">{t("card.mock")}</Badge>
      ) : card.source === "sheet" ? (
        <Badge tone="neutral">
          <span data-card-from-sheet="">{t("card.fromSheet")}</span>
        </Badge>
      ) : !card.source && !card.companyName ? (
        <Badge tone="neutral">{t("card.unread")}</Badge>
      ) : null}
    </span>
  );
}

/** Foto do cartão + o que foi lido. */
function CardSummary({ t, card }: { t: Translate; card: ManufacturerCard }) {
  const lines: Array<[string, string | null]> = [
    [t("card.contact"), card.contactName],
    [t("card.phone"), card.phone],
    [t("card.email"), card.email],
    [t("card.store"), card.storeAddress],
    [t("card.factoryAddress"), card.factoryAddress],
  ];
  return (
    <div className="flex min-w-0 gap-3">
      <a
        href={`/api/files/${card.documentId}`}
        target="_blank"
        rel="noreferrer"
        className="block shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white"
        title={t("card.view")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
        <img
          src={`/api/files/${card.documentId}`}
          alt={t("card.view")}
          loading="lazy"
          className="h-16 w-24 object-cover"
        />
      </a>
      <div className="min-w-0 space-y-0.5 text-sm">
        <p className="font-semibold text-zinc-900">{card.companyName ?? "—"}</p>
        {lines
          .filter(([, v]) => !!v)
          .map(([label, value]) => (
            <p key={label} className="text-xs text-zinc-600">
              <span className="text-zinc-500">{label}:</span> {value}
            </p>
          ))}
        <CardBadges t={t} card={card} />
      </div>
    </div>
  );
}

/** Corrigir o que a IA leu (quem enviou ou a Wellmix). */
function CardEdit({
  t,
  card,
  back,
}: {
  t: Translate;
  card: ManufacturerCard;
  back: string;
}) {
  const field = (
    name: keyof ManufacturerCard,
    label: string,
    max: number,
    long = false,
  ) => (
    <label className="block space-y-1 text-xs font-medium text-zinc-700">
      <span>{label}</span>
      {long ? (
        <textarea
          name={name}
          maxLength={max}
          rows={2}
          defaultValue={(card[name] as string | null) ?? ""}
          className={inputClass}
        />
      ) : (
        <input
          name={name}
          maxLength={max}
          defaultValue={(card[name] as string | null) ?? ""}
          className={inputClass}
        />
      )}
    </label>
  );
  return (
    <details className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2">
      <summary className="cursor-pointer text-xs font-semibold text-brand-700">
        {t("card.edit")}
      </summary>
      <form
        action={updateManufacturerCardAction}
        className="mt-2 grid gap-2 sm:grid-cols-2"
        key={card.updatedAt}
      >
        <input type="hidden" name="cardId" value={card.id} />
        <input type="hidden" name="back" value={back} />
        {field("companyName", t("card.company"), 160)}
        {field("contactName", t("card.contact"), 120)}
        {field("phone", t("card.phone"), 60)}
        {field("email", t("card.email"), 160)}
        {field("storeAddress", t("card.store"), 2000, true)}
        {field("factoryAddress", t("card.factoryAddress"), 2000, true)}
        <label className="block space-y-1 text-xs font-medium text-zinc-700">
          <span>{t("card.isFactory")}</span>
          <select
            name="isFactory"
            defaultValue={
              card.isFactory === true
                ? "yes"
                : card.isFactory === false
                  ? "no"
                  : ""
            }
            className={inputClass}
          >
            <option value="">{t("card.isFactory.unknown")}</option>
            <option value="yes">{t("card.isFactory.yes")}</option>
            <option value="no">{t("card.isFactory.no")}</option>
          </select>
        </label>
        <div className="flex items-end">
          <SubmitButton variant="secondary">{t("card.save")}</SubmitButton>
        </div>
      </form>
    </details>
  );
}

/** Todos os cartões do produto, por fornecedor (só a Wellmix). */
export function ProductManufacturerCards({
  t,
  productId,
  rows,
}: {
  t: Translate;
  productId: string;
  rows: ProductCardRow[];
}) {
  return (
    <Card title={t("card.productTitle")} dense>
      <div id="manufacturer-card" className="space-y-3 scroll-mt-24">
        <p className="text-xs text-zinc-600">{t("card.productHint")}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500" data-product-cards="0">
            {t("card.productNone")}
          </p>
        ) : (
          <ul className="space-y-2" data-product-cards={rows.length}>
            {rows.map(({ card, supplierName }) => (
              <li
                key={card.id}
                className="rounded-lg border border-zinc-200 p-2.5"
              >
                <p className="mb-1.5 text-xs text-zinc-500">
                  {t("card.supplier")}:{" "}
                  <span className="font-medium text-zinc-800">
                    {supplierName}
                  </span>
                </p>
                <CardSummary t={t} card={card} />
                <CardEdit
                  t={t}
                  card={card}
                  back={`/app/products/${productId}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
