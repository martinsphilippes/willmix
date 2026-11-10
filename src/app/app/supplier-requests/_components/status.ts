import type { SupplierRequest, SupplierRequestStatus } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { Tone } from "@/components/ui";

/** Cor da situação da solicitação ao fornecedor. */
export const STATUS_TONE: Record<SupplierRequestStatus, Tone> = {
  open: "warning",
  answered: "info",
  approved: "success",
  declined: "danger",
  cancelled: "neutral",
};

/** A resposta do fornecedor em uma linha ("Faz: 1,2 USD", "Não faz", "Esperando"). */
export function answerText(t: Translate, r: SupplierRequest): string {
  if (!r.supplierCanDo) return t("supplierRequests.answer.waiting");
  if (r.supplierCanDo === "no") return t("supplierRequests.answer.no");
  return r.supplierPrice === null
    ? t("supplierRequests.answer.yesNoPrice")
    : t("supplierRequests.answer.yes", {
        price:
          `${r.supplierPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })} ${r.supplierCurrency ?? ""}`.trim(),
      });
}
