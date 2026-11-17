import type { Translate } from "@/i18n";
import type { ProductApprovalView } from "@/lib/services/product-approval";
import { Badge, Card, Field, Textarea, formatDate } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  decideProductApprovalAction,
  resubmitProductApprovalAction,
} from "../../actions/product-approval";

/*
 * Quadro da aprovação do produto novo no alto da tela do produto
 * (docs/NEW_PRODUCT.md): quem pediu e quando, com quem está, a recusa (com o
 * motivo) e os botões de quem decide (aprovar ou recusar) ou de quem corrige
 * (reenviar).
 */
export function ApprovalCard({
  t,
  productId,
  approval,
}: {
  t: Translate;
  productId: string;
  approval: ProductApprovalView;
}) {
  const pending = approval.status === "pending";
  const date = (iso: string | null) => (iso ? formatDate(iso, t) : "—");
  return (
    <div id="approval" className="mt-4 scroll-mt-4">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("productApproval.title")}
            <Badge tone={pending ? "warning" : "danger"}>
              {t(
                pending
                  ? "productApproval.badge.pending"
                  : "productApproval.badge.rejected",
              )}
            </Badge>
          </span>
        }
      >
        <div
          className="space-y-2 text-sm text-zinc-700"
          data-product-approval={approval.status}
        >
          <p>
            {t("productApproval.requestedBy", {
              name: approval.requesterName ?? "—",
              date: date(approval.requestedAt),
            })}{" "}
            {pending
              ? approval.superiorName
                ? t("productApproval.waitingFor", {
                    name: approval.superiorName,
                  })
                : t("productApproval.waitingForAdmins")
              : null}
          </p>
          {/* Recusa: a atual (recusado) ou a anterior (reenviado). */}
          {approval.note && approval.decidedAt ? (
            <p
              className={
                pending
                  ? "text-zinc-600"
                  : "rounded-lg bg-red-50 px-3 py-2 text-red-900"
              }
              data-product-approval-note
            >
              {t(
                pending
                  ? "productApproval.previousRejection"
                  : "productApproval.rejectedBy",
                {
                  name: approval.deciderName ?? "—",
                  date: date(approval.decidedAt),
                  note: approval.note,
                },
              )}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500">
            {t("productApproval.inactiveHint")}
          </p>
          {pending && approval.canDecide ? (
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <form action={decideProductApprovalAction}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton data-product-approve>
                  {t("productApproval.approve")}
                </SubmitButton>
              </form>
              <form
                action={decideProductApprovalAction}
                className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
              >
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="decision" value="reject" />
                <div className="min-w-0 flex-1 basis-64">
                  <Field label={t("productApproval.note")}>
                    <Textarea
                      name="note"
                      rows={2}
                      maxLength={1000}
                      required
                      placeholder={t("productApproval.notePlaceholder")}
                      data-product-reject-note
                    />
                  </Field>
                </div>
                <SubmitButton variant="danger" data-product-reject>
                  {t("productApproval.reject")}
                </SubmitButton>
              </form>
            </div>
          ) : pending ? (
            <p className="text-xs text-zinc-500">
              {t("productApproval.onlyApprovers")}
            </p>
          ) : null}
          {!pending && approval.canResubmit ? (
            <form
              action={resubmitProductApprovalAction}
              className="flex flex-wrap items-center gap-3 pt-1"
            >
              <input type="hidden" name="productId" value={productId} />
              <SubmitButton data-product-resubmit>
                {t("productApproval.resubmit")}
              </SubmitButton>
              <span className="text-xs text-zinc-500">
                {t("productApproval.resubmitHint")}
              </span>
            </form>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
