import type { SupplierRequest, SupplierRequestEvent } from "@/lib/db/schema";
import { SHEET_CURRENCIES } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  canPostMessage,
  canPropose,
  pendingProposal,
} from "@/lib/supplier-requests";
import type { SupplierRequestSla } from "@/lib/services/supplier-request-negotiation";
import {
  Badge,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  postSupplierRequestMessageAction,
  proposeSupplierRequestAction,
  respondProposalAction,
} from "../../actions/supplier-requests";

/*
 * Negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Negociação"): o histórico de contrapropostas e mensagens, a contraproposta
 * da Wellmix, a resposta do fornecedor a ela e a conversa com arquivos.
 */

/** Data e hora (o SLA é em minutos). */
export function dateTime(value: string | null | undefined, t: Translate) {
  if (!value) return "—";
  return new Date(value).toLocaleString(t.intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Selo do SLA: no prazo até HH:MM, ou atrasada. */
export function SlaBadge({
  sla,
  t,
}: {
  sla: SupplierRequestSla | null;
  t: Translate;
}) {
  if (!sla) return null;
  return (
    <span
      className="inline-flex"
      data-supplier-request-sla={sla.late ? "late" : "ok"}
    >
      <Badge tone={sla.late ? "danger" : "neutral"}>
        {sla.late
          ? t("supplierRequests.sla.late")
          : t("supplierRequests.sla.until", { date: dateTime(sla.dueAt, t) })}
      </Badge>
    </span>
  );
}

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,.xlsx,.xls,.xlsm";

function OfferFields({
  t,
  values,
  currencyDefault,
  raw,
}: {
  t: Translate;
  values: Pick<
    SupplierRequestEvent,
    "price" | "currency" | "moq" | "leadTimeDays"
  > | null;
  currencyDefault: string;
  raw: (n: number | null | undefined) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={t("supplierRequests.detail.answer.price")}>
        <Input
          name="price"
          inputMode="decimal"
          defaultValue={raw(values?.price)}
          data-negotiation-price
        />
      </Field>
      <Field label={t("supplierRequests.detail.answer.currency")}>
        <Select
          name="currency"
          defaultValue={values?.currency ?? currencyDefault}
        >
          {SHEET_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("supplierRequests.detail.answer.moq")}>
        <Input
          name="moq"
          inputMode="numeric"
          defaultValue={raw(values?.moq)}
          data-negotiation-moq
        />
      </Field>
      <Field label={t("supplierRequests.detail.answer.leadTime")}>
        <Input
          name="leadTimeDays"
          inputMode="numeric"
          defaultValue={raw(values?.leadTimeDays)}
          data-negotiation-lead-time
        />
      </Field>
    </div>
  );
}

export function NegotiationCard({
  request: r,
  wellmix,
  t,
}: {
  request: SupplierRequest;
  wellmix: boolean;
  t: Translate;
}) {
  const events = r.negotiation ?? [];
  const proposal = pendingProposal(events);
  const decimal = t.intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null | undefined) =>
    n === null || n === undefined ? "" : String(n).replace(".", decimal);
  const num = (n: number | null | undefined, digits = 4) =>
    n === null || n === undefined
      ? null
      : n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const values = (e: SupplierRequestEvent) =>
    [
      num(e.price) !== null
        ? `${t("supplierRequests.detail.answer.price")}: ${num(e.price)} ${e.currency ?? ""}`.trim()
        : null,
      num(e.moq, 0) !== null
        ? `${t("supplierRequests.detail.answer.moq")}: ${num(e.moq, 0)}`
        : null,
      num(e.leadTimeDays, 0) !== null
        ? `${t("supplierRequests.detail.answer.leadTime")}: ${num(e.leadTimeDays, 0)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const currencyDefault = r.supplierCurrency ?? r.item.currency ?? "USD";
  const showPropose = wellmix && canPropose(r);
  const showRespond = !!proposal && r.status === "answered";
  const showMessage = canPostMessage(r.status);

  return (
    <Card title={t("supplierRequests.negotiation.title")}>
      <div id="conversa" data-negotiation>
        {events.length ? (
          <ol className="mb-4 space-y-2" data-negotiation-events>
            {events.map((e) => (
              <li
                key={e.id}
                className={cx(
                  "rounded-lg border px-3 py-2 text-sm",
                  e.side === "wellmix"
                    ? "border-sky-200 bg-sky-50"
                    : "border-zinc-200 bg-white",
                )}
                data-negotiation-event={e.kind}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge tone={e.side === "wellmix" ? "info" : "neutral"}>
                    {t(`supplierRequests.negotiation.side.${e.side}`)}
                  </Badge>
                  <span className="font-medium text-zinc-700">
                    {t(
                      `supplierRequests.negotiation.kind.${e.kind}` as DictionaryKey,
                    )}
                  </span>
                  <span>{dateTime(e.at, t)}</span>
                </div>
                {e.kind === "proposal" || e.kind === "counter" ? (
                  <p className="mt-1 font-medium tabular-nums">{values(e)}</p>
                ) : null}
                {e.text ? (
                  <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                    {e.text}
                  </p>
                ) : null}
                {e.documentId ? (
                  <a
                    href={`/api/files/${e.documentId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sky-700 underline"
                    data-negotiation-file
                  >
                    {e.fileName ?? t("supplierRequests.negotiation.file")}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mb-4 text-sm text-zinc-500">
            {t("supplierRequests.negotiation.empty")}
          </p>
        )}

        {proposal ? (
          <p
            className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
            data-negotiation-pending
          >
            {t(
              wellmix
                ? "supplierRequests.negotiation.pendingWellmix"
                : "supplierRequests.negotiation.pendingSupplier",
            )}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {showPropose ? (
            <form
              action={proposeSupplierRequestAction}
              className="space-y-2"
              data-negotiation-propose-form
            >
              <h3 className="text-sm font-semibold">
                {t("supplierRequests.negotiation.propose")}
              </h3>
              <p className="text-xs text-zinc-500">
                {t("supplierRequests.negotiation.proposeHint")}
              </p>
              <input type="hidden" name="id" value={r.id} />
              {wellmix ? null : (
                <input type="hidden" name="view" value="item" />
              )}
              <OfferFields
                t={t}
                values={{
                  price: r.supplierPrice,
                  currency: r.supplierCurrency,
                  moq: r.supplierMoq,
                  leadTimeDays: r.supplierLeadTimeDays,
                }}
                currencyDefault={currencyDefault}
                raw={raw}
              />
              <Field label={t("supplierRequests.negotiation.comment")}>
                <Textarea
                  name="text"
                  rows={3}
                  maxLength={4000}
                  required
                  data-negotiation-text
                />
              </Field>
              <SubmitButton
                pendingText={t("supplierRequests.negotiation.sending")}
                data-negotiation-propose-submit
              >
                {t("supplierRequests.negotiation.proposeSubmit")}
              </SubmitButton>
            </form>
          ) : null}

          {showRespond ? (
            <form
              action={respondProposalAction}
              className="space-y-2"
              data-negotiation-respond-form
            >
              <h3 className="text-sm font-semibold">
                {t("supplierRequests.negotiation.respond")}
              </h3>
              <p className="text-xs text-zinc-500">
                {t(
                  wellmix
                    ? "supplierRequests.negotiation.respondWellmixHint"
                    : "supplierRequests.negotiation.respondHint",
                )}
              </p>
              <input type="hidden" name="id" value={r.id} />
              {wellmix ? null : (
                <input type="hidden" name="view" value="item" />
              )}
              <OfferFields
                t={t}
                values={proposal}
                currencyDefault={currencyDefault}
                raw={raw}
              />
              <Field label={t("supplierRequests.negotiation.commentOptional")}>
                <Textarea name="text" rows={2} maxLength={4000} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton
                  name="action"
                  value="accept"
                  data-negotiation-respond="accept"
                >
                  {t("supplierRequests.negotiation.accept")}
                </SubmitButton>
                <SubmitButton
                  name="action"
                  value="counter"
                  variant="secondary"
                  data-negotiation-respond="counter"
                >
                  {t("supplierRequests.negotiation.counter")}
                </SubmitButton>
                <SubmitButton
                  name="action"
                  value="reject"
                  variant="danger"
                  data-negotiation-respond="reject"
                >
                  {t("supplierRequests.negotiation.reject")}
                </SubmitButton>
              </div>
            </form>
          ) : null}

          {showMessage ? (
            <form
              action={postSupplierRequestMessageAction}
              className="space-y-2"
              data-negotiation-message-form
            >
              <h3 className="text-sm font-semibold">
                {t("supplierRequests.negotiation.message")}
              </h3>
              <input type="hidden" name="id" value={r.id} />
              {wellmix ? null : (
                <input type="hidden" name="view" value="item" />
              )}
              <Field label={t("supplierRequests.negotiation.messageText")}>
                <Textarea
                  name="text"
                  rows={3}
                  maxLength={4000}
                  data-negotiation-message-text
                />
              </Field>
              <Field
                label={t("supplierRequests.negotiation.attach")}
                hint={t("supplierRequests.negotiation.attachHint")}
              >
                <input
                  type="file"
                  name="file"
                  accept={ACCEPT}
                  className="block w-full text-sm"
                  data-negotiation-message-file
                />
              </Field>
              <SubmitButton
                variant="secondary"
                pendingText={t("supplierRequests.negotiation.sending")}
                data-negotiation-message-submit
              >
                {t("supplierRequests.negotiation.send")}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
