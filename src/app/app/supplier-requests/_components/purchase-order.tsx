import { roundsDates, roundsLine } from "@/components/purchase-rounds";
import { ColorLines } from "@/components/color-lines";
import { colorTotals } from "@/lib/color-split";
import type { Party } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { PurchaseCandidateGroup } from "@/lib/services/purchase-order";
import { Alert, Card, Input, Table, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createPurchaseOrderAction } from "../../actions/purchase-order";

/*
 * Gerar o pedido de compra (docs/PURCHASE_ORDER.md): um formulário por
 * fornecedor, com os produtos aprovados que ainda não estão em pedido. A
 * quantidade vem da solicitação e pode ser ajustada.
 */
export function PurchaseOrderCard({
  groups,
  customer,
  t,
}: {
  groups: PurchaseCandidateGroup[];
  customer: Party | null;
  t: Translate;
}) {
  const num = (n: number | null | undefined, digits = 4) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  return (
    <Card title={t("purchaseOrder.card.title")}>
      <p className="mb-3 text-sm text-zinc-600">
        {t("purchaseOrder.card.hint")}
      </p>
      {customer ? (
        <p className="mb-3 text-xs text-zinc-500" data-purchase-customer>
          {t("purchaseOrder.card.customer", { name: customer.name })}
        </p>
      ) : (
        <div className="mb-3">
          <Alert tone="warning">
            {t("purchaseOrder.error.purchase_order_customer_missing")}
          </Alert>
        </div>
      )}
      <div className="space-y-4">
        {groups.map((group) => (
          <form
            key={group.supplierId}
            action={createPurchaseOrderAction}
            className="space-y-2 rounded-lg border border-zinc-200 p-3"
            data-purchase-group={group.supplierId}
          >
            <h3 className="text-sm font-semibold">
              {group.supplier?.name ?? "—"}
            </h3>
            <Table>
              <thead>
                <tr>
                  <Th>{t("purchaseOrder.col.include")}</Th>
                  <Th>{t("purchaseOrder.col.request")}</Th>
                  <Th>{t("purchaseOrder.col.product")}</Th>
                  <Th>{t("purchaseOrder.col.price")}</Th>
                  <Th>{t("purchaseOrder.col.moq")}</Th>
                  <Th>{t("purchaseOrder.col.leadTime")}</Th>
                  <Th>{t("purchaseOrder.col.quantity")}</Th>
                </tr>
              </thead>
              <tbody>
                {group.candidates.map(({ request: r, product }) => (
                  <tr key={r.id} data-purchase-candidate={r.id}>
                    <Td>
                      <input
                        type="checkbox"
                        name="requestIds"
                        value={r.id}
                        defaultChecked
                        aria-label={product.name}
                      />
                    </Td>
                    <Td>{r.number}</Td>
                    <Td>
                      <span className="block max-w-64 whitespace-normal">
                        {product.name}
                      </span>
                    </Td>
                    <Td className="tabular-nums">
                      {num(r.supplierPrice ?? r.item.price)}{" "}
                      {r.supplierCurrency ?? r.item.currency ?? ""}
                    </Td>
                    <Td className="tabular-nums">
                      {num(r.supplierMoq ?? r.item.moq, 0)}
                    </Td>
                    <Td className="tabular-nums">
                      {num(r.supplierLeadTimeDays, 0)}
                    </Td>
                    <Td>
                      {r.schedule?.items.length ? (
                        // Programação de compra: o total é a soma das
                        // rodadas; o pedido vira o pai e cada rodada, um filho.
                        <span
                          className="block max-w-56 whitespace-normal text-xs"
                          data-purchase-rounds={r.id}
                        >
                          <strong className="block text-sm tabular-nums">
                            {r.quantity.toLocaleString(t.intl)}
                          </strong>
                          {roundsLine(r.schedule, t)}
                          <span className="block text-zinc-500">
                            {roundsDates(r.schedule, t)}
                          </span>
                        </span>
                      ) : (
                        <Input
                          name={`qty_${r.id}`}
                          inputMode="numeric"
                          defaultValue={String(r.quantity)}
                          className="w-28"
                          aria-label={t("purchaseOrder.col.quantity")}
                          data-purchase-qty={r.id}
                        />
                      )}
                      {/* Variações de cor: cada cor na própria linha (as
                          peças da escolha; quantidade mudada é dividida de
                          novo entre as mesmas cores ao gerar). */}
                      <ColorLines
                        colors={colorTotals(r.colorPlan)}
                        name={product.name}
                        intl={t.intl}
                        className="max-w-72"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <SubmitButton
              pendingText={t("purchaseOrder.card.pending")}
              data-purchase-submit={group.supplierId}
            >
              {t("purchaseOrder.card.submit")}
            </SubmitButton>
          </form>
        ))}
      </div>
    </Card>
  );
}
