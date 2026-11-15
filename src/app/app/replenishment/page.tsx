import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { can } from "@/lib/auth/function-access";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getSettings } from "@/lib/settings";
import { isOpenDemand, listDemands } from "@/lib/services/purchase-demand";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { ProductPicker } from "@/components/product-picker";
import { productPickerLabels } from "@/components/party-picker-labels";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { openReplenishmentAction } from "../actions/purchase-demand";

/*
 * Reposição (mapa B10; dono, 15/11/2026; docs/PURCHASE_DEMAND.md): a fila do
 * Planner. Entradas: a reposição aberta à mão (produto, quantidade, data
 * desejada) e a recompra vinda do pós-venda. Sem sugestão automática pelo
 * estoque: o estoque ainda não é controlado no portal (Configurações,
 * "Reposição automática pelo estoque", desligada e sem efeito).
 */
export default async function ReplenishmentPage({
  searchParams,
}: PageProps<"/app/replenishment">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "requests");
  if (!isWellmix(user)) redirect("/app/requests");
  const { error, opened } = await searchParams;
  const t = await getT();
  const [rows, settings] = await Promise.all([
    listDemands("replenishment"),
    getSettings(),
  ]);
  const canOpenNew = can(user, "replenishment.open");
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `demand.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const open = rows.filter(isOpenDemand);
  return (
    <div data-replenishment-page={open.length}>
      <PageHeader
        t={t}
        title={t("demand.replenishment.title")}
        subtitle={t("demand.replenishment.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {typeof opened === "string" ? (
        <div className="mb-3" role="status" data-replenishment-opened>
          <Alert tone="success">{t("demand.replenishment.opened")}</Alert>
        </div>
      ) : null}
      {!settings.autoReplenishmentByStock ? (
        <p className="mb-3 text-sm text-zinc-600" data-replenishment-manual>
          {t("demand.replenishment.manualOnly")}
        </p>
      ) : null}
      {canOpenNew ? (
        <Card title={t("demand.replenishment.new")} dense>
          <form
            action={openReplenishmentAction}
            className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
            data-replenishment-new
          >
            <Field label={t("common.product")}>
              <ProductPicker
                scope="active"
                name="productId"
                required
                labels={productPickerLabels(t)}
                ariaLabel={t("common.product")}
              />
            </Field>
            <Field label={t("common.quantity")}>
              <Input
                name="quantity"
                inputMode="numeric"
                required
                data-replenishment-quantity
              />
            </Field>
            <Field label={t("demand.desiredAt")}>
              <Input type="date" name="desiredAt" data-replenishment-date />
            </Field>
            <div className="sm:col-span-3">
              <Field label={t("demand.notes")}>
                <Textarea name="notes" rows={2} />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <SubmitButton data-replenishment-submit>
                {t("demand.replenishment.submit")}
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}
      <Card title={t("demand.replenishment.queue", { n: open.length })}>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("demand.number")}</Th>
                <Th>{t("common.product")}</Th>
                <Th>{t("common.quantity")}</Th>
                <Th>{t("demand.source")}</Th>
                <Th>{t("demand.desiredAt")}</Th>
                <Th>{t("demand.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={rowClass}
                  data-replenishment-row={r.id}
                >
                  <Td className="tabular-nums">
                    <Link href={`/app/requests/${r.id}`} className={linkClass}>
                      {r.number ? `#${r.number}` : "—"}
                    </Link>
                  </Td>
                  <Td>{productNameText(t, r.productName)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {r.quantity.toLocaleString(t.intl)} {r.unit}
                  </Td>
                  <Td>
                    <Badge tone="neutral">
                      {t(
                        r.sourceOrderId
                          ? "demand.source.afterSales"
                          : "demand.source.planner",
                      )}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.desiredAt ? formatDate(r.desiredAt, t) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={isOpenDemand(r) ? "warning" : "success"}>
                      {t(
                        isOpenDemand(r)
                          ? "demand.status.waitingStrategy"
                          : "demand.status.ordered",
                      )}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("demand.replenishment.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
