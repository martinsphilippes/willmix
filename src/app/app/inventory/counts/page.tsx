import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { safeList } from "@/lib/services/stock";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { startStockCountAction } from "../../actions/stock";
import { stockErrorText } from "../_errors";

/**
 * Inventários (contagem física às cegas): lista com o andamento de cada um.
 * O admin abre um novo; quem conta entra no inventário aberto.
 */
export default async function StockCountsPage({
  searchParams,
}: PageProps<"/app/inventory/counts">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const sp = await searchParams;
  const admin = isAdmin(user);
  const counts = (await safeList("stock_counts")).sort(
    (a, b) => b.number - a.number,
  );
  const items = counts.length
    ? await safeList("stock_count_items", {
        filter: { countId: counts.map((c) => c.id) },
      })
    : [];
  const open = counts.find((c) => c.status === "open");
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("stockCount.title")}
        subtitle={t("stockCount.subtitle")}
        actions={
          <>
            <LinkButton href="/app/inventory">{t("inv.title")}</LinkButton>
            <LinkButton href="/app/inventory/movements?kind=count_loss">
              {t("stockMov.tab.count_loss")}
            </LinkButton>
          </>
        }
      />
      {error ? <Alert tone="danger">{stockErrorText(t, error)}</Alert> : null}
      {admin && !open ? (
        <Card title={t("stockCount.start")} className="mb-4">
          <form
            action={startStockCountAction}
            className="flex flex-wrap items-end gap-3"
            data-count-start
          >
            <Field label={t("stockCount.note")}>
              <Input name="note" maxLength={500} className="w-72" />
            </Field>
            <SubmitButton>{t("stockCount.start")}</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-zinc-500">
            {t("stockCount.startHint")}
          </p>
        </Card>
      ) : null}
      {counts.length === 0 ? (
        <Empty>{t("stockCount.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("stockCount.col.n")}</Th>
              <Th>{t("stockCount.col.status")}</Th>
              <Th>{t("stockCount.col.started")}</Th>
              <Th className="text-right">{t("stockCount.col.progress")}</Th>
              <Th className="text-right">{t("stockCount.col.review")}</Th>
              {admin ? (
                <Th className="text-right">{t("stockCount.col.losses")}</Th>
              ) : null}
              <Th>{t("stockCount.col.closed")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => {
              const mine = items.filter((i) => i.countId === c.id);
              const done = mine.filter(
                (i) => i.status === "ok" || i.status === "approved",
              ).length;
              const review = mine.filter((i) => i.status === "review").length;
              const losses = mine.reduce(
                (s, i) => s + Math.min(0, i.difference ?? 0),
                0,
              );
              return (
                <tr key={c.id} className={rowClass} data-count-row={c.number}>
                  <Td className="font-semibold">
                    <TextLink href={`/app/inventory/counts/${c.id}`}>
                      #{c.number}
                    </TextLink>
                  </Td>
                  <Td>
                    <Badge tone={c.status === "open" ? "warning" : "success"}>
                      {t(`stockCount.status.${c.status}`)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(c.createdAt, t)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {done}/{mine.length}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {review > 0 ? (
                      <span className="font-semibold text-amber-700">
                        {review}
                      </span>
                    ) : (
                      0
                    )}
                  </Td>
                  {admin ? (
                    <Td className="text-right tabular-nums text-rose-700">
                      {losses ? losses.toLocaleString(t.intl) : "0"}
                    </Td>
                  ) : null}
                  <Td className="whitespace-nowrap">
                    {c.closedAt ? formatDate(c.closedAt, t) : "—"}
                  </Td>
                  <Td className="text-right">
                    <TextLink href={`/app/inventory/counts/${c.id}`}>
                      {t("stockCount.open")}
                    </TextLink>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
