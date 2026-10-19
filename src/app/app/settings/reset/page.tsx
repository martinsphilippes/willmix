import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/permissions";
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
import { resetSalesDataAction } from "../../actions/data-reset";

// A limpeza apaga linha por linha no Appwrite: mais tempo que uma página comum.
export const maxDuration = 120;

/**
 * Configurações → Limpar dados de teste: mostra quanto de cada venda vai ser
 * apagado e o que fica, e pede a palavra de confirmação. Só o administrador.
 */
export default async function ResetPage({
  searchParams,
}: PageProps<"/app/settings/reset">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertRole(user, ["admin"]);
  const { done, error } = await searchParams;
  const t = await getT();
  const plan = await planSalesReset(user);
  const rows: Array<[keyof ResetPlan["remove"], number]> = (
    Object.entries(plan.remove) as Array<[keyof ResetPlan["remove"], number]>
  ).filter(([, n]) => n > 0);
  const errorText =
    error === "reset_confirm"
      ? t("reset.error.confirm")
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
      {done === "1" && !errorText ? (
        plan.total > 0 ? (
          // Parou no limite de uma rodada: tocar de novo termina.
          <Alert tone="warning">
            <span data-reset-remaining="">
              {t("reset.remaining", { n: plan.total })}
            </span>
          </Alert>
        ) : (
          <Alert tone="success">
            <span data-reset-done="">{t("reset.done")}</span>
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
    </>
  );
}
