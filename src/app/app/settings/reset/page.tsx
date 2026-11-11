import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  TextLink,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  RESET_CONFIRM_WORD,
  planSalesReset,
  type ResetPlan,
} from "@/lib/services/data-reset";
import {
  resetCatalogDataAction,
  resetSalesDataAction,
} from "../../actions/data-reset";
import { planCatalogReset } from "@/lib/services/catalog-reset";

// A limpeza apaga linha por linha no Appwrite: mais tempo que uma página
// comum. A rodada para sozinha bem antes (RESET_BUDGET_MS) e a tela mostra
// "ainda restam N" para continuar.
export const maxDuration = 300;

/**
 * Configurações → Limpar dados de teste: mostra quanto de cada venda vai ser
 * apagado e o que fica, e pede a palavra de confirmação. Só o administrador.
 */
export default async function ResetPage({
  searchParams,
}: PageProps<"/app/settings/reset">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "settings");
  const { done, error, catalog } = await searchParams;
  const t = await getT();
  const plan = await planSalesReset(user);
  const catalogPlan = await planCatalogReset(user);
  const catalogRows = Object.entries(catalogPlan.remove).filter(
    ([, n]) => (n ?? 0) > 0,
  ) as Array<[string, number]>;
  const rows: Array<[keyof ResetPlan["remove"], number]> = (
    Object.entries(plan.remove) as Array<[keyof ResetPlan["remove"], number]>
  ).filter(([, n]) => n > 0);
  const errorText =
    error === "reset_confirm"
      ? t("reset.error.confirm")
      : error === "sales_first"
        ? t("reset.catalog.salesFirst")
        : // Barrado antes de apagar qualquer coisa.
          error === "forbidden" || error === "invalid_input"
          ? t("reset.error.blocked", { code: error })
          : typeof error === "string" && error
            ? t("reset.error.failed", { code: error })
            : null;

  return (
    <>
      <PageHeader
        title={t("reset.title")}
        actions={
          <TextLink href="/app/settings" className="text-sm">
            {t("reset.back")}
          </TextLink>
        }
      />
      {typeof done === "string" && done && !errorText ? (
        plan.total === 0 ? (
          <Alert tone="success">
            <span data-reset-done="">{t("reset.done")}</span>
          </Alert>
        ) : done === "partial" ? (
          // Parou no limite de uma rodada: tocar de novo continua.
          <Alert tone="warning">
            <span data-reset-remaining="">
              {t("reset.remaining", { n: plan.total })}
            </span>
          </Alert>
        ) : (
          // Terminou, mas há vendas criadas depois (ou durante): podem ser
          // reais, então não pede para apagar de novo.
          <Alert tone="warning">
            <span data-reset-new="">
              {t("reset.newData", { n: plan.total })}
              {done === "new" ? ` ${t("reset.countersKept")}` : ""}
            </span>
          </Alert>
        )
      ) : null}
      {errorText ? (
        <Alert tone="danger">
          <span data-reset-error="">{errorText}</span>
        </Alert>
      ) : null}
      <Card className="mt-3">
        <div className="space-y-4">
          <p className="text-sm font-medium text-red-700">{t("reset.intro")}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("reset.removeTitle")}
              </h3>
              {plan.total === 0 ? (
                <p className="text-sm text-zinc-600" data-reset-empty="">
                  {t("reset.nothing")}
                </p>
              ) : (
                <dl
                  className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"
                  data-reset-plan=""
                >
                  {rows.map(([key, n]) => (
                    <div key={key} className="contents">
                      <dt className="text-zinc-700">
                        {t(`reset.row.${key}` as DictionaryKey)}
                      </dt>
                      <dd
                        className="text-right font-medium tabular-nums text-zinc-900"
                        data-reset-count={key}
                      >
                        {n.toLocaleString(t.intl)}
                      </dd>
                    </div>
                  ))}
                  <div className="contents">
                    <dt className="border-t border-zinc-200 pt-1 font-semibold text-zinc-900">
                      {t("reset.row.total")}
                    </dt>
                    <dd className="border-t border-zinc-200 pt-1 text-right font-semibold tabular-nums text-zinc-900">
                      {plan.total.toLocaleString(t.intl)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
            <div className="space-y-2 text-sm text-zinc-700">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("reset.keepTitle")}
              </h3>
              <p>{t("reset.keepList")}</p>
              {plan.unlink > 0 ? (
                <p className="text-xs text-zinc-500">
                  {t("reset.unlink", { n: plan.unlink })}
                </p>
              ) : null}
              <p className="text-xs text-zinc-500">{t("reset.counters")}</p>
            </div>
          </div>
          <form
            action={resetSalesDataAction}
            className="flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-4"
            data-reset-form=""
          >
            <div className="w-full sm:w-64">
              <Field label={t("reset.confirmLabel")}>
                <Input
                  name="confirm"
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={20}
                  placeholder={RESET_CONFIRM_WORD}
                />
              </Field>
            </div>
            <SubmitButton variant="danger" pendingText="…">
              {t("reset.submit")}
            </SubmitButton>
          </form>
        </div>
      </Card>
      <Card className="mt-6" title={t("reset.catalog.title")}>
        <div id="catalog" className="scroll-mt-4 space-y-4">
          {catalog === "1" ? (
            <Alert tone="success">{t("reset.catalog.done")}</Alert>
          ) : catalog === "partial" ? (
            <Alert tone="warning">
              {t("reset.remaining", { n: catalogPlan.total })}
            </Alert>
          ) : null}
          <p className="text-sm font-medium text-red-700">
            {t("reset.catalog.intro")}
          </p>
          {catalogPlan.total === 0 ? (
            <p className="text-sm text-zinc-600">{t("reset.nothing")}</p>
          ) : (
            <dl
              className="grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"
              data-catalog-plan=""
            >
              {catalogRows.map(([key, n]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-xs text-zinc-700">{key}</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {n.toLocaleString(t.intl)}
                  </dd>
                </div>
              ))}
              <div className="contents">
                <dt className="text-zinc-700">{t("reset.catalog.unlink")}</dt>
                <dd className="text-right font-medium tabular-nums">
                  {catalogPlan.unlink.toLocaleString(t.intl)}
                </dd>
              </div>
              <div className="contents">
                <dt className="text-zinc-700">
                  {t("reset.catalog.partiesKept")}
                </dt>
                <dd className="text-right font-medium tabular-nums">
                  {catalogPlan.partiesKept.toLocaleString(t.intl)}
                </dd>
              </div>
            </dl>
          )}
          {catalogPlan.salesLeft > 0 ? (
            <Alert tone="warning">{t("reset.catalog.salesFirst")}</Alert>
          ) : catalogPlan.total > 0 ? (
            <form
              action={resetCatalogDataAction}
              className="flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-4"
              data-catalog-form=""
            >
              <div className="w-full sm:w-64">
                <Field label={t("reset.confirmLabel")}>
                  <Input
                    name="confirm"
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={20}
                    placeholder={RESET_CONFIRM_WORD}
                  />
                </Field>
              </div>
              <SubmitButton variant="danger" pendingText="…">
                {t("reset.catalog.submit")}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </Card>
    </>
  );
}
