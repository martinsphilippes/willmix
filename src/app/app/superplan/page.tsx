import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { hasFiscalTable } from "@/lib/services/fiscal";
import {
  loadSuperplanContext,
  superplanPrefillsFor,
} from "@/lib/services/superplan-analysis";
import {
  EMPTY_SUPERPLAN_PREFILL,
  type SuperplanPrefill,
} from "@/lib/superplan-defaults";
import { getT } from "@/i18n/server";
import { productOptionLabel } from "@/lib/services/product-search";
import { productPickerLabels } from "@/components/party-picker-labels";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { pt as superplanTexts } from "@/i18n/modules/superplan";
import { ActionError } from "@/components/action-error";
import {
  Alert,
  Card,
  LinkButton,
  PageHeader,
  formatDate,
} from "@/components/ui";
import {
  SuperplanCalculator,
  type SuperplanLabels,
} from "@/components/superplan-calculator";
import { SuperplanParamsForm } from "./_components/params-form";
import { SuperplanLogic } from "./_components/logic";

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
 * Viabilidade feita: o administrador abre, daqui, a faca e a RFQ com o
 * fornecedor ganho (docs/SUPERPLAN.md, "Da viabilidade à faca e à RFQ").
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

  const [ctx, product, prefills, fiscalTableLoaded] = await Promise.all([
    loadSuperplanContext({
      formatDay: (day) => formatDate(`${day}T12:00:00Z`, t),
    }),
    // Produto escolhido por busca (~17 mil produtos não cabem numa lista;
    // a página saía com 4,2 MB): aqui só o carregado, para o campo.
    productId ? getStore().get("products", productId) : null,
    // Produto desativado continua abrindo pelo endereço, como sempre abriu.
    productId
      ? superplanPrefillsFor([productId], { includeInactive: true })
      : null,
    // Só para dizer por que faltam II e IPI (sem tabela ≠ NCM fora dela).
    productId ? hasFiscalTable() : true,
  ]);
  const { params } = ctx;
  const loaded = productId ? (prefills?.get(productId) ?? null) : null;
  const prefill: SuperplanPrefill = loaded ?? EMPTY_SUPERPLAN_PREFILL;
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

  return (
    <>
      <PageHeader
        title={t("superplan.title")}
        subtitle={t("superplan.subtitle")}
        actions={
          <LinkButton
            href="#como-calcula"
            variant="secondary"
            data-superplan-how-link
          >
            {t("superplanLogic.link")} ↓
          </LinkButton>
        }
      />
      <SuperplanCalculator
        key={`${prefill.productId ?? "none"}:${hash(JSON.stringify(params))}`}
        labels={labelsFor(t)}
        intl={t.intl}
        product={
          product
            ? { id: product.id, label: productOptionLabel(t, product) }
            : null
        }
        productLabels={productPickerLabels(t)}
        prefill={prefill}
        // Média do despachante (ficha mestre): só informação na tela.
        averageUsd={loaded ? loaded.averageUsd : undefined}
        // Peso médio (ficha mestre): mostrado na Compra, fora da conta.
        averageWeightKg={loaded ? loaded.averageWeightKg : null}
        fiscalTableLoaded={fiscalTableLoaded}
        ctx={ctx}
      />

      {/* A lógica da conta, escrita por extenso e sempre à vista. */}
      <SuperplanLogic ctx={ctx} t={t} />

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
