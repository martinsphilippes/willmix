import type { ReactNode } from "react";
import type { SupplierRequest } from "@/lib/db/schema";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import { ProposalFields } from "./proposal-fields";
import type { Translate } from "@/i18n";
import { canPropose, pendingProposal } from "@/lib/supplier-requests";
import type { SupplierRequestSla } from "@/lib/services/supplier-request-negotiation";
import { Badge, Field, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionForm } from "@/components/action-form";
import {
  proposeSupplierRequestStateAction,
  respondProposalStateAction,
} from "../../actions/supplier-requests";
import { OfferRowFields } from "./offer-row";

/*
 * Negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Negociação" e "Tela da negociação reorganizada"): a contraproposta da
 * Wellmix e a resposta do fornecedor a ela, na seção "Negociação e conversa"
 * (o histórico fica na lateral; a conversa, logo abaixo destes formulários).
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

/**
 * Formulários da seção "Negociação e conversa": a contraproposta da Wellmix
 * (em preparação até enviar) e a resposta do fornecedor a ela. Mesmos campos,
 * regras e Server Actions de antes, nas variantes que devolvem o erro: dando
 * errado, o que foi digitado fica. `fromTo` diz quem envia e quem recebe.
 */
export function NegotiationForms({
  request: r,
  wellmix,
  t,
  showPrice = true,
  fromTo,
  errors,
  fallbackError,
}: {
  request: SupplierRequest;
  wellmix: boolean;
  t: Translate;
  /**
   * Preço na contraproposta: falso para a Wellmix sem "Ver preço de compra"
   * (ela propõe MOQ, prazo e FOB/EXW; dono, 15/11/2026).
   */
  showPrice?: boolean;
  fromTo: ReactNode;
  errors: Record<string, string>;
  fallbackError: string;
}) {
  const events = r.negotiation ?? [];
  const proposal = pendingProposal(events);
  const currencyDefault = r.supplierCurrency ?? r.item.currency ?? "USD";
  const incotermDefault = r.supplierIncoterm ?? r.item.incoterm ?? "FOB";
  const showPropose = wellmix && canPropose(r);
  // Só o fornecedor responde à contraproposta (a Wellmix não responde por ele).
  const showRespond = !wellmix && !!proposal && r.status === "answered";

  if (!proposal && !showPropose) return null;
  return (
    <div id="conversa" className="space-y-3" data-negotiation>
      {proposal ? (
        <p
          className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
          data-negotiation-pending
        >
          {t(
            wellmix
              ? "supplierRequests.negotiation.pendingWellmix"
              : "supplierRequests.negotiation.pendingSupplier",
          )}
        </p>
      ) : null}

      {showPropose ? (
        <ActionForm
          action={proposeSupplierRequestStateAction}
          errors={errors}
          fallbackError={fallbackError}
          pendingLabel={t("supplierRequests.negotiation.sending")}
          // Contraproposta gravada: o formulário renasce com os valores novos.
          key={`propose-${events.length}`}
          className="space-y-2 rounded-lg border border-zinc-200 p-2.5"
          data-negotiation-propose-form
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-zinc-900">
              {t("supplierRequests.negotiation.propose")}
            </h4>
            <span className="rounded-full bg-sky-100 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              {t("negotiationScreen.counter.draft")}
            </span>
          </div>
          <p className="mb-2 text-xs text-zinc-500">
            {t("supplierRequests.negotiation.proposeHint")}
          </p>
          <input type="hidden" name="id" value={r.id} />
          <div className="space-y-2">
            <ProposalFields
              showPrice={showPrice}
              values={{
                price: showPrice ? r.supplierPrice : null,
                currency: showPrice
                  ? (r.supplierCurrency ?? currencyDefault)
                  : "",
                moq: r.supplierMoq,
                leadTimeDays: r.supplierLeadTimeDays,
                incoterm: incotermDefault,
              }}
              currencies={SHEET_CURRENCIES}
              incoterms={SHEET_INCOTERMS}
              intl={t.intl}
              labels={{
                price: t("negotiationScreen.f.price"),
                currency: t("negotiationScreen.f.currency"),
                moq: t("negotiationScreen.f.moq"),
                leadTime: t("negotiationScreen.f.leadTime"),
                incoterm: t("negotiationScreen.f.incoterm"),
              }}
            />
            <Field label={t("supplierRequests.negotiation.comment")}>
              <Textarea
                name="text"
                rows={2}
                maxLength={4000}
                required
                className="max-h-48 min-h-9 resize-y"
                data-negotiation-text
              />
            </Field>
            {fromTo}
            <SubmitButton
              className="min-h-9"
              pendingText={t("supplierRequests.negotiation.sending")}
              data-negotiation-propose-submit
            >
              {t("supplierRequests.negotiation.proposeSubmit")}
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      {showRespond && proposal ? (
        <ActionForm
          action={respondProposalStateAction}
          errors={errors}
          fallbackError={fallbackError}
          pendingLabel={t("supplierRequests.negotiation.sending")}
          key={`respond-${proposal.id}`}
          className="space-y-2 rounded-lg border border-zinc-200 p-2.5"
          data-negotiation-respond-form
        >
          <h4 className="mb-1 text-sm font-semibold text-zinc-900">
            {t("supplierRequests.negotiation.respond")}
          </h4>
          <p className="mb-2 text-xs text-zinc-500">
            {t("supplierRequests.negotiation.respondHint")}
          </p>
          <input type="hidden" name="id" value={r.id} />
          <div className="space-y-2">
            <OfferRowFields
              t={t}
              values={{
                price: proposal.price,
                currency: proposal.currency ?? currencyDefault,
                moq: proposal.moq,
                leadTimeDays: proposal.leadTimeDays,
                incoterm: proposal.incoterm ?? incotermDefault,
              }}
              marks={{
                price: "data-negotiation-price",
                moq: "data-negotiation-moq",
                leadTime: "data-negotiation-lead-time",
                incoterm: "data-negotiation-incoterm",
              }}
            />
            <Field label={t("supplierRequests.negotiation.commentOptional")}>
              <Textarea
                name="text"
                rows={2}
                maxLength={4000}
                className="max-h-48 min-h-9 resize-y"
              />
            </Field>
            {fromTo}
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                className="min-h-9"
                name="action"
                value="accept"
                data-negotiation-respond="accept"
              >
                {t("supplierRequests.negotiation.accept")}
              </SubmitButton>
              <SubmitButton
                className="min-h-9"
                name="action"
                value="counter"
                variant="secondary"
                data-negotiation-respond="counter"
              >
                {t("supplierRequests.negotiation.counter")}
              </SubmitButton>
              <SubmitButton
                className="min-h-9"
                name="action"
                value="reject"
                variant="danger"
                data-negotiation-respond="reject"
              >
                {t("supplierRequests.negotiation.reject")}
              </SubmitButton>
            </div>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
