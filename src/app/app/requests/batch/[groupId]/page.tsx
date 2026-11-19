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
  canConfirmAs,
  requestStepsWithContext,
} from "@/lib/services/request-turns";
import { nextStepText, type NextStep } from "@/lib/services/request-list";
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
  PageHeader,
  TextLink,
  formatDate,
} from "@/components/ui";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ChatOpenButton } from "@/components/chat-open-button";
import { productPhotoList } from "@/lib/services/product-list";
import { getSettings } from "@/lib/settings";
import { canSeeMoney } from "@/lib/auth/function-access";
import {
  loadRequestPacking,
  packingRounds,
  packingTotalsLine,
} from "@/lib/services/request-packing";
import { encomendaTotals } from "@/lib/request-totals";
import { productNameText } from "@/i18n";
import { SubmitButton } from "@/components/submit-button";
import { deleteRequestsAction } from "../../../actions/requests";
import { sendToStrategyAction } from "../../../actions/purchase-demand";
import { awaitingStrategySend } from "@/lib/services/purchase-strategy";
import { canOpen } from "@/lib/auth/screens";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  responsibleKey,
  responsibleOf,
  stepOwner,
  stepPartners,
  type Responsible,
} from "@/lib/request-responsible";
import { peopleDirectory } from "@/lib/services/request-responsible";
import { ResponsibleTip } from "@/components/request-responsible-tip";
import { ListReturnLink } from "@/components/list-return";
import {
  DetailsProductsTable,
  DetailsSummary,
  DetailsTotals,
  type DetailsProduct,
} from "../../_details/details-view";

/*
 * Lote de solicitações: os produtos pedidos juntos (mesmo groupId) numa
 * página só. Cada produto segue com o próprio pedido; daqui se abre cada
 * um. É o nível do pedido (dono, 18/11/2026): a solicitação de um produto
 * só (sem lote) também abre aqui, pelo id dela. Cada produto tem foto,
 * peças por caixa, caixas e a conversa dele neste pedido. Mesmo isolamento da lista: só aparece o que o usuário pode ver
 * (canViewRequest); nada visível = 404.
 *
 * O resumo, os totais e a tabela de produtos são os mesmos dos detalhes do
 * rascunho (dono, 19/11/2026; ../../_details/details-view.tsx): o rascunho
 * abre a mesma tela, só para consulta (../../draft/[id]/page.tsx).
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
  const { steps, ctx } = await requestStepsWithContext(user, rows, orders);
  /* Quem age em cada passo (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
     seção 7): a mesma regra das Pendências e da lista de Encomendas; o
     login (e-mail) só para o administrador. Só a Wellmix vê. */
  const partnerIds = rows.flatMap((r) => {
    const step = steps.get(r.id)!;
    return stepOwner(step.key)?.kind === "partners"
      ? stepPartners(step.key, ctx?.purchaseOf(r)).map((x) => x.supplierId)
      : [];
  });
  const directory = wellmix
    ? await peopleDirectory(user, {
        users: await store.list("users"),
        requests: rows,
        ctx,
        partnerIds,
        customerName: (id) =>
          customer && customer.id === id ? customer.name : null,
        translate: (key) => t(key as DictionaryKey),
      })
    : null;
  const turns = [
    ...rows
      .reduce((groups, r) => {
        const n = steps.get(r.id)!;
        if (!n.who || n.key === "none") return groups;
        const key = `${n.who}|${n.key}`;
        const group = groups.get(key) ?? {
          step: n,
          people: new Map<string, Responsible>(),
        };
        const resp = directory
          ? responsibleOf(n, r, ctx?.purchaseOf(r), directory)
          : null;
        if (resp) group.people.set(responsibleKey(resp), resp);
        return groups.set(key, group);
      }, new Map<string, { step: NextStep; people: Map<string, Responsible> }>())
      .values(),
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
            {turns.map(({ step: n, people }) => (
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
                  {/* Quem age (a mesma regra da lista e das Pendências). */}
                  {[...people.values()].map((r) => (
                    <ResponsibleTip
                      key={responsibleKey(r)}
                      r={r}
                      t={t}
                      className="ml-1.5 inline-block max-w-full align-baseline"
                    />
                  ))}
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
            {/* Volta para a lista como estava (busca, filtros, página e
                rolagem; src/lib/list-return.ts). */}
            <ListReturnLink list="requests" data-details-back="">
              {t("reqDelete.backToList")}
            </ListReturnLink>
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
      <DetailsSummary t={t} products={distinctProducts} rounds={rounds} />
      {/* Totais da encomenda (dono, 18/11/2026): os mesmos da lista. */}
      <DetailsTotals
        t={t}
        totals={totals}
        wellmix={wellmix}
        seeSale={seeSale}
      />
      <DetailsProductsTable
        t={t}
        wellmix={wellmix}
        seeSale={seeSale}
        items={rows.map((r): DetailsProduct => {
          const status = requestDisplayStatus(r, cancelled);
          const order = r.orderId
            ? orders.find((o) => o.id === r.orderId)
            : null;
          const product = productOf(r);
          const name = productNameText(t, r.productName);
          const href = `/app/requests/${r.id}`;
          return {
            key: r.id,
            itemId: r.id,
            name,
            href,
            openLabel: t("reqBatch.openProduct"),
            sku: product?.sku ?? null,
            variantName: r.variant?.name ?? null,
            photos: product ? productPhotoList(product, photos) : [],
            packing: packing.get(r.id),
            line: lineOf.get(r.id)!,
            quantity: r.quantity,
            unit: r.unit,
            forecast: r.priceForecast ?? null,
            rounds: Math.max(1, r.schedule?.items?.length ?? 0),
            status: (
              <Badge tone={requestStatusTone(status)}>
                {t(`reqStatusLabel.${status}`)}
              </Badge>
            ),
            deadline: formatDate(r.deadline, t),
            order:
              order && canViewOrder(user, order) ? (
                <TextLink href={`/app/orders/${order.id}`}>
                  {t("reqBatch.order", { n: order.number })}
                </TextLink>
              ) : (
                "—"
              ),
            actions: (
              <>
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
              </>
            ),
          };
        })}
      />
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
