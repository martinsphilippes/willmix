import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { canAddProducts, canDeleteRequest } from "@/lib/services/requests";
import {
  cancelledOrderIds,
  requestDisplayStatus,
  requestStatusTone,
} from "@/lib/services/order-status";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  LinkButton,
  OpenLink,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ChatOpenButton } from "@/components/chat-open-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import { productPhotoList } from "@/lib/services/product-list";
import { itemLogistics } from "@/lib/services/item-logistics";
import { getSettings } from "@/lib/settings";
import { containersText, requestRounds } from "@/lib/request-rounds";
import { productNameText } from "@/i18n";
import { SubmitButton } from "@/components/submit-button";
import { deleteRequestsAction } from "../../../actions/requests";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Lote de solicitações: os produtos pedidos juntos (mesmo groupId) numa
 * página só. Cada produto segue com o próprio pedido; daqui se abre cada
 * um. É o nível do pedido (dono, 18/11/2026): a solicitação de um produto
 * só (sem lote) também abre aqui, pelo id dela. Cada produto tem foto,
 * peças por caixa, caixas e a conversa dele neste pedido. Mesmo isolamento da lista: só aparece o que o usuário pode ver
 * (canViewRequest); nada visível = 404.
 */
export default async function RequestBatchPage({
  params,
  searchParams,
}: PageProps<"/app/requests/batch/[groupId]">) {
  const { groupId } = await params;
  const { created, deleted, skipped, error, fromCart, added, sale } =
    await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "requests");
  const t = await getT();
  const store = getStore();
  let rows = (
    await store.list("requests", {
      filter: { groupId },
      orderBy: "createdAt",
    })
  ).filter((r) => canViewRequest(user, r));
  /* Abrir é sempre no nível do pedido (dono, 18/11/2026): a solicitação
     criada sozinha (sem lote) abre aqui pelo id dela, como pedido de um
     produto só; a de um lote vai para a página do lote. */
  if (!rows.length) {
    const own = await store.get("requests", groupId).catch(() => null);
    if (!own || !canViewRequest(user, own)) notFound();
    if (own.groupId && own.groupId !== groupId)
      redirect(`/app/requests/batch/${encodeURIComponent(own.groupId)}`);
    rows = [own];
  }

  const orderIds = rows
    .map((r) => r.orderId)
    .filter((id): id is string => !!id);
  const productIds = [
    ...new Set(rows.map((r) => r.productId).filter((id): id is string => !!id)),
  ];
  const [cancelled, orders, customer, products, photos, settings] =
    await Promise.all([
      cancelledOrderIds(orderIds),
      orderIds.length
        ? store.list("orders", { filter: { id: orderIds } })
        : Promise.resolve([]),
      isWellmix(user)
        ? store.get("parties", rows[0].customerId)
        : Promise.resolve(null),
      productIds.length
        ? store.list("products", { filter: { id: productIds } })
        : Promise.resolve([]),
      productIds.length
        ? store.list("product_photos", { filter: { productId: productIds } })
        : Promise.resolve([]),
      getSettings(),
    ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const productOf = (r: (typeof rows)[number]) =>
    r.productId ? (productById.get(r.productId) ?? null) : null;
  /* Programações e containers do pedido (os mesmos da lista), no maior
     container das Configurações. */
  const reference =
    [...settings.containerTypes].sort(
      (a, b) => b.capacityCbm - a.capacityCbm,
    )[0] ?? null;
  const rounds = requestRounds(
    rows,
    (r) => productOf(r as (typeof rows)[number]),
    reference?.capacityCbm ?? null,
  );
  const distinctProducts = new Set(
    rows.map((r) => r.productId ?? `n:${r.productName}`),
  ).size;
  const num = (n: number, digits = 0) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const deletable = rows.filter((r) => canDeleteRequest(user, r));
  const number = rows.find((r) => r.number)?.number ?? null;

  const count = (v: string | string[] | undefined) =>
    typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0;
  const createdCount = count(created);
  // Base para "Adicionar produto": um produto do lote que ainda aceita.
  const addBase = rows.find((r) => canAddProducts(user, r)) ?? null;
  // Mesmas mensagens de erro da lista (lote criado com falha depois, exclusão).
  const errorText = (code: string) => {
    for (const prefix of ["reqBatch.error.", "reqDelete.error."]) {
      const key = `${prefix}${code}` as DictionaryKey;
      if (t(key) !== key) return t(key);
    }
    return t("common.error");
  };

  return (
    <>
      <PageHeader
        help={{ body: "help.requests.body", steps: "help.requests.steps" }}
        t={t}
        title={
          number
            ? t("reqBatch.titleNumbered", { number, n: rows.length })
            : t("reqBatch.title", { n: rows.length })
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {customer ? (
              <span className="font-medium text-zinc-700">{customer.name}</span>
            ) : null}
            <span>{formatDate(rows[0].createdAt, t)}</span>
          </span>
        }
        actions={
          <>
            {/* Wellmix: mais produtos no mesmo lote enquanto há um que ainda
                não virou pedido (o novo entra com o mesmo número). */}
            {addBase ? (
              <LinkButton
                href={`/app/requests/new?addTo=${addBase.id}`}
                variant="secondary"
                data-add-product
              >
                {t("reqAdd.button")}
              </LinkButton>
            ) : null}
            <TextLink href="/app/requests">
              {t("reqDelete.backToList")}
            </TextLink>
          </>
        }
      />
      {typeof error === "string" && error ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText(error)}</Alert>
        </div>
      ) : null}
      {count(deleted) > 0 ? (
        <div className="mb-3">
          <Alert tone="success">
            {t("reqDelete.done", { n: count(deleted) })}
            {count(skipped) > 0
              ? ` ${t("reqDelete.skipped", { n: count(skipped) })}`
              : ""}
          </Alert>
        </div>
      ) : null}
      {count(added) > 0 ? (
        <div className="mb-3" data-batch-added>
          <Alert tone="success">{t("reqAdd.done", { n: count(added) })}</Alert>
        </div>
      ) : null}
      {createdCount > 1 ? (
        <div className="mb-3" data-batch-created>
          <Alert tone="success">
            {fromCart === "1"
              ? `${t("explore.sent")} ${t("reqBatch.created", { n: createdCount })}${
                  typeof sale === "string" && /^\d{1,9}$/.test(sale)
                    ? ` ${t("demand.cart.saleSent", { n: sale })}`
                    : ""
                }`
              : t("reqBatch.created", { n: createdCount })}
          </Alert>
        </div>
      ) : null}
      <p className="mb-1 text-sm text-zinc-600">{t("reqBatch.pageHint")}</p>
      <p
        className="mb-3 text-sm font-medium text-zinc-800"
        data-batch-summary
      >
        {t("reqBatch.summary", {
          products: distinctProducts,
          rounds: rounds.rounds,
          containers: rounds.containers
            ? containersText(rounds.containers, (n) =>
                t("reqList.containers.each", { n }),
              )
            : "—",
        })}
      </p>
      <Table>
        <thead>
          <tr>
            <Th className="w-14">{t("reqBatch.col.photo")}</Th>
            <Th>{t("common.product")}</Th>
            <Th className="text-right">{t("reqBatch.col.perBox")}</Th>
            <Th className="text-right">{t("common.quantity")}</Th>
            <Th className="text-right">{t("reqBatch.col.boxes")}</Th>
            <Th className="text-right">{t("reqBatch.col.rounds")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("requests.deadline")}</Th>
            <Th>{t("requests.order")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = requestDisplayStatus(r, cancelled);
            const order = r.orderId
              ? orders.find((o) => o.id === r.orderId)
              : null;
            const product = productOf(r);
            const name = productNameText(t, r.productName);
            // Peças por caixa e caixas: as da variação ou do cadastro.
            const l = itemLogistics({
              quantity: r.quantity,
              variant: r.variant ?? null,
              product,
            });
            const href = `/app/requests/${r.id}`;
            return (
              <tr key={r.id} className={rowClass} data-batch-item={r.id}>
                <Td className="w-14">
                  <PhotoGallery
                    name={name}
                    {...galleryProps(
                      t,
                      product ? productPhotoList(product, photos) : [],
                    )}
                  />
                </Td>
                <Td className="min-w-40 font-medium text-zinc-900">
                  <TextLink
                    href={href}
                    className="text-zinc-900 no-underline hover:underline"
                  >
                    {name}
                  </TextLink>
                  {product?.sku ? (
                    <span className="block font-mono text-xs font-normal text-zinc-500">
                      {product.sku}
                    </span>
                  ) : null}
                  {r.variant?.name ? (
                    <span className="block text-xs font-normal text-zinc-500">
                      {r.variant.name}
                    </span>
                  ) : null}
                </Td>
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-per-box
                >
                  {l.unitsPerBox !== null ? num(l.unitsPerBox) : "—"}
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {num(r.quantity, 2)} {r.unit}
                </Td>
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-boxes
                >
                  {/* Sem peças por caixa no cadastro, "—" (não um 0 enganoso). */}
                  {l.unitsPerBox !== null ? num(l.boxes) : "—"}
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {Math.max(1, r.schedule?.items?.length ?? 0)}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={requestStatusTone(status)}>
                    {t(`reqStatusLabel.${status}`)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatDate(r.deadline, t)}
                </Td>
                <Td className="whitespace-nowrap">
                  {order && canViewOrder(user, order) ? (
                    <TextLink href={`/app/orders/${order.id}`}>
                      {t("reqBatch.order", { n: order.number })}
                    </TextLink>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <OpenLink href={href} label={t("reqBatch.openProduct")} />
                    {canDeleteRequest(user, r) ? (
                      <form action={deleteRequestsAction}>
                        <input type="hidden" name="ids" value={r.id} />
                        <input type="hidden" name="groupId" value={groupId} />
                        <ConfirmDeleteButton
                          label={t("reqDelete.delete")}
                          confirmText={t("reqDelete.confirmOne")}
                        />
                      </form>
                    ) : null}
                    {/* A conversa deste produto neste pedido. */}
                    <ChatOpenButton
                      target={{ requestId: r.id }}
                      label={`${t("reqBatch.chatProduct")}: ${name}`}
                    />
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {deletable.length > 1 ? (
        <form action={deleteRequestsAction} className="mt-3">
          {deletable.map((r) => (
            <input key={r.id} type="hidden" name="ids" value={r.id} />
          ))}
          <SubmitButton
            variant="secondary"
            className="text-red-700"
            confirmText={t("reqBatch.deleteAllConfirm")}
            data-batch-delete-all
          >
            {t("reqBatch.deleteAll")}
          </SubmitButton>
        </form>
      ) : null}
    </>
  );
}
