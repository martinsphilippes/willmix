import type { Approval, User } from "@/lib/db";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { APPROVAL_LEVELS } from "@/lib/db/schema";
import {
  canDecide,
  canRetryApproval,
  isApplying,
  isApplyStale,
} from "@/lib/services/approvals";
import { AutoRefresh } from "./auto-refresh";
import {
  decideAllLevelsAction,
  decideApprovalAction,
  cancelApprovalAction,
  retryApprovalAction,
} from "@/app/app/actions/approvals";
import {
  Alert,
  Badge,
  Card,
  Field,
  Textarea,
  formatDate,
  formatMoney,
} from "./ui";
import { SubmitButton } from "./submit-button";
import type { getT } from "@/i18n/server";

/*
 * Aprovação do pré-custo na solicitação (só a Wellmix vê): a escolha em
 * aberto com os níveis (quem aprovou, quando, o que falta) e, para quem
 * decide o nível atual, Aprovar / Reprovar com motivo. Abaixo, as anteriores
 * (reprovadas com o motivo, canceladas, aprovadas).
 */

type Translate = Awaited<ReturnType<typeof getT>>;

export function ApprovalCard({
  t,
  user,
  requestId,
  approvals,
  names,
  sent,
  decided,
}: {
  t: Translate;
  user: User;
  requestId: string;
  /** Mais recente primeiro. */
  approvals: Approval[];
  names: Map<string, string>;
  sent: boolean;
  decided: string | null;
}) {
  if (!approvals.length && !sent) return null;
  const open = approvals.find((a) => a.status === "pending") ?? null;
  const past = approvals.filter((a) => a !== open);
  // Todos os níveis aprovaram e a escolha está sendo gravada (ou parou).
  const applying = !!open && isApplying(open);
  const stale = !!open && isApplyStale(open);
  const name = (id: string) => names.get(id) ?? "—";
  const levelLabel = (l: string) => t(`approvals.level.${l}` as DictionaryKey);

  const steps = (a: Approval) => (
    <ol className="space-y-1 text-sm">
      {APPROVAL_LEVELS.map((level) => {
        const step = a.steps.find((s) => s.level === level);
        const needed = a.levels.includes(level);
        return (
          <li
            key={level}
            className="flex flex-wrap items-center gap-2"
            data-approval-level={level}
          >
            <span className="w-44 font-medium text-zinc-800">
              {levelLabel(level)}
            </span>
            {!needed ? (
              <span className="text-zinc-400">
                {t("approvals.step.skipped")}
              </span>
            ) : step ? (
              <span
                className={
                  step.decision === "approved"
                    ? "text-emerald-700"
                    : "text-red-700"
                }
              >
                {t(
                  step.decision === "approved"
                    ? "approvals.step.approved"
                    : "approvals.step.rejected",
                  { name: name(step.userId), date: formatDate(step.at, t) },
                )}
                {step.note ? ` · ${step.note}` : ""}
              </span>
            ) : (
              <span
                className={
                  a.currentLevel === level
                    ? "font-semibold text-amber-700"
                    : "text-zinc-500"
                }
              >
                {t("approvals.step.waiting")}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  const header = (a: Approval) => {
    const input = a.input as { sellPrice?: number; sellCurrency?: string };
    return (
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge
          tone={
            a.status === "approved"
              ? "success"
              : isApplying(a)
                ? isApplyStale(a)
                  ? "warning"
                  : "info"
                : a.status === "pending"
                  ? "warning"
                  : a.status === "rejected" || a.status === "failed"
                    ? "danger"
                    : "neutral"
          }
        >
          {isApplying(a)
            ? t(
                isApplyStale(a)
                  ? "approvals.applying.staleBadge"
                  : "approvals.applying.badge",
              )
            : t(`approvals.status.${a.status}` as DictionaryKey)}
        </Badge>
        <span>
          {t("approvals.value")}:{" "}
          <strong className="tabular-nums">
            {formatMoney(
              input.sellPrice ?? null,
              input.sellCurrency ?? "BRL",
              t,
            )}
          </strong>
          {input.sellCurrency !== "BRL" ? (
            <span className="text-zinc-500">
              {" "}
              ·{" "}
              {a.valueBrl !== null
                ? `${t("approvals.valueBrl")} ${formatMoney(a.valueBrl, "BRL", t)}`
                : t("approvals.noFx")}
            </span>
          ) : null}
        </span>
        <span className="text-zinc-500">
          {t("approvals.requestedBy", {
            name: name(a.requestedByUserId),
            date: formatDate(a.createdAt, t),
          })}
        </span>
      </div>
    );
  };

  return (
    <Card title={t("approvals.title")}>
      <span id="approval" className="block scroll-mt-24" />
      <p className="mb-3 text-sm text-zinc-600">{t("approvals.intro")}</p>
      {sent ? (
        <div className="mb-3">
          <Alert tone="success">{t("approvals.sent")}</Alert>
        </div>
      ) : null}
      {decided === "retry_failed" ? (
        <div className="mb-3">
          <Alert tone="danger">{t("approvals.retry.failed")}</Alert>
        </div>
      ) : null}
      {decided === "approved" || decided === "rejected" ? (
        <div className="mb-3">
          <Alert tone="success">
            {t(
              decided === "approved"
                ? "approvals.decided.approved"
                : "approvals.decided.rejected",
            )}
          </Alert>
        </div>
      ) : null}
      {open ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"
          data-approval-open={open.id}
        >
          {header(open)}
          {steps(open)}
          {applying ? (
            stale ? (
              <div className="mt-3 space-y-2" data-approval-applying="stale">
                <Alert tone="warning">{t("approvals.applying.stale")}</Alert>
                {canRetryApproval(user, open, open === approvals[0]) ? (
                  <form
                    action={retryApprovalAction}
                    data-approval-retry={open.id}
                  >
                    <input type="hidden" name="requestId" value={requestId} />
                    <input type="hidden" name="approvalId" value={open.id} />
                    <SubmitButton>{t("approvals.retry.submit")}</SubmitButton>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="mt-3" data-approval-applying="running">
                <Alert tone="info">
                  <span className="inline-flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
                    />
                    <span role="status">{t("approvals.applying.body")}</span>
                  </span>
                </Alert>
                {/* A gravação termina no servidor: a tela busca o resultado sozinha. */}
                <AutoRefresh everyMs={3000} />
              </div>
            )
          ) : canDecide(user, open) ? (
            <form action={decideApprovalAction} className="mt-3 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                {t("approvals.waitingYou")}
              </p>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="approvalId" value={open.id} />
              <Field label={t("approvals.reason")}>
                <Textarea name="note" rows={2} maxLength={1000} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {/* Administrador com mais de um nível pela frente: aprova
                    todos de uma vez (o botão leva allLevels=1). */}
                {user.role === "admin" &&
                open.levels.indexOf(open.currentLevel ?? "planner") <
                  open.levels.length - 1 ? (
                  <button
                    type="submit"
                    name="allLevels"
                    value="1"
                    formAction={decideAllLevelsAction}
                    className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                    data-approval-approve-all
                  >
                    {t("approvals.approveAll")}
                  </button>
                ) : null}
                <SubmitButton
                  name="decision"
                  value="approved"
                  variant={
                    user.role === "admin" &&
                    open.levels.indexOf(open.currentLevel ?? "planner") <
                      open.levels.length - 1
                      ? "secondary"
                      : undefined
                  }
                  data-approval-approve
                >
                  {t("approvals.approve")}
                </SubmitButton>
                <SubmitButton
                  name="decision"
                  value="rejected"
                  variant="danger"
                  data-approval-reject
                >
                  {t("approvals.reject")}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              {t("approvals.waitingOther", {
                level: levelLabel(open.currentLevel ?? "planner"),
              })}
            </p>
          )}
          {(open.requestedByUserId === user.id || user.role === "admin") &&
          (!applying || stale) ? (
            <form action={cancelApprovalAction} className="mt-2">
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="approvalId" value={open.id} />
              <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">
                {t("approvals.cancel")}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}
      {past.length ? (
        <details className="mt-3" open={!open}>
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            {t("approvals.history")} ({past.length})
          </summary>
          <ul className="mt-2 space-y-3">
            {past.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-zinc-200 p-3"
                data-approval-past={a.status}
              >
                {header(a)}
                {steps(a)}
                {a.reason ? (
                  <p className="mt-1 text-sm text-red-700">
                    {t("approvals.reasonLabel", { reason: a.reason })}
                  </p>
                ) : null}
                {/* Aprovada por todos, mas a gravação da escolha parou no
                    meio: quem pode tenta concluir de novo (retoma de onde
                    parou, sem pedir outra aprovação). */}
                {canRetryApproval(user, a, a === approvals[0]) ? (
                  <form
                    action={retryApprovalAction}
                    className="mt-2 space-y-1"
                    data-approval-retry={a.id}
                  >
                    <input type="hidden" name="requestId" value={requestId} />
                    <input type="hidden" name="approvalId" value={a.id} />
                    <p className="text-sm text-zinc-700">
                      {t("approvals.retry.hint")}
                    </p>
                    <SubmitButton>{t("approvals.retry.submit")}</SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
