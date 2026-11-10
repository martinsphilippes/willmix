import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import {
  loadSuperplanContext,
  superplanPrefillsFor,
} from "@/lib/services/superplan-analysis";
import {
  EMPTY_SUPERPLAN_PREFILL,
  type SuperplanPrefill,
} from "@/lib/superplan-defaults";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { pt as superplanTexts } from "@/i18n/modules/superplan";
import { ActionError } from "@/components/action-error";
import { Alert, Card, PageHeader, TextLink, formatDate } from "@/components/ui";
import {
  SuperplanCalculator,
  type SuperplanLabels,
} from "@/components/superplan-calculator";
import { saveBookingAnalysisAction } from "../actions/booking";
import { superplanSupplierOptions } from "@/lib/services/superplan-rfq";
import { STOCK_PARTY_ID } from "@/lib/services/purchase-flow";
import { SuperplanParamsForm } from "./_components/params-form";

/*
 * Superplan (Pedidos → Superplan, só o administrador; docs/SUPERPLAN.md):
 * viabilidade de um produto importado e o preço por que a Wellmix deve
 * vender. Escolher um produto do cadastro preenche preço, caixa, pesos
 * (líquido e bruto), volume e os impostos do NCM; câmbio, container, despesas
 * e tipo de negócio vêm do sistema. A conta é feita na tela, ao vivo (nada é
 * gravado). Embaixo: como o cálculo é feito e, para o administrador, os
 * parâmetros. Os dados do produto e do sistema vêm de
 * services/superplan-analysis.ts, o mesmo caminho da análise em lote.
 *
 * Aberto por uma linha do Booking (`?booking=<id>`, docs/BOOKING.md): a tela
 * já vem com o produto da linha e ganha "Gravar no Booking", que guarda a
 * simulação na linha (o resultado é refeito no servidor).
 *
 * Viabilidade feita: o administrador abre, daqui, a faca e a RFQ com o
 * fornecedor ganho (docs/SUPERPLAN.md, "Da viabilidade à faca e à RFQ").
 */

const PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/;
const BOOKING_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Texto da tela (para o componente da simulação), no idioma de quem vê. */
function labelsFor(t: Awaited<ReturnType<typeof getT>>): SuperplanLabels {
  return Object.fromEntries(
    Object.keys(superplanTexts).map((key) => [key, t(key as DictionaryKey)]),
  ) as SuperplanLabels;
}

