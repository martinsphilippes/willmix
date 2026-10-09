import type { Translate } from "@/i18n";
import { fallbackError } from "@/i18n/error-text";
import { aiErrorText } from "@/i18n/ai-error";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Document, MarketingKit, MarketingKitStatus } from "@/lib/db";
import {
  Badge,
  Empty,
  StepDot,
  TextLink,
  cx,
  formatDate,
  type StepState,
  type Tone,
} from "@/components/ui";

/*
 * Peças compartilhadas do marketing studio (lista, novo kit e studio):
 * tom por situação, linha do tempo, erros traduzidos e miniaturas de arquivos.
 * Tudo Server Component: nada é lido no browser.
 */

/** Tom do selo por situação: neutro (rascunho/prévia/cancelado), marca (oferta), atenção (compra), sucesso (pago/liberado). */
export const kitStatusTone: Record<MarketingKitStatus, Tone> = {
  draft: "neutral",
  preview: "neutral",
  offered: "brand",
  purchased: "warning",
  paid: "success",
  released: "success",
  cancelled: "neutral",
};

export function KitStatusBadge({
  t,
  status,
}: {
  t: Translate;
  status: MarketingKitStatus;
}) {
  return (
    <Badge tone={kitStatusTone[status]}>
      {t(`marketing.status.${status}` as DictionaryKey)}
    </Badge>
  );
}

/** Mensagem de ?error=: traduzida quando o código é do módulo; senão a genérica com o código. */
export function marketingError(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const reason = aiErrorText(t, code);
  if (reason) return reason;
  const key = `marketing.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? fallbackError(t, code) : text;
}

/** Etapas do kit na ordem do fluxo (cancelado fica à parte). */
export const KIT_STEPS = [
  "draft",
  "preview",
  "offered",
  "purchased",
  "paid",
  "released",
] as const;
type KitStep = (typeof KIT_STEPS)[number];

function stepDate(kit: MarketingKit, step: KitStep) {
  switch (step) {
    case "draft":
      return kit.createdAt;
    case "offered":
      return kit.offeredAt;
    case "purchased":
      return kit.purchasedAt;
    case "paid":
      return kit.paidAt;
    case "released":
      return kit.releasedAt;
    default:
      return null;
  }
}

/**
 * Linha do tempo Rascunho → Prévia → Oferta → Compra → Pagamento → Liberação (mesmos StepDot/stageTone do pedido).
 * Colunas pela largura do cartão (@container do pai): lista numa coluna estreita, grade num espaço largo.
 */
export function KitTimeline({ t, kit }: { t: Translate; kit: MarketingKit }) {
  const cancelled = kit.status === "cancelled";
  const current = KIT_STEPS.indexOf(kit.status as KitStep);
  const stateOf = (i: number): StepState =>
    cancelled || current < 0
      ? "pending"
      : i < current
        ? "done"
        : i === current
          ? kit.status === "released"
            ? "done"
            : "active"
          : "pending";
  return (
    <ol className="-mx-2 grid gap-x-3 gap-y-0.5 @md:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-6">
      {KIT_STEPS.map((step, i) => {
        const state = stateOf(i);
        const date = stepDate(kit, step);
        return (
          <li
            key={step}
            className={cx(
              "flex items-center gap-2 rounded-lg px-2 py-1 text-[13px]",
              state === "active" && "bg-brand-50",
            )}
          >
            <StepDot state={state}>{i + 1}</StepDot>
            <span
              className={cx(
                state === "pending"
                  ? "text-zinc-500"
                  : state === "active"
                    ? "font-semibold text-brand-800"
                    : "text-zinc-900",
              )}
            >
              {t(`marketing.step.${step}` as DictionaryKey)}
            </span>
            {date && state !== "pending" ? (
              <span className="ml-auto text-xs tabular-nums text-zinc-500">
                {formatDate(date, t)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Miniatura de imagem servida por /api/files (download controlado por papel e situação do kit). */
export function FileThumb({
  documentId,
  alt,
}: {
  documentId: string;
  alt: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arquivo servido pela API com controle de acesso
    <img
      src={`/api/files/${documentId}`}
      alt={alt}
      loading="lazy"
      className="aspect-square w-full rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
    />
  );
}

/**
 * Miniatura (imagem) ou link (PDF e outros) de um arquivo do kit, sempre via /api/files (acesso controlado).
 * Colunas pela largura do cartão (@container do pai): miniaturas pequenas, mais por linha.
 */
export function KitDocList({
  t,
  docs,
  empty,
}: {
  t: Translate;
  docs: Document[];
  empty: string;
}) {
  if (docs.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="grid grid-cols-3 gap-2 @md:grid-cols-4 @2xl:grid-cols-6">
      {docs.map((doc) => (
        <li key={doc.id} className="min-w-0 space-y-1">
          <a
            href={`/api/files/${doc.id}`}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            {doc.mime.startsWith("image/") ? (
              <FileThumb documentId={doc.id} alt={doc.name} />
            ) : (
              <span className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-2 text-center text-xs font-semibold uppercase text-zinc-500">
                {doc.mime === "application/pdf" ? "PDF" : doc.mime}
              </span>
            )}
          </a>
          <p className="truncate text-xs text-zinc-700" title={doc.name}>
            {doc.name}
          </p>
          <TextLink
            href={`/api/files/${doc.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs"
          >
            {t("common.download")}
          </TextLink>
        </li>
      ))}
    </ul>
  );
}
