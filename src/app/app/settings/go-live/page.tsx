import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  LinkButton,
  PageHeader,
  TextLink,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SummaryRebuildProgress } from "@/components/summary-rebuild-progress";
import { goLiveStatus } from "@/lib/services/go-live";
import {
  continueGoLiveAction,
  startGoLiveAction,
} from "../../actions/go-live";

export const maxDuration = 300;

/**
 * Configurações → Go-live (docs/SANKHYA.md, "Histórico em espera"): quantos
 * pedidos, etapas e pendências da carga do histórico do Sankhya estão em
 * espera e o botão que os libera, em partes, com a barra de andamento. Só
 * admin.
 */
export default async function GoLivePage({
  searchParams,
}: PageProps<"/app/settings/go-live">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "settings");
  if (user.role !== "admin") redirect("/app/settings");
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const ran = one(sp.ran) === "1";
  const error = one(sp.error);
  const status = await goLiveStatus();
  const remaining = status.orders + status.stages + status.requirements;
  const running = status.released && remaining > 0;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" });
  const stats: Array<[string, string]> = [
    [t("goLive.orders"), status.orders.toLocaleString(t.intl)],
    [t("goLive.stages"), status.stages.toLocaleString(t.intl)],
    [t("goLive.requirements"), status.requirements.toLocaleString(t.intl)],
  ];

  return (
    <>
      <PageHeader
        title={t("goLive.title")}
        subtitle={t("goLive.subtitle")}
        actions={
          <TextLink href="/app/settings" className="text-sm">
            {t("reset.back")}
          </TextLink>
        }
      />
      {ran || (status.doneAt && !running) ? (
        <Alert tone="success">
          {t("goLive.done", {
            when: status.doneAt ? when(status.doneAt) : "",
          })}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">
          {error === "confirm"
            ? t("goLive.error.confirm")
            : t("goLive.error", { detail: error })}
        </Alert>
      ) : null}
      <Card className="mt-3" title={t("goLive.status")}>
        <dl className="grid gap-3 text-sm sm:grid-cols-3" data-go-live-status>
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="font-medium text-zinc-900">{value}</dd>
            </div>
          ))}
        </dl>
        {running ? (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-zinc-900">
              {t("goLive.running")}
            </h3>
            <SummaryRebuildProgress
              processed={Math.max(0, status.total - remaining)}
              total={Math.max(status.total, remaining)}
              step={continueGoLiveAction}
              done="/app/settings/go-live?ran=1"
              labels={{
                progress: t("goLive.progress"),
                busy: t("summaries.busy"),
                error: t("goLive.stepError"),
                retry: t("summaries.retry"),
              }}
            />
            <p className="text-xs text-zinc-500">{t("goLive.runningHint")}</p>
          </div>
        ) : remaining > 0 ? (
          <form action={startGoLiveAction} className="mt-4 space-y-3">
            <Alert tone="warning">{t("goLive.warning")}</Alert>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="confirm"
                required
                className="mt-0.5"
                data-go-live-confirm
              />
              <span>{t("goLive.confirm")}</span>
            </label>
            <SubmitButton
              variant="danger"
              pendingText={t("goLive.starting")}
              data-go-live-start
            >
              {t("goLive.start")}
            </SubmitButton>
          </form>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-zinc-600" data-go-live-empty>
              {t("goLive.empty")}
            </p>
            {status.doneAt ? (
              <LinkButton href="/app/settings/summaries" variant="secondary">
                {t("goLive.rebuild")}
              </LinkButton>
            ) : null}
          </div>
        )}
      </Card>
    </>
  );
}
