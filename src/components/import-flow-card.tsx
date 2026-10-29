import type { Order } from "@/lib/db";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { CUSTOMS_CHANNELS } from "@/lib/db/schema";
import type { StepView } from "@/lib/services/import-flow";
import {
  submitImportStepAction,
  validateImportStepAction,
} from "@/app/app/actions/import-flow";
import {
  Alert,
  Badge,
  Card,
  Input,
  Select,
  formatDate,
  formatMoney,
} from "./ui";
import { SubmitButton } from "./submit-button";
import type { getT } from "@/i18n/server";

/*
 * Embarque e desembaraço (Fase D): os passos do processo de importação que o
 * usuário vê, com quem faz e quem valida. Cada um envia a sua parte (número,
 * data, canal, valor, arquivo); quem valida aprova ou recusa com motivo.
 */

type Translate = Awaited<ReturnType<typeof getT>>;

const fileClass =
  "block w-full text-sm text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm";

export function ImportFlowCard({
  t,
  order,
  steps,
  notice,
  names,
}: {
  t: Translate;
  order: Order;
  steps: StepView[];
  notice: string | null;
  names: Map<string, string>;
}) {
  if (!steps.length) return null;
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : "—");
  const label = (key: string) => t(`importFlow.step.${key}` as DictionaryKey);
  const actorLabel = (a: string) => t(`importFlow.actor.${a}` as DictionaryKey);
  const done = steps.filter((s) => s.done).length;

  return (
    <Card
      title={t("importFlow.title")}
      actions={
        <span className="text-sm text-zinc-500">
          {t("importFlow.progress", {
            done: String(done),
            total: String(steps.length),
          })}
        </span>
      }
    >
      <span id="import-flow" className="block scroll-mt-24" />
      {notice ? (
        <div className="mb-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      <ol className="space-y-2.5" data-import-flow>
        {steps.map(
          ({
            template: tpl,
            step,
            ready,
            done: isDone,
            canSubmit,
            canValidate,
          }) => (
            <li
              key={tpl.key}
              className="rounded-lg border border-zinc-200 p-2.5 text-sm"
              data-import-step={tpl.key}
              data-import-status={step?.status ?? "pending"}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {label(tpl.key)}
                </span>
                <Badge
                  tone={
                    isDone
                      ? "success"
                      : step?.status === "rejected"
                        ? "danger"
                        : step?.status === "submitted"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {t(
                    `importFlow.status.${isDone ? "done" : (step?.status ?? "pending")}` as DictionaryKey,
                  )}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {t("importFlow.who", {
                    actor: actorLabel(tpl.actor),
                    validator: tpl.validator ? actorLabel(tpl.validator) : "—",
                  })}
                </span>
              </div>
              {step && step.status !== "pending" ? (
                <p className="mt-1 text-zinc-700">
                  {step.value
                    ? tpl.input === "channel"
                      ? t(`importFlow.channel.${step.value}` as DictionaryKey)
                      : tpl.input === "date"
                        ? formatDate(step.value, t)
                        : step.value
                    : null}
                  {step.amount !== null
                    ? ` ${formatMoney(step.amount, step.currency ?? "BRL", t)}`
                    : null}
                  {step.documentId ? (
                    <>
                      {" "}
                      <a
                        href={`/api/files/${step.documentId}`}
                        className="text-brand-700 underline"
                        data-import-file
                      >
                        {t("importFlow.file")}
                      </a>
                    </>
                  ) : null}
                  <span className="text-zinc-500">
                    {" "}
                    · {name(step.submittedByUserId)} ·{" "}
                    {formatDate(step.submittedAt, t)}
                    {step.validatedAt && step.status === "validated"
                      ? ` · ${t("importFlow.validatedBy", { name: name(step.validatedByUserId) })}`
                      : ""}
                  </span>
                </p>
              ) : null}
              {step?.status === "rejected" && step.rejectReason ? (
                <p className="mt-1 text-red-700">
                  {t("importFlow.rejectedReason", {
                    reason: step.rejectReason,
                  })}
                </p>
              ) : null}
              {!ready ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {t("importFlow.waitingPrevious", {
                    step: tpl.after ? label(tpl.after) : "",
                  })}
                </p>
              ) : null}
              {tpl.key === "invoice_packing" && canSubmit ? (
                <p className="mt-1">
                  <a
                    href={`/app/orders/${order.id}/invoice`}
                    target="_blank"
                    rel="noopener"
                    className="text-brand-700 underline"
                    data-invoice-generate
                  >
                    {t("importFlow.invoice.generate")}
                  </a>
                </p>
              ) : null}
              {canSubmit ? (
                <form
                  action={submitImportStepAction}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="key" value={tpl.key} />
                  {tpl.input === "text" || tpl.input === "text_file" ? (
                    <Input
                      name="value"
                      required
                      maxLength={200}
                      defaultValue={step?.value ?? ""}
                      placeholder={t(
                        `importFlow.ph.${tpl.key}` as DictionaryKey,
                      )}
                    />
                  ) : null}
                  {tpl.input === "date" ? (
                    <Input
                      type="date"
                      name="value"
                      required
                      defaultValue={step?.value?.slice(0, 10) ?? ""}
                    />
                  ) : null}
                  {tpl.input === "channel" ? (
                    <Select name="value" defaultValue={step?.value ?? "green"}>
                      {CUSTOMS_CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {t(`importFlow.channel.${c}`)}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  {tpl.input === "money_file" ? (
                    <>
                      <Input
                        name="amount"
                        inputMode="decimal"
                        required
                        placeholder={t("importFlow.amount")}
                        defaultValue={step?.amount ?? ""}
                      />
                      <input type="hidden" name="currency" value="BRL" />
                    </>
                  ) : null}
                  {["file", "text_file", "money_file"].includes(tpl.input) ? (
                    <input
                      type="file"
                      name="file"
                      required={!step?.documentId}
                      className={fileClass}
                      aria-label={t("importFlow.file")}
                    />
                  ) : null}
                  <SubmitButton
                    className="px-2.5 py-1 text-xs"
                    data-import-submit={tpl.key}
                  >
                    {t(
                      step?.status === "rejected" ||
                        step?.status === "submitted"
                        ? "importFlow.resubmit"
                        : "importFlow.submit",
                    )}
                  </SubmitButton>
                </form>
              ) : null}
              {canValidate ? (
                <form
                  action={validateImportStepAction}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="key" value={tpl.key} />
                  <Input
                    name="reason"
                    maxLength={1000}
                    placeholder={t("importFlow.reasonPh")}
                  />
                  <SubmitButton
                    name="decision"
                    value="validated"
                    className="px-2.5 py-1 text-xs"
                    data-import-validate={tpl.key}
                  >
                    {t("importFlow.validate")}
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="rejected"
                    variant="danger"
                    className="px-2.5 py-1 text-xs"
                    data-import-reject={tpl.key}
                  >
                    {t("importFlow.reject")}
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          ),
        )}
      </ol>
    </Card>
  );
}
