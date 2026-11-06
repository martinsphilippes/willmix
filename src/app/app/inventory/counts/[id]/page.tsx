import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { safeList } from "@/lib/services/stock";
import { productPhotoList } from "@/lib/services/product-list";
import {
  Alert,
  Badge,
  Input,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import {
  approveStockCountItemAction,
  closeStockCountAction,
  submitStockCountAction,
} from "../../../actions/stock";
import { stockErrorText } from "../../_errors";

const STATUS_TONE = {
  pending: "neutral",
  retry: "warning",
  review: "danger",
  ok: "success",
  approved: "info",
} as const;

/**
 * Um inventário: um produto por linha. Quem conta grava a quantidade sem ver
 * o que o sistema tem (às cegas); a quantidade esperada e a diferença só
 * aparecem para o admin, que aprova os itens que erraram as duas contagens e
 * fecha o inventário.
 */
export default async function StockCountPage({
  params,
  searchParams,
}: PageProps<"/app/inventory/counts/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) redirect("/app");
  const { id } = await params;
  const sp = await searchParams;
  const store = getStore();
  const [count] = (await safeList("stock_counts")).filter((c) => c.id === id);
  if (!count) notFound();
  const t = await getT();
  const admin = isAdmin(user);
  const open = count.status === "open";
  const items = await safeList("stock_count_items", {
    filter: { countId: count.id },
  });
  const productIds = items.map((i) => i.productId);
  const [products, photos, users] = await Promise.all([
    productIds.length
      ? store.list("products", { filter: { id: productIds } })
      : Promise.resolve([]),
    productIds.length
      ? store.list("product_photos", { filter: { productId: productIds } })
      : Promise.resolve([]),
    store.list("users"),
  ]);
  const product = (pid: string) => products.find((p) => p.id === pid) ?? null;
  const userName = (uid: string | null) =>
    uid ? (users.find((u) => u.id === uid)?.name ?? "—") : "—";
  const rows = [...items].sort((a, b) =>
    (product(a.productId)?.name ?? "").localeCompare(
      product(b.productId)?.name ?? "",
    ),
  );
  const done = items.filter(
    (i) => i.status === "ok" || i.status === "approved",
  ).length;
  const review = items.filter((i) => i.status === "review").length;
  const result = typeof sp.result === "string" ? sp.result : null;
  const resultItem = typeof sp.item === "string" ? sp.item : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const num = (n: number | null) =>
    n === null ? "—" : n.toLocaleString(t.intl);

  return (
    <>
      <PageHeader
        t={t}
        title={t("stockCount.detail", { n: count.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={open ? "warning" : "success"}>
              {t(`stockCount.status.${count.status}`)}
            </Badge>
            <span>{formatDate(count.createdAt, t)}</span>
            <span data-count-summary>
              {t("stockCount.summary", {
                done,
                total: items.length,
                review,
              })}
            </span>
            {count.note ? (
              <span className="text-zinc-500">· {count.note}</span>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href="/app/inventory/counts">
              {t("stockCount.title")}
            </LinkButton>
            {admin && open ? (
              <form action={closeStockCountAction}>
                <input type="hidden" name="countId" value={count.id} />
                <SubmitButton
                  variant="primary"
                  disabled={done < items.length}
                  title={t("stockCount.closeHint")}
                >
                  {t("stockCount.close")}
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />
      {sp.started ? (
        <Alert tone="success">{t("stockCount.started")}</Alert>
      ) : null}
      {sp.approved ? (
        <Alert tone="success">{t("stockCount.approved")}</Alert>
      ) : null}
      {sp.closed ? (
        <Alert tone="success">{t("stockCount.closed")}</Alert>
      ) : null}
      {error ? <Alert tone="danger">{stockErrorText(t, error)}</Alert> : null}
      <p className="mb-3 text-sm text-zinc-600">{t("stockCount.blind")}</p>
      <Table>
        <thead>
          <tr>
            <Th className="w-14" />
            <Th>{t("stockCount.col.product")}</Th>
            <Th>{t("stockCount.col.status")}</Th>
            <Th>{t("stockCount.col.count")}</Th>
            <Th>{t("stockCount.col.attempts")}</Th>
            {admin ? (
              <>
                <Th className="text-right">{t("stockCount.col.expected")}</Th>
                <Th className="text-right">{t("stockCount.col.final")}</Th>
                <Th className="text-right">{t("stockCount.col.diff")}</Th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const p = product(i.productId);
            const canCount =
              open && (i.status === "pending" || i.status === "retry");
            const message =
              resultItem === i.id &&
              (result === "ok" || result === "retry" || result === "review")
                ? result
                : null;
            return (
              <tr
                key={i.id}
                id={`item-${i.id}`}
                className={cx(
                  rowClass,
                  "scroll-mt-24",
                  i.status === "review" && "bg-rose-50/50",
                )}
                data-count-item={i.status}
              >
                <Td className="w-14">
                  <PhotoGallery
                    name={p?.name ?? ""}
                    {...galleryProps(t, p ? productPhotoList(p, photos) : [])}
                  />
                </Td>
                <Td className="min-w-44">
                  <span className="font-medium text-zinc-900">
                    {p?.name ?? i.productId}
                  </span>
                  <span className="block font-mono text-xs text-zinc-500">
                    {[p?.sku, p?.supplierSku].filter(Boolean).join(" · ")}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={STATUS_TONE[i.status]}>
                    {t(`stockCount.item.${i.status}`)}
                  </Badge>
                </Td>
                <Td className="min-w-64">
                  {message ? (
                    <p
                      className={cx(
                        "mb-2 rounded-lg px-2 py-1 text-xs font-medium",
                        message === "ok"
                          ? "bg-emerald-50 text-emerald-800"
                          : message === "retry"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-rose-50 text-rose-800",
                      )}
                      role="status"
                      data-count-result={message}
                    >
                      {t(`stockCount.result.${message}`)}
                    </p>
                  ) : null}
                  {canCount ? (
                    <form
                      action={submitStockCountAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="countId" value={count.id} />
                      <input type="hidden" name="itemId" value={i.id} />
                      <Input
                        name="qty"
                        type="number"
                        min="0"
                        step="1"
                        required
                        inputMode="numeric"
                        aria-label={t("stockCount.qty")}
                        placeholder={t("stockCount.qty")}
                        className="w-36"
                      />
                      <span className="text-xs text-zinc-500">
                        {i.unit ?? "un"}
                      </span>
                      <SubmitButton variant="primary">
                        {t("stockCount.save")}
                      </SubmitButton>
                    </form>
                  ) : admin && open && i.status === "review" ? (
                    <form
                      action={approveStockCountItemAction}
                      className="space-y-2"
                      data-count-approve
                    >
                      <input type="hidden" name="countId" value={count.id} />
                      <input type="hidden" name="itemId" value={i.id} />
                      <div className="flex items-center gap-2">
                        <Input
                          name="finalQty"
                          type="number"
                          min="0"
                          step="1"
                          required
                          defaultValue={i.attempt2Qty ?? ""}
                          aria-label={t("stockCount.approve")}
                          className="w-28"
                        />
                        <Input
                          name="note"
                          maxLength={500}
                          placeholder={t("stockCount.approveNote")}
                          aria-label={t("stockCount.approveNote")}
                          className="flex-1"
                        />
                        <SubmitButton variant="primary">
                          {t("stockCount.approve")}
                        </SubmitButton>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {t("stockCount.approveHint")}
                      </p>
                    </form>
                  ) : i.finalQty !== null ? (
                    <span className="tabular-nums">
                      {num(i.finalQty)} {i.unit ?? "un"}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs text-zinc-600">
                  {i.attempt1Qty !== null ? (
                    <span className="block">
                      {t("stockCount.attempt", {
                        n: 1,
                        qty: num(i.attempt1Qty),
                      })}{" "}
                      · {userName(i.attempt1ByUserId)}
                    </span>
                  ) : null}
                  {i.attempt2Qty !== null ? (
                    <span className="block">
                      {t("stockCount.attempt", {
                        n: 2,
                        qty: num(i.attempt2Qty),
                      })}{" "}
                      · {userName(i.attempt2ByUserId)}
                    </span>
                  ) : null}
                  {i.approvedByUserId ? (
                    <span className="block text-sky-700">
                      {t("stockCount.item.approved")} ·{" "}
                      {userName(i.approvedByUserId)}
                      {i.approvalNote ? ` · ${i.approvalNote}` : ""}
                    </span>
                  ) : null}
                  {i.attempt1Qty === null ? "—" : null}
                </Td>
                {admin ? (
                  <>
                    <Td className="text-right tabular-nums">
                      {num(i.expected)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {num(i.finalQty)}
                    </Td>
                    <Td
                      className={cx(
                        "text-right font-semibold tabular-nums",
                        (i.difference ?? 0) < 0
                          ? "text-rose-700"
                          : (i.difference ?? 0) > 0
                            ? "text-emerald-700"
                            : "text-zinc-500",
                      )}
                    >
                      {i.difference === null
                        ? "—"
                        : `${i.difference > 0 ? "+" : ""}${num(i.difference)}`}
                    </Td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
