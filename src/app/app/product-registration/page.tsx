import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import { listRegistrations } from "@/lib/services/product-registration";
import type { RegistrationState } from "@/lib/product-registration";
import {
  Badge,
  Card,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  rowClass,
} from "@/components/ui";

/*
 * Cadastrar produto (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md): no
 * menu, logo depois da Cotação. Uma linha por produto aprovado na cotação
 * que veio do book; "A cadastrar" até o produto ter o código do Sankhya.
 */

const TONE: Record<
  RegistrationState,
  "warning" | "info" | "success" | "neutral"
> = {
  waiting_sample: "neutral",
  to_register: "warning",
  to_send: "info",
  done: "success",
};

export default async function ProductRegistrationPage({
  searchParams,
}: PageProps<"/app/product-registration">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "productRegistration");
  if (!isWellmix(user)) notFound();
  const sp = await searchParams;
  const t = await getT();
  const tab = sp.tab === "done" ? "done" : "open";
  const rows = await listRegistrations(user, tab);
  const chip = (key: "open" | "done", label: string) => (
    <Link
      href={
        key === "open"
          ? "/app/product-registration"
          : "/app/product-registration?tab=done"
      }
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium",
        tab === key
          ? "border-brand-600 bg-brand-50 text-brand-800"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400",
      )}
      aria-current={tab === key ? "page" : undefined}
      data-registration-tab={key}
    >
      {label}
    </Link>
  );
  return (
    <div data-product-registration-list>
      <PageHeader
        t={t}
        title={t("productRegistration.title")}
        subtitle={t("productRegistration.subtitle")}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {chip("open", t("productRegistration.tab.open"))}
        {chip("done", t("productRegistration.tab.done"))}
      </div>
      <Card>
        {rows.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("productRegistration.col.quote")}</Th>
                <Th>{t("productRegistration.col.product")}</Th>
                <Th>{t("productRegistration.col.supplier")}</Th>
                <Th>{t("productRegistration.col.book")}</Th>
                <Th>{t("productRegistration.col.state")}</Th>
                <Th>{t("productRegistration.col.code")}</Th>
                <Th>{t("productRegistration.col.saved")}</Th>
                <Th>
                  <span className="sr-only">
                    {t("productRegistration.open")}
                  </span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.request.id}
                  className={rowClass}
                  data-registration-row={row.request.id}
                >
                  <Td className="tabular-nums">
                    <Link
                      href={`/app/supplier-requests/${row.request.id}?view=item`}
                      className="text-brand-700 hover:underline"
                    >
                      {row.request.number}
                    </Link>
                  </Td>
                  <Td>{productNameText(t, row.name)}</Td>
                  <Td>{row.supplierName ?? "—"}</Td>
                  <Td className="tabular-nums">
                    {row.lotNumber !== null ? row.lotNumber : "—"}
                  </Td>
                  <Td>
                    <span data-registration-state={row.state}>
                      <Badge tone={TONE[row.state]}>
                        {t(`productRegistration.state.${row.state}`)}
                      </Badge>
                    </span>
                  </Td>
                  <Td className="tabular-nums">
                    {row.product?.sankhyaCode ?? "—"}
                  </Td>
                  <Td className="tabular-nums">
                    {row.request.registration?.savedAt
                      ? formatDate(row.request.registration.savedAt, t)
                      : "—"}
                  </Td>
                  <Td>
                    <OpenLink
                      href={`/app/product-registration/${row.request.id}`}
                      label={t("productRegistration.open")}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-600" data-product-registration-empty>
            {t(
              tab === "done"
                ? "productRegistration.empty.done"
                : "productRegistration.empty.open",
            )}
          </p>
        )}
      </Card>
    </div>
  );
}
