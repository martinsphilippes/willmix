import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getFxRates } from "@/lib/services/fx";
import { lookupNcm } from "@/lib/services/fiscal";
import { boxCbm } from "@/lib/logistics/cbm";
import { superplanParams } from "@/lib/superplan";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { pt as superplanTexts } from "@/i18n/modules/superplan";
import { ActionError } from "@/components/action-error";
import { Alert, Card, PageHeader, formatDate } from "@/components/ui";
import {
  SuperplanCalculator,
  type SuperplanLabels,
  type SuperplanPrefill,
} from "@/components/superplan-calculator";
import { SuperplanParamsForm } from "./_components/params-form";

/*
 * Superplan (Pedidos → Superplan, só o administrador; docs/SUPERPLAN.md):
 * viabilidade de um produto importado e o preço por que a Wellmix deve
 * vender. Escolher um produto do cadastro preenche preço, caixa, peso, volume
 * e os impostos do NCM; câmbio, container, despesas e tipo de negócio vêm do
 * sistema. A conta é feita na tela, ao vivo (nada é gravado). Embaixo: como o
 * cálculo é feito e, para o administrador, os parâmetros.
 */

const PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/;

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
  const productId =
    typeof query.product === "string" && PRODUCT_ID.test(query.product)
      ? query.product
      : null;

  const store = getStore();
  const [settings, fx, products] = await Promise.all([
    getSettings(),
    getFxRates(),
    store.list("products", { filter: { active: true }, orderBy: "name" }),
  ]);
  const params = superplanParams(settings.superplan);
  const product = productId
    ? (products.find((p) => p.id === productId) ??
      (await store.get("products", productId)))
    : null;
  const rates = product?.ncm ? await lookupNcm(product.ncm) : null;

  const currency = (product?.currency ?? "").toUpperCase();
  const known = currency === "USD" || currency === "CNY" || currency === "RMB";
  const prefill: SuperplanPrefill = {
    productId: product?.id ?? null,
    productName: product
      ? [product.sku, product.name].filter(Boolean).join(" · ")
      : null,
    unitPrice: product && known ? product.price : null,
    currency: currency === "USD" ? "USD" : "RMB",
    otherCurrency: product?.price && currency && !known ? currency : null,
    pcsPerCarton: product?.masterBoxQty ?? null,
    grossWeightPcKg: product?.grossWeightKg ?? null,
    // Volume da caixa master: informado ou calculado das medidas da caixa.
    cbmPerCarton: product ? boxCbm(product) : null,
    ncm: product?.ncm ?? null,
    iiPct: rates?.ii ?? null,
    ipiPct: rates ? (rates.ipiNt ? 0 : (rates.ipi ?? null)) : null,
  };

  const usd = fx.rates.USD ?? null;
  const rmb = fx.rates.RMB ?? null;
  const containers = settings.containerTypes.filter(
    (c) => c.capacityCbm > 0 && c.code,
  );
  // Dia da cotação do dólar (AAAA-MM-DD no começo), sem depender do fuso.
  const fxDay = /^\d{4}-\d{2}-\d{2}/.exec(fx.quotedAt.USD ?? fx.day ?? "")?.[0];
  const fxDate = fxDay ? formatDate(`${fxDay}T12:00:00Z`, t) : null;
  const decimal = t.intl.startsWith("pt") ? "," : ".";
  const admin = isAdmin(user);

  const errorCode = typeof query.error === "string" ? query.error : "";
  const errorText = !errorCode
    ? null
    : errorCode === "invalid_input"
      ? t("superplan.error.invalid")
      : ([`superplan.error.${errorCode}`, `common.${errorCode}`]
          .map((k) => [k, t(k as DictionaryKey)] as const)
          .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, errorCode));

  const how = (key: DictionaryKey) =>
    t(key, {
      spread: params.futureSpreadBrl.toLocaleString(t.intl),
      freightFx: params.freightFxPct.toLocaleString(t.intl),
      afrmm: params.afrmmPct.toLocaleString(t.intl),
      fixed: params.afrmmFixedBrl.toLocaleString(t.intl),
    });

  return (
    <>
      <PageHeader
        title={t("superplan.title")}
        subtitle={t("superplan.subtitle")}
      />
      <SuperplanCalculator
        key={`${prefill.productId ?? "none"}:${hash(JSON.stringify(params))}`}
        labels={labelsFor(t)}
        intl={t.intl}
        products={products.map((p) => ({
          id: p.id,
          label: [p.sku, p.name].filter(Boolean).join(" · "),
        }))}
        prefill={prefill}
        ctx={{
          params,
          containers,
          defaultContainer: containers.some((c) => c.code === "40HC")
            ? "40HC"
            : ([...containers].sort((a, b) => b.capacityCbm - a.capacityCbm)[0]
                ?.code ?? null),
          official: usd,
          rmbPerUsd: usd && rmb ? usd / rmb : null,
          fxDate,
          fxStatus: usd ? fx.status : "none",
          insurancePct: settings.insurancePercent ?? 0,
          pisImportPct: settings.pisImportPercent ?? 0,
          cofinsImportPct: settings.cofinsImportPercent ?? 0,
          icmsImportPct: settings.icmsPercent ?? null,
        }}
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
          <ActionError
            t={t}
            code={errorCode}
            text={errorText}
            fields={query.fields}
            token={query.at}
          />
          {query.saved ? (
            <Alert tone="success">{t("superplan.params.saved")}</Alert>
          ) : null}
          <SuperplanParamsForm t={t} params={params} decimal={decimal} />
        </section>
      ) : errorText ? (
        <Card className="mt-6">
          <Alert tone="danger">{errorText}</Alert>
        </Card>
      ) : null}
    </>
  );
}
