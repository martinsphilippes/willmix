import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { Alert, Card, PageHeader, TextLink } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SummaryRebuildProgress } from "@/components/summary-rebuild-progress";
import { rebuildProgress, summaryStatus } from "@/lib/services/order-summary";
import {
  continueOrderSummariesAction,
  rebuildOrderSummariesAction,
} from "../../actions/order-summary";
import { milestoneMigrationStatus } from "@/lib/services/order-milestones";
import {
  continueMilestoneMigrationAction,
  continueMilestoneParityAction,
  startMilestoneJobAction,
} from "../../actions/milestone-migration";

export const maxDuration = 300;

/**
 * Configurações → Resumos dos pedidos (docs/RESUMOS.md): a última
 * reconstrução completa e o botão para reconstruir agora. A reconstrução é
 * feita em partes; com uma em andamento, a tela mostra quantos pedidos já
 * foram e pede as rodadas seguintes até terminar. Só admin.
 */
export default async function OrderSummariesPage({
  searchParams,
}: PageProps<"/app/settings/summaries">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "settings");
  if (user.role !== "admin") redirect("/app/settings");
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const ran = one(sp.ran) === "1";
  const milestonesRan = one(sp.milestones);
  const error = one(sp.error);
  const [status, progress, migration] = await Promise.all([
    summaryStatus().catch(() => null),
    rebuildProgress().catch(() => null),
    milestoneMigrationStatus().catch(() => null),
  ]);
  const when = (iso: string) =>
    new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" });
  const stats = status
    ? [
        [t("summaries.builtAt"), when(status.builtAt)],
        [t("summaries.orders"), status.orders.toLocaleString(t.intl)],
        [t("summaries.written"), status.written.toLocaleString(t.intl)],
        [t("summaries.removed"), status.removed.toLocaleString(t.intl)],
        [t("summaries.duration"), `${(status.ms / 1000).toFixed(1)} s`],
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t("summaries.title")}
        subtitle={t("summaries.subtitle")}
        actions={
          <TextLink href="/app/settings" className="text-sm">
            {t("reset.back")}
          </TextLink>
        }
      />
      {ran ? <Alert tone="success">{t("summaries.done")}</Alert> : null}
      {error ? (
        <Alert tone="danger">{t("summaries.error", { detail: error })}</Alert>
      ) : null}
      <Card className="mt-3" title={t("summaries.status")}>
        {status ? (
          <dl
            className="grid gap-3 text-sm sm:grid-cols-5"
            data-summaries-status
          >
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="font-medium text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-zinc-600" data-summaries-never>
            {t("summaries.never")}
          </p>
        )}
        {progress ? (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-zinc-900">
              {t("summaries.running")}
            </h3>
            <SummaryRebuildProgress
              processed={progress.processed}
              total={progress.total}
              step={continueOrderSummariesAction}
              done="/app/settings/summaries?ran=1"
              labels={{
                progress: t("summaries.progress"),
                busy: t("summaries.busy"),
                error: t("summaries.stepError"),
                retry: t("summaries.retry"),
              }}
            />
            <p className="text-xs text-zinc-500">
              {t("summaries.runningHint")}
            </p>
          </div>
        ) : (
          <form action={rebuildOrderSummariesAction} className="mt-4 space-y-2">
            <SubmitButton
              variant="primary"
              pendingText={t("summaries.rebuilding")}
              data-summaries-rebuild
            >
              {t("summaries.rebuild")}
            </SubmitButton>
            <p className="text-xs text-zinc-500">
              {t("summaries.rebuildHint")}
            </p>
          </form>
        )}
      </Card>
      <div id="milestones" data-milestone-migration>
        <Card className="mt-3" title={t("milestoneMigration.title")}>
          <p className="text-sm text-zinc-600">
            {t("milestoneMigration.hint")}
          </p>
          {milestonesRan === "migrate" ? (
            <Alert tone="success">{t("milestoneMigration.done")}</Alert>
          ) : null}
          {migration?.migrated ? (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-5">
              {[
                [t("milestoneMigration.when"), when(migration.migrated.doneAt)],
                [
                  t("milestoneMigration.ordersCount"),
                  migration.migrated.orders.toLocaleString(t.intl),
                ],
                [
                  t("milestoneMigration.requirements"),
                  migration.migrated.stats.requirements.toLocaleString(t.intl),
                ],
                [
                  t("milestoneMigration.milestones"),
                  migration.migrated.stats.milestones.toLocaleString(t.intl),
                ],
                [
                  t("milestoneMigration.orders"),
                  migration.migrated.stats.orders.toLocaleString(t.intl),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="font-medium text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">
              {t("milestoneMigration.never")}
            </p>
          )}
          {migration?.migration ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-zinc-900">
                {t("milestoneMigration.running")}
              </h3>
              <SummaryRebuildProgress
                processed={migration.migration.processed}
                total={migration.migration.total}
                step={continueMilestoneMigrationAction}
                done="/app/settings/summaries?milestones=migrate#milestones"
                labels={{
                  progress: t("milestoneMigration.progress"),
                  busy: t("summaries.busy"),
                  error: t("summaries.stepError"),
                  retry: t("summaries.retry"),
                }}
              />
            </div>
          ) : (
            <form action={startMilestoneJobAction} className="mt-4">
              <input type="hidden" name="job" value="migrate" />
              <SubmitButton
                variant="primary"
                pendingText={t("milestoneMigration.starting")}
                data-milestone-migrate
              >
                {t("milestoneMigration.start")}
              </SubmitButton>
            </form>
          )}
          <h3 className="mt-6 text-sm font-medium text-zinc-900">
            {t("milestoneMigration.parityTitle")}
          </h3>
          <p className="text-sm text-zinc-600">
            {t("milestoneMigration.parityHint")}
          </p>
          {milestonesRan === "parity" ? (
            <Alert tone="success">{t("milestoneMigration.parityDone")}</Alert>
          ) : null}
          {migration?.checked ? (
            <div className="mt-3 space-y-2" data-milestone-parity>
              <dl className="grid gap-3 text-sm sm:grid-cols-6">
                {[
                  [
                    t("milestoneMigration.when"),
                    when(migration.checked.doneAt),
                  ],
                  [
                    t("milestoneMigration.differences"),
                    migration.checked.stats.differences.toLocaleString(t.intl),
                  ],
                  [
                    t("milestoneMigration.diffViews"),
                    migration.checked.stats.views.toLocaleString(t.intl),
                  ],
                  [
                    t("milestoneMigration.diffRequirements"),
                    migration.checked.stats.requirements.toLocaleString(t.intl),
                  ],
                  [
                    t("milestoneMigration.diffCurrent"),
                    migration.checked.stats.current.toLocaleString(t.intl),
                  ],
                  [
                    t("milestoneMigration.diffRows"),
                    migration.checked.stats.rows.toLocaleString(t.intl),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="font-medium text-zinc-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-zinc-700">
                {migration.checked.stats.differences === 0
                  ? t("milestoneMigration.zero")
                  : t("milestoneMigration.sample", {
                      list: migration.checked.stats.sample
                        .map((n) => `#${n}`)
                        .join(", "),
                    })}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">
              {t("milestoneMigration.parityNever")}
            </p>
          )}
          {migration?.parity ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-zinc-900">
                {t("milestoneMigration.parityRunning")}
              </h3>
              <SummaryRebuildProgress
                processed={migration.parity.processed}
                total={migration.parity.total}
                step={continueMilestoneParityAction}
                done="/app/settings/summaries?milestones=parity#milestones"
                labels={{
                  progress: t("milestoneMigration.parityProgress"),
                  busy: t("summaries.busy"),
                  error: t("summaries.stepError"),
                  retry: t("summaries.retry"),
                }}
              />
            </div>
          ) : (
            <form action={startMilestoneJobAction} className="mt-4">
              <input type="hidden" name="job" value="parity" />
              <SubmitButton
                variant="secondary"
                pendingText={t("milestoneMigration.parityStarting")}
                data-milestone-parity-start
              >
                {t("milestoneMigration.parityStart")}
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
