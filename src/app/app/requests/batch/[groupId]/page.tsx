import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { canAddProducts, canDeleteRequest } from "@/lib/services/requests";
import { canConfirmAs, requestStepsFor } from "@/lib/services/request-turns";
import { nextStepText } from "@/lib/services/request-list";
import { turnTone, turnWaitingKey } from "@/lib/turn";
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
import { getSettings } from "@/lib/settings";
import { containersText } from "@/lib/request-rounds";
import { canSeeMoney } from "@/lib/auth/function-access";
import {
  loadRequestPacking,
  packingRounds,
  packingTotalsLine,
} from "@/lib/services/request-packing";
import { encomendaTotals } from "@/lib/request-totals";
import {
  SaleTotalValue,
  TotalValue,
  moneyValue,
  unitLabel,
} from "@/components/request-total-cells";
import { productNameText } from "@/i18n";
import { SubmitButton } from "@/components/submit-button";
import { deleteRequestsAction } from "../../../actions/requests";
import { sendToStrategyAction } from "../../../actions/purchase-demand";
import { awaitingStrategySend } from "@/lib/services/purchase-strategy";
import { canOpen } from "@/lib/auth/screens";
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
  const {
    created,
    deleted,
    skipped,
    error,
    fromCart,
    added,
    sale,
    strategySent,
    strategySkipped,
  } = await searchParams;
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
  /* Embalagem de cada produto: a mesma regra da lista de Encomendas e da
     ficha completa (peças, caixas e inner por programação, CBM, mínimo;
     src/lib/services/request-packing.ts), para os totais baterem com a
     lista (dono, 18/11/2026). Programações e containers do pedido pela
     mesma embalagem, no maior container das Configurações. */
  const packing = await loadRequestPacking(rows);
  const reference =
    [...settings.containerTypes].sort(
      (a, b) => b.capacityCbm - a.capacityCbm,
    )[0] ?? null;
  const rounds = packingRounds(rows, packing, reference?.capacityCbm ?? null);
  const wellmix = isWellmix(user);
  // Venda prevista: só com "Ver valores e margem" (o cliente não vê).
  const seeSale = wellmix && canSeeMoney(user);
  const lineOf = new Map(
    rows.map((r) => [
      r.id,
      packingTotalsLine(
        r,
        packing.get(r.id),
        productNameText(t, r.productName),
      ),
    ]),
  );
  const totals = encomendaTotals([...lineOf.values()]);
  const distinctProducts = new Set(
    rows.map((r) => r.productId ?? `n:${r.productName}`),
  ).size;
  const num = (n: number, digits = 0) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const deletable = rows.filter((r) => canDeleteRequest(user, r));
  // Enviar para cotação (dono, 18/11/2026): os produtos Solicitado ainda não
  // enviados entram na Estratégia de Compra, todos juntos (a estratégia é da
  // solicitação inteira).
  const sendable = isWellmix(user)
    ? rows.filter((r) => awaitingStrategySend(r))
    : [];
  const number = rows.find((r) => r.number)?.number ?? null;
  // De quem é a vez (dono, 18/11/2026; docs/TURNS.md): a mesma regra da
  // lista, por produto; o cabeçalho junta as diferentes.
  const steps = await requestStepsFor(user, rows, orders);
  const turns = [
    ...new Map(
      rows
        .map((r) => steps.get(r.id)!)
        .filter((n) => !!n.who && n.key !== "none")
        .map((n) => [`${n.who}|${n.key}`, n]),
    ).values(),
  ];
  // O cliente que confirma a venda: o cartão de confirmação fica na página
  // da encomenda (a pendência "Confirmar pedido" leva até ele).
  const confirmable = rows.find((r) => canConfirmAs(user, r)) ?? null;

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
            {turns.map((n) => (
              <span
                key={`${n.who}|${n.key}`}
                className="inline-flex flex-wrap items-center gap-2"
                data-request-turn={n.who!}
              >
                <Badge tone={turnTone(n.who!)}>
                  {user.role === "customer" && n.who === "customer"
                    ? t("turn.waiting.you")
                    : t(turnWaitingKey(n.who!))}
                </Badge>
                <span
                  className="text-sm text-zinc-700"
                  data-request-next={n.key}
                >
                  {t("reqList.col.next")}:{" "}
                  <span className="font-medium text-zinc-900">
                    {nextStepText(t, n)}
                  </span>
                </span>
              </span>
            ))}
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
      {confirmable ? (
        <div className="mb-3" data-batch-confirm>
          <Alert tone="warning">
            {t("turn.batch.confirm")}{" "}
            <TextLink href={`/app/requests/${confirmable.id}`}>
              {t("reqList.next.confirm")} →
            </TextLink>
          </Alert>
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
      {count(strategySent) > 0 ? (
        <div
          className="mb-3"
          role="status"
          data-strategy-sent={count(strategySent)}
        >
          <Alert tone="success">
            {t("reqSend.done", { n: count(strategySent) })}
            {count(strategySkipped) > 0
              ? ` ${t("reqSend.skipped", { n: count(strategySkipped) })}`
              : ""}{" "}
            {canOpen(user, "purchaseStrategy") ? (
              <TextLink href="/app/purchase-strategy">
                {t("reqSend.open")}
              </TextLink>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {sendable.length > 0 ? (
        <form action={sendToStrategyAction} className="mb-3">
          {sendable.map((r) => (
            <input key={r.id} type="hidden" name="ids" value={r.id} />
          ))}
          <input type="hidden" name="groupId" value={groupId} />
          <SubmitButton
            confirmText={t("reqSend.confirm").replace(
              "{n}",
              String(sendable.length),
            )}
            data-batch-send-all
          >
            {t("reqSend.all", { n: sendable.length })}
          </SubmitButton>
        </form>
      ) : null}
      {count(added) > 0 ? (
        <div className="mb-3" data-batch-added>
          <Alert tone="success">{t("reqAdd.done", { n: count(added) })}</Alert>
        </div>
      ) : null}
      {createdCount > 0 ? (
        <div
          className="mb-3"
          role="status"
          data-batch-created
          data-cart-sent={fromCart === "1" ? "" : undefined}
        >
          <Alert tone="success">
            {fromCart === "1"
              ? `${t("explore.sent")} ${createdCount > 1 ? t("reqBatch.created", { n: createdCount }) : ""}`.trim() +
                `${
                  typeof sale === "string" && /^\d{1,9}$/.test(sale)
                    ? ` ${t("demand.cart.saleSent", { n: sale })}`
                    : ""
                }`
              : createdCount > 1
                ? t("reqBatch.created", { n: createdCount })
                : t("reqBatch.createdOne")}
          </Alert>
        </div>
      ) : null}
      <p className="mb-1 text-sm text-zinc-600">{t("reqBatch.pageHint")}</p>
      <p className="mb-3 text-sm font-medium text-zinc-800" data-batch-summary>
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
      {/* Totais da encomenda (dono, 18/11/2026): os mesmos da lista. */}
      <section className="mb-3" data-batch-totals>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("reqBatch.totals")}
        </h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ...(seeSale
                ? [
                    {
                      key: "price",
                      label: t("reqList.col.price"),
                      value: <SaleTotalValue t={t} sale={totals.sale} />,
                    },
                  ]
                : []),
              ...(wellmix
                ? [
                    {
                      key: "moq",
                      label: t("reqList.col.moq"),
                      value: <TotalValue t={t} part={totals.moq} total="moq" />,
                    },
                  ]
                : []),
              {
                key: "pieces",
                label: t("reqList.col.pieces"),
                value: <TotalValue t={t} part={totals.pieces} total="pieces" />,
              },
              {
                key: "boxes",
                label: t("reqList.col.boxes"),
                value: <TotalValue t={t} part={totals.boxes} total="boxes" />,
              },
              {
                key: "inner",
                label: t("reqList.col.inner"),
                value: <TotalValue t={t} part={totals.inner} total="inner" />,
              },
              {
                key: "cbm",
                label: unitLabel(t("reqList.col.cbm")),
                value: <TotalValue t={t} part={totals.cbm} total="cbm" />,
              },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2"
              data-batch-total={item.key}
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {item.label}
              </dt>
              <dd className="mt-0.5 text-base font-semibold text-zinc-900">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <Table>
        <thead>
          <tr>
            <Th className="w-14">{t("reqBatch.col.photo")}</Th>
            <Th>{t("common.product")}</Th>
            <Th className="text-right">{t("reqBatch.col.perBox")}</Th>
            <Th className="text-right">{t("reqBatch.col.pieces")}</Th>
            <Th className="text-right">{t("reqBatch.col.boxes")}</Th>
            <Th className="text-right">{t("reqBatch.col.inner")}</Th>
            <Th className="text-right">{unitLabel(t("reqBatch.col.cbm"))}</Th>
            {wellmix ? (
              <Th className="text-right">{t("reqBatch.col.moq")}</Th>
            ) : null}
            {seeSale ? (
              <Th className="text-right">{t("reqBatch.col.price")}</Th>
            ) : null}
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
            // Peças por caixa, caixas (por programação), inner e CBM: a
            // embalagem do produto (a mesma regra da lista e da ficha).
            const pk = packing.get(r.id);
            const line = lineOf.get(r.id)!;
            const forecast = r.priceForecast ?? null;
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
                  {pk?.perBox ? num(pk.perBox.value) : "—"}
                </Td>
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-pieces
                >
                  {/* Peças de todas as programações; em outra unidade (kg,
                      m), a quantidade como foi pedida. */}
                  {line.pieces !== null
                    ? num(line.pieces, 2)
                    : `${num(r.quantity, 2)} ${r.unit}`}
                </Td>
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-boxes
                >
                  {/* Sem peças por caixa, "—" (não um 0 enganoso); a dica
                      mostra as caixas de cada programação. */}
                  <span
                    title={
                      pk?.boxes?.perRound && pk.boxes.perRound.length > 1
                        ? t("reqBatch.boxes.rounds", {
                            list: pk.boxes.perRound
                              .map((n) => num(n))
                              .join(" + "),
                          })
                        : undefined
                    }
                  >
                    {line.boxes !== null ? num(line.boxes) : "—"}
                  </span>
                </Td>
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-inner
                >
                  {line.innerBoxes !== null ? num(line.innerBoxes) : "—"}
                </Td>
                <Td
                  className="whitespace-nowrap text-right tabular-nums"
                  data-batch-cbm
                >
                  {/* 3 casas na tela, como a lista; a dica com 4 (a conta). */}
                  <span
                    title={
                      line.cbm !== null
                        ? `${line.cbm.toLocaleString(t.intl, { maximumFractionDigits: 4 })} m³`
                        : undefined
                    }
                  >
                    {line.cbm !== null
                      ? line.cbm.toLocaleString(t.intl, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })
                      : "—"}
                  </span>
                </Td>
                {wellmix ? (
                  <Td
                    className="whitespace-nowrap text-right tabular-nums"
                    data-batch-moq
                  >
                    {line.moq !== null ? num(line.moq) : "—"}
                  </Td>
                ) : null}
                {seeSale ? (
                  <Td
                    className="whitespace-nowrap text-right tabular-nums"
                    data-batch-price
                  >
                    <span
                      title={
                        forecast
                          ? t("reqBatch.price.hint", {
                              price: moneyValue(
                                t,
                                forecast.unitPrice,
                                forecast.currency,
                              ),
                              pieces: num(forecast.pieces),
                              date: formatDate(forecast.at, t),
                            })
                          : t("reqList.total.price.none")
                      }
                    >
                      {forecast
                        ? moneyValue(t, forecast.total, forecast.currency)
                        : "—"}
                    </span>
                  </Td>
                ) : null}
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
                    {!sendable.includes(r) &&
                    r.strategySentAt &&
                    isWellmix(user) ? (
                      <span
                        className="text-xs text-zinc-500"
                        data-batch-sent={r.id}
                      >
                        {t("reqSend.sentAt", {
                          date: formatDate(r.strategySentAt, t),
                        })}
                      </span>
                    ) : null}
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
