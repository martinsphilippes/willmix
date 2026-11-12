import type { SupplierRequest, SupplierRequestEvent } from "@/lib/db/schema";
import { SHEET_CURRENCIES } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import { canPropose, pendingProposal } from "@/lib/supplier-requests";
import type { SupplierRequestSla } from "@/lib/services/supplier-request-negotiation";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
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
  const currencyDefault = r.supplierCurrency ?? r.item.currency ?? "USD";
  const showPropose = wellmix && canPropose(r);
  // Só o fornecedor responde à contraproposta (a Wellmix não responde por ele).
  const showRespond = !wellmix && !!proposal && r.status === "answered";

  // Histórico na linha do tempo e mensagens no chat flutuante: aqui ficam
  // só a contraproposta e a resposta a ela.
  if (!proposal && !showPropose) return null;
  return (
    // Fica na coluna estreita da direita, embaixo do Booking (pedido do
    // dono): cartão compacto e os formulários um embaixo do outro.
    <Card title={t("supplierRequests.negotiation.title")} dense>
      <div id="conversa" data-negotiation>
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

        <div className="grid gap-4">
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
                {t("supplierRequests.negotiation.respondHint")}
              </p>
              <input type="hidden" name="id" value={r.id} />
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
        </div>
      </div>
    </Card>
  );
}
