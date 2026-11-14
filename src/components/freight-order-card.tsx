import type { Translate } from "@/i18n";
import type { User } from "@/lib/db";
import { getStore } from "@/lib/db";
import { freightForOrder } from "@/lib/services/freight";
import { requestOrderFreightAction } from "@/app/app/actions/freight";
import {
  Alert,
  Badge,
  Card,
  Table,
  Td,
  Th,
  TextLink,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/** Erros do pedido de frete que este cartão explica. */
const FREIGHT_ERRORS = ["no_carriers", "no_cargo"] as const;

/**
 * Frete marítimo do pedido (só a Wellmix): pede o frete às companhias
 * marítimas ativas com a carga do pedido e mostra o que cada uma informou.
 */
export async function FreightOrderCard({
  t,
  user,
  orderId,
  notice,
  count,
  error,
  returnTo,
}: {
  t: Translate;
  user: User;
  orderId: string;
  notice: string | null;
  count: number;
  error: string | null;
  /** Tela do passo do menu (docs/FLOW_MENU.md): o pedido de frete volta para ela. */
  returnTo?: string;
}) {
  const rows = await freightForOrder(user, orderId);
  const carriers = rows.length
    ? await getStore().list("parties", {
        filter: { id: [...new Set(rows.map((r) => r.carrierId))] },
      })
    : [];
  const carrierName = (id: string) =>
    carriers.find((c) => c.id === id)?.name ?? "—";
  const live = rows.some((r) => r.status !== "cancelled");
  const errorKey = FREIGHT_ERRORS.find((k) => k === error);
  return (
    <div id="freight" className="scroll-mt-24" data-order-freight>
      <Card title={t("freight.order.title")}>
        <p className="mb-3 text-sm text-zinc-600">{t("freight.order.hint")}</p>
        {notice === "sent" ? (
          <div className="mb-3">
            <Alert tone="success">
              {t("freight.order.sent", { n: count })}
            </Alert>
          </div>
        ) : notice === "unchanged" ? (
          <div className="mb-3">
            <Alert tone="info">{t("freight.order.unchanged")}</Alert>
          </div>
        ) : null}
        {errorKey ? (
          <div className="mb-3">
            <Alert tone="danger">{t(`freight.error.${errorKey}`)}</Alert>
          </div>
        ) : null}
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("freight.col.carrier")}</Th>
                <Th>{t("freight.col.cargo")}</Th>
                <Th>{t("freight.col.value")}</Th>
                <Th>{t("freight.col.requestedAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  className={rowClass}
                  data-order-freight-row={f.status}
                >
                  <Td>
                    <TextLink href={`/app/freight/${f.id}`}>
                      {carrierName(f.carrierId)}
                    </TextLink>
                    <span className="mt-1 block">
                      <Badge
                        tone={
                          f.status === "answered"
                            ? "success"
                            : f.status === "cancelled"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {t(`freight.status.${f.status}`)}
                      </Badge>
                    </span>
                  </Td>
                  <Td className="tabular-nums">
                    {t("freight.cargo.cartonsSummary", {
                      cartons: f.cartons?.toLocaleString(t.intl) ?? "?",
                      cbm:
                        f.totalCbm?.toLocaleString(t.intl, {
                          maximumFractionDigits: 3,
                        }) ?? "?",
                      kg:
                        f.grossWeightKg?.toLocaleString(t.intl, {
                          maximumFractionDigits: 1,
                        }) ?? "?",
                    })}
                  </Td>
                  <Td className="tabular-nums">
                    {f.status === "answered"
                      ? formatMoney(f.amount, f.currency, t)
                      : "—"}
                    {f.status === "answered" && f.transitDays ? (
                      <span className="block text-xs text-zinc-500">
                        {t("freight.sent.transit", { days: f.transitDays })}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{formatDate(f.createdAt, t)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-500">{t("freight.order.none")}</p>
        )}
        <form action={requestOrderFreightAction} className="mt-3">
          <input type="hidden" name="orderId" value={orderId} />
          {returnTo ? (
            <input type="hidden" name="returnTo" value={returnTo} />
          ) : null}
          <SubmitButton variant="secondary" data-order-freight-request>
            {live ? t("freight.order.again") : t("freight.order.request")}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
