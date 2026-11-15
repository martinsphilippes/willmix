import type { getT } from "@/i18n/server";
import type { User } from "@/lib/db";
import {
  canPayFreight,
  listFreightPayables,
} from "@/lib/services/sales-orders";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Input,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { payFreightAction } from "../../actions/sales-orders";

/*
 * Fretes de venda (docs/SALES_ORDERS.md; dono, 15/11/2026): o frete da
 * ordem de venda expedida é uma conta a pagar à transportadora; vence na
 * saída + o prazo; o financeiro marca como pago com o comprovante.
 */
export async function SalesFreight({
  user,
  t,
  paid,
}: {
  user: User;
  t: Awaited<ReturnType<typeof getT>>;
  paid: boolean;
}) {
  if (!canPayFreight(user)) return null;
  const rows = await listFreightPayables(user);
  const money = (n: number) =>
    n.toLocaleString(t.intl, { minimumFractionDigits: 2 });
  const day = (d: string | null) => (d ? formatDate(`${d}T12:00:00Z`, t) : "—");
  return (
    <Card title={t("salesFreight.title")}>
      <div data-sales-freight={rows.length}>
        {paid ? <Alert tone="success">{t("salesFreight.done")}</Alert> : null}
        <p className="mb-2 text-sm text-zinc-600">{t("salesFreight.hint")}</p>
        {rows.length === 0 ? (
          <Empty>{t("salesFreight.empty")}</Empty>
        ) : (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("salesFreight.order")}</Th>
                <Th>{t("salesFreight.customer")}</Th>
                <Th>{t("salesFreight.carrier")}</Th>
                <Th className="text-right">{t("salesFreight.value")}</Th>
                <Th>{t("salesFreight.due")}</Th>
                <Th>{t("salesFreight.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-sales-freight-row={r.number}>
                  <Td>
                    <a href={`/app/sales-orders/${r.id}`} className={linkClass}>
                      #{r.number}
                    </a>
                  </Td>
                  <Td>{r.customerName}</Td>
                  <Td>{r.carrierName}</Td>
                  <Td className="text-right">{money(r.value)}</Td>
                  <Td>{day(r.dueDate)}</Td>
                  <Td>
                    {r.paidAt ? (
                      <span className="text-sm text-emerald-700">
                        {t("salesFreight.paid", {
                          date: formatDate(r.paidAt, t),
                        })}
                        {r.proofDocumentId ? (
                          <>
                            {" · "}
                            <a
                              href={`/api/files/${r.proofDocumentId}`}
                              className={linkClass}
                            >
                              {t("salesFreight.proof")}
                            </a>
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <form
                        action={payFreightAction}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Badge tone={r.overdue ? "danger" : "warning"}>
                          {t(
                            r.overdue
                              ? "salesFreight.overdue"
                              : "salesFreight.open",
                          )}
                        </Badge>
                        <input type="hidden" name="id" value={r.id} />
                        <Input
                          type="file"
                          name="proofFile"
                          required
                          aria-label={t("salesFreight.proof")}
                        />
                        <SubmitButton variant="secondary">
                          {t("salesFreight.pay")}
                        </SubmitButton>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Card>
  );
}
