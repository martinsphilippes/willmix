import type { ReactNode } from "react";
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
  Table,
  Td,
  Th,
  cx,
  formatDate,
  formatMoney,
  rowClass,
} from "./ui";
import { SubmitButton } from "./submit-button";
import { DirectFileInput } from "./sheet-file-input";
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
  title,
  anchor = "import-flow",
  hints = [],
}: {
  t: Translate;
  order: Order;
  steps: StepView[];
  notice: string | null;
  names: Map<string, string>;
  /** Certificação (Fase F) usa o mesmo cartão com outro título e âncora. */
  title?: string;
  anchor?: "import-flow" | "certification";
  /** Explicações do cartão (ex.: como anda o selo de certificação). */
  hints?: ReactNode[];
}) {
  if (!steps.length) return null;
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : "—");
  const label = (key: string) => t(`importFlow.step.${key}` as DictionaryKey);
  const actorLabel = (a: string) => t(`importFlow.actor.${a}` as DictionaryKey);
  const done = steps.filter((s) => s.done).length;

  return (
    <Card
      title={title ?? t("importFlow.title")}
      actions={
        <span className="text-sm text-zinc-500">
          {t("importFlow.progress", {
            done: String(done),
            total: String(steps.length),
          })}
        </span>
      }
    >
      <span id={anchor} className="block scroll-mt-24" />
      {notice ? (
        <div className="mb-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {hints.map((hint, i) => (
        <div
          key={i}
          className="mb-3 text-sm text-zinc-600"
          data-import-hint={anchor}
        >
          {hint}
        </div>
      ))}
      {/* Um passo por linha: situação, quem faz e valida, o que foi
          informado, quem enviou e a ação (enviar ou validar). */}
      <Table>
        <thead>
          <tr>
            <Th>{t("importFlow.col.step")}</Th>
            <Th>{t("importFlow.col.status")}</Th>
            <Th>{t("importFlow.col.who")}</Th>
            <Th>{t("importFlow.col.value")}</Th>
            <Th>{t("importFlow.col.sent")}</Th>
            <Th>{t("importFlow.col.action")}</Th>
          </tr>
        </thead>
        <tbody data-import-flow>
          {steps.map(
            ({
              template: tpl,
              step,
              ready,
              done: isDone,
              canSubmit,
              canValidate,
            }) => (
              <tr
                key={tpl.key}
                className={rowClass}
                data-import-step={tpl.key}
                data-import-status={step?.status ?? "pending"}
              >
                <Td className="min-w-40 font-medium text-zinc-900">
                  {label(tpl.key)}
                  {!ready ? (
                    <span className="block text-xs font-normal text-zinc-500">
                      {t("importFlow.waitingPrevious", {
                        step: tpl.after ? label(tpl.after) : "",
                      })}
                    </span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap">
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
                  {step?.status === "rejected" && step.rejectReason ? (
                    <span className="mt-1 block max-w-56 whitespace-normal text-xs text-red-700">
                      {t("importFlow.rejectedReason", {
                        reason: step.rejectReason,
                      })}
                    </span>
                  ) : null}
                </Td>
                <Td className="min-w-36 text-xs text-zinc-600">
                  {t("importFlow.who", {
                    actor: actorLabel(tpl.actor),
                    validator: tpl.validator ? actorLabel(tpl.validator) : "—",
                  })}
                </Td>
                <Td className="min-w-32">
                  {step && step.status !== "pending" ? (
                    <>
                      {step.value
                        ? tpl.input === "channel"
                          ? t(
                              `importFlow.channel.${step.value}` as DictionaryKey,
                            )
                          : tpl.input === "date"
                            ? formatDate(step.value, t)
                            : step.value
                        : null}
                      {step.amount !== null ? (
                        <span className="block tabular-nums">
                          {formatMoney(step.amount, step.currency ?? "BRL", t)}
                        </span>
                      ) : null}
                      {step.documentId ? (
                        <a
                          href={`/api/files/${step.documentId}`}
                          className="block text-brand-700 underline"
                          data-import-file
                        >
                          {t("importFlow.file")}
                        </a>
                      ) : null}
                      {!step.value && step.amount === null && !step.documentId
                        ? "—"
                        : null}
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="min-w-36 text-xs text-zinc-600">
                  {step && step.status !== "pending" ? (
                    <>
                      {name(step.submittedByUserId)} ·{" "}
                      {formatDate(step.submittedAt, t)}
                      {step.validatedAt && step.status === "validated" ? (
                        <span className="block">
                          {t("importFlow.validatedBy", {
                            name: name(step.validatedByUserId),
                          })}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="min-w-64">
                  {tpl.key === "invoice_packing" && canSubmit ? (
                    <a
                      href={`/app/orders/${order.id}/invoice`}
                      target="_blank"
                      rel="noopener"
                      className="mb-1 block text-brand-700 underline"
                      data-invoice-generate
                    >
                      {t("importFlow.invoice.generate")}
                    </a>
                  ) : null}
                  {canSubmit ? (
                    <form
                      action={submitImportStepAction}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="key" value={tpl.key} />
                      <input type="hidden" name="anchor" value={anchor} />
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
                      {tpl.input === "file_text" ? (
                        <Input
                          name="value"
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
                        <Select
                          name="value"
                          defaultValue={step?.value ?? "green"}
                        >
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
                      {[
                        "file",
                        "text_file",
                        "file_text",
                        "money_file",
                      ].includes(tpl.input) ? (
                        // Arquivo grande (ex.: a arte com o selo) sobe direto
                        // ao armazenamento; o formulário leva só o id.
                        <DirectFileInput
                          name="file"
                          required={!step?.documentId}
                          className={fileClass}
                          label={t("importFlow.file")}
                          uploadingLabel={t("requirement.file.uploading")}
                          failedLabel={t("requirement.file.failed")}
                          chosenLabel={t("importFlow.fileReady")}
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
                      className={cx(
                        "flex flex-wrap items-end gap-2",
                        canSubmit && "mt-2",
                      )}
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="key" value={tpl.key} />
                      <input type="hidden" name="anchor" value={anchor} />
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
                  {!canSubmit && !canValidate ? "—" : null}
                </Td>
              </tr>
            ),
          )}
        </tbody>
      </Table>
    </Card>
  );
}