/** Número curto para a versão dos parâmetros (remonta a simulação ao salvar). */
function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export default async function SuperplanPage({
  searchParams,
}: PageProps<"/app/superplan">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/superplan");
  requireScreen(user, "superplan");
  const t = await getT();
  const query = await searchParams;
  // Aberto por uma linha do Booking (só para quem também abre o Booking): o
  // produto é o da linha, não o do endereço.
  const bookingId =
    typeof query.booking === "string" &&
    BOOKING_ID.test(query.booking) &&
    canOpen(user, "booking")
      ? query.booking
      : null;
  const bookingRow = bookingId
    ? await getStore().get("bookings", bookingId)
    : null;
  const productId = bookingRow
    ? bookingRow.productId
    : typeof query.product === "string" && PRODUCT_ID.test(query.product)
      ? query.product
      : null;

  const [ctx, products, prefills] = await Promise.all([
    loadSuperplanContext({
      formatDay: (day) => formatDate(`${day}T12:00:00Z`, t),
    }),
    getStore().list("products", { filter: { active: true }, orderBy: "name" }),
    // Produto desativado continua abrindo pelo endereço, como sempre abriu;
    // pela linha do Booking, só produto que está no cadastro.
    productId
      ? superplanPrefillsFor([productId], { includeInactive: !bookingRow })
      : null,
  ]);
  const { params } = ctx;
  const loaded = productId ? (prefills?.get(productId) ?? null) : null;
  /** A linha do Booking com o produto no cadastro: dá para gravar a simulação. */
  const booking = bookingRow && loaded ? bookingRow : null;
  const prefill: SuperplanPrefill = loaded ?? EMPTY_SUPERPLAN_PREFILL;
  const decimal = t.intl.startsWith("pt") ? "," : ".";
  const admin = isAdmin(user);
  // Abrir a faca e a RFQ com o fornecedor ganho: só o administrador, com um
  // produto do cadastro.
  const rfq =
    admin && loaded
      ? {
          suppliers: await superplanSupplierOptions(loaded.productId),
          customers: (
            await getStore().list("parties", {
              filter: { type: "customer", active: true },
              orderBy: "name",
            })
          )
            .filter((c) => c.id !== STOCK_PARTY_ID)
            .map((c) => ({ id: c.id, name: c.name })),
        }
      : null;

  const errorCode = typeof query.error === "string" ? query.error : "";
  // Recusa ao abrir a faca e a RFQ (mostrada em cima, perto da simulação).
  const fromRfq = query.rfq === "1";
  const errorText = !errorCode
    ? null
    : errorCode === "invalid_input"
      ? // Pela linha do Booking, a recusa é da simulação, não dos parâmetros.
        bookingRow
        ? t("booking.superplan.invalid")
        : t("superplan.error.invalid")
      : ([
          `superplan.error.${errorCode}`,
          `booking.error.${errorCode}`,
          `common.${errorCode}`,
        ]
          .map((k) => [k, t(k as DictionaryKey)] as const)
          .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, errorCode));

  const how = (key: DictionaryKey) =>
    t(key, {
      spread: params.futureSpreadBrl.toLocaleString(t.intl),
      freightFx: params.freightFxPct.toLocaleString(t.intl),
      afrmm: params.afrmmPct.toLocaleString(t.intl),
      fixed: params.afrmmFixedBrl.toLocaleString(t.intl),
      gross: params.grossEstimatePct.toLocaleString(t.intl),
    });

  return (
    <>
      <PageHeader
        title={t("superplan.title")}
        subtitle={t("superplan.subtitle")}
      />
      {errorText && fromRfq && !bookingId ? (
        <div className="mb-4" data-superplan-error>
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {bookingId ? (
        <div className="mb-4 space-y-2" data-superplan-booking>
          {booking ? (
            <Alert tone="brand">
              {t("booking.superplan.banner", {
                name: prefill.productName ?? booking.productId,
              })}{" "}
              <TextLink href={`/app/booking/${booking.id}`}>
                {t("booking.superplan.back")}
              </TextLink>
            </Alert>
          ) : (
            <Alert tone="warning">
              {t("booking.superplan.missing")}{" "}
              <TextLink href="/app/booking/products">
                {t("booking.detail.back")}
              </TextLink>
            </Alert>
          )}
          {booking && errorText ? (
            <Alert tone="danger">{errorText}</Alert>
          ) : null}
        </div>
      ) : null}
      <SuperplanCalculator
        key={`${booking?.id ?? ""}:${prefill.productId ?? "none"}:${hash(JSON.stringify(params))}`}
        labels={labelsFor(t)}
        intl={t.intl}
        products={products.map((p) => ({
          id: p.id,
          label: [p.sku, p.name].filter(Boolean).join(" · "),
        }))}
        prefill={prefill}
        // Média do despachante (ficha mestre): só informação na tela.
        averageUsd={loaded ? loaded.averageUsd : undefined}
        // Peso médio (ficha mestre): mostrado na Compra, fora da conta.
        averageWeightKg={loaded ? loaded.averageWeightKg : null}
        ctx={ctx}
        rfq={rfq}
        save={
          booking
            ? {
                action: saveBookingAnalysisAction,
                hidden: { bookingId: booking.id },
                title: t("booking.superplan.title"),
                hint: t("booking.superplan.hint"),
                submit: t("booking.superplan.save"),
              }
            : undefined
        }
      />

      <details
        className="mt-6 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
        data-superplan-how
      >
        <summary className="cursor-pointer text-base font-semibold text-zinc-900">
          {t("superplan.how.title")}
        </summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700">
          {(
            [
              "superplan.how.1",
              "superplan.how.2",
              "superplan.how.3",
              "superplan.how.4",
              "superplan.how.5",
              "superplan.how.6",
              "superplan.how.7",
            ] as const
          ).map((key) => (
            <li key={key}>{how(key)}</li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-zinc-600">
          {t("superplan.how.change")}
        </p>
      </details>

      {admin ? (
        <section id="parametros" className="mt-6 scroll-mt-4 space-y-3">
          <div className="border-l-4 border-brand-600 pl-3">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              {t("superplan.params.title")}
            </h2>
            <p className="text-sm text-zinc-600">
              {t("superplan.params.hint")}
            </p>
          </div>
          {/* Recusa do "Gravar no Booking": já aparece em cima, junto da simulação. */}
          {booking || fromRfq ? null : (
            <ActionError
              t={t}
              code={errorCode}
              text={errorText}
              fields={query.fields}
              token={query.at}
            />
          )}
          {query.saved ? (
            <Alert tone="success">{t("superplan.params.saved")}</Alert>
          ) : null}
          <SuperplanParamsForm t={t} params={params} decimal={decimal} />
        </section>
      ) : errorText && !booking && !fromRfq ? (
        <Card className="mt-6">
          <Alert tone="danger">{errorText}</Alert>
        </Card>
      ) : null}
    </>
  );
}
