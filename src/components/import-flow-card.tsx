import type { ReactNode } from "react";
import type { Order } from "@/lib/db";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { CUSTOMS_CHANNELS } from "@/lib/db/schema";
import {
  SEAL_REPLACED_REASON,
  type StepAssignee,
  type StepView,
} from "@/lib/services/import-flow";
import Link from "next/link";
import { ASSIGN_HREF } from "@/lib/assign-href";
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
  error = null,
  names,
  title,
  anchor = "import-flow",
  hints = [],
  featured = [],
  featuredHint,
}: {
  t: Translate;
  order: Order;
  steps: StepView[];
  notice: string | null;
  /** Recusa da última ação deste cartão (o aviso aparece onde a pessoa está). */
  error?: string | null;
  names: Map<string, string>;
  /** Certificação (Fase F) usa o mesmo cartão com outro título e âncora. */
  title?: string;
  anchor?: "import-flow" | "certification";
  /** Explicações do cartão (ex.: como anda o selo de certificação). */
  hints?: ReactNode[];
  /** Passos com quadro em destaque no alto (o envio deles sai da tabela). */
  featured?: string[];
  /** O que acontece ao enviar o passo em destaque. */
  featuredHint?: ReactNode;
}) {
  if (!steps.length) return null;
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : "—");
  const label = (key: string) => t(`importFlow.step.${key}` as DictionaryKey);
  const actorLabel = (a: string) => t(`importFlow.actor.${a}` as DictionaryKey);
  const done = steps.filter((s) => s.done).length;
  // Selo de certificação já enviado: quem aplica na arte baixa daqui também.
  const sealDoc =
    steps.find((s) => s.template.key === "cert_seal" && s.done)?.step
      ?.documentId ?? null;
  /* Visão interna (Wellmix): com quem está o passo aberto e o que falta
     designar, com o link de onde designar. */
  const assigneeLine = (a: StepAssignee) => (
    <span className="mt-1 block" data-import-assignee={a.via}>
      {t(a.validating ? "certFlow.assignee.validate" : "certFlow.assignee.do", {
        name: a.label ?? t("certFlow.assignee.team"),
      })}
      {a.missing ? (
        <span
          className="mt-0.5 block font-medium text-amber-700"
          data-import-missing={a.missing}
        >
          {t(`certFlow.missing.${a.missing}` as DictionaryKey)}{" "}
          <Link
            href={ASSIGN_HREF[a.missing](order.id)}
            className="text-brand-700 underline"
          >
            {t(`certFlow.assign.${a.missing}` as DictionaryKey)}
          </Link>
        </span>
      ) : null}
    </span>
  );
  /* Formulário de envio de um passo (na linha da tabela ou no quadro em
     destaque do alto). */
  const submitForm = (tpl: StepView["template"], step: StepView["step"]) => (
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
          placeholder={t(`importFlow.ph.${tpl.key}` as DictionaryKey)}
        />
      ) : null}
      {tpl.input === "file_text" ? (
        <Input
          name="value"
          maxLength={200}
          defaultValue={step?.value ?? ""}
          placeholder={t(`importFlow.ph.${tpl.key}` as DictionaryKey)}
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
      {["file", "text_file", "file_text", "money_file"].includes(tpl.input) ? (
        // Arquivo grande (ex.: a arte com o selo) sobe direto
        // ao armazenamento; o formulário leva só o id.
        <DirectFileInput
          name="file"
          required={!step?.documentId}
          className={fileClass}
          label={t("importFlow.file")}
          uploadingLabel={t("requirement.file.uploading")}
          failedLabel={t("requirement.file.failed")}
          tooBigLabel={t("requirement.file.tooBig")}
          chosenLabel={t("importFlow.fileReady")}
        />
      ) : null}
      <SubmitButton
        className="px-2.5 py-1 text-xs"
        data-import-submit={tpl.key}
      >
        {t(
          step?.status === "rejected" || step?.status === "submitted"
            ? "importFlow.resubmit"
            : "importFlow.submit",
        )}
      </SubmitButton>
    </form>
  );
  // Passo em destaque no alto do cartão (ex.: o selo, "Memorial (selo)").
  const tops = featured
    .map((key) => steps.find((s) => s.template.key === key))
    .filter((v): v is StepView => !!v);
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
      {error ? (
        <div className="mb-3" data-import-error={anchor}>
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      {tops.length ? (
        <div
          id={`${anchor}-featured`}
          className={cx(
            "mb-3 scroll-mt-24 rounded-xl border-2 p-3",
            tops[0].done
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-brand-400 bg-brand-50/60",
          )}
        >
          {featuredHint ? (
            <p className="mb-2 text-sm text-zinc-700">{featuredHint}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {tops.map((top) => (
              <div
                key={top.template.key}
                className="rounded-lg border border-zinc-200 bg-white p-3"
                data-import-featured={top.template.key}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-zinc-900">
                    {label(top.template.key)}
                  </p>
                  <Badge tone={top.done ? "success" : "warning"}>
                    {t(
                      `importFlow.status.${top.done ? "done" : (top.step?.status ?? "pending")}` as DictionaryKey,
                    )}
                  </Badge>
                  {top.step?.documentId ? (
                    <a
                      href={`/api/files/${top.step.documentId}`}
                      className="text-sm text-brand-700 underline"
                      data-import-featured-file
                    >
                      {t("importFlow.file")}
                    </a>
                  ) : null}
                </div>
                {top.canSubmit ? (
                  <div className="mt-2">
                    {submitForm(top.template, top.step)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
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
              assignee,
            }) => (
              <tr
                key={tpl.key}
                id={`${anchor}-step-${tpl.key}`}
                className={cx(rowClass, "scroll-mt-24")}
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
                        reason:
                          step.rejectReason === SEAL_REPLACED_REASON
                            ? t("certFlow.sealReplaced")
                            : step.rejectReason,
                      })}
                    </span>
                  ) : null}
                </Td>
                <Td className="min-w-36 text-xs text-zinc-600">
                  {t("importFlow.who", {
                    actor: actorLabel(tpl.actor),
                    validator: tpl.validator ? actorLabel(tpl.validator) : "—",
                  })}
                  {assignee ? assigneeLine(assignee) : null}
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
                  {/* Aplicar o selo: o arquivo do selo para baixar junto do envio. */}
                  {tpl.key === "cert_seal_art" && canSubmit && sealDoc ? (
                    <a
                      href={`/api/files/${sealDoc}`}
                      className="mb-1 block font-medium text-brand-700 underline"
                      data-seal-download
                    >
                      {t("certFlow.sealDownload")}
                    </a>
                  ) : null}
                  {canSubmit && !featured.includes(tpl.key)
                    ? submitForm(tpl, step)
                    : null}
                  {canSubmit && featured.includes(tpl.key) ? (
                    <a
                      href={`#${anchor}-featured`}
                      className="text-brand-700 underline"
                    >
                      {t("certFlow.featured.goto")}
                    </a>
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
