import type { Approval, User } from "@/lib/db";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { APPROVAL_LEVELS } from "@/lib/db/schema";
import { canDecide } from "@/lib/services/approvals";
import {
  decideApprovalAction,
  cancelApprovalAction,
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
              : a.status === "pending"
                ? "warning"
                : a.status === "rejected" || a.status === "failed"
                  ? "danger"
                  : "neutral"
          }
        >
          {t(`approvals.status.${a.status}` as DictionaryKey)}
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
      <span id="approval" className="-mt-24 block scroll-mt-24" />
      <p className="mb-3 text-sm text-zinc-600">{t("approvals.intro")}</p>
      {sent ? (
        <div className="mb-3">
          <Alert tone="success">{t("approvals.sent")}</Alert>
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
          {canDecide(user, open) ? (
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
                <SubmitButton
                  name="decision"
                  value="approved"
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
          {open.requestedByUserId === user.id || user.role === "admin" ? (
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
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
