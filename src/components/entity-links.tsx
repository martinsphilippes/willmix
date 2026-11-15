import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { User } from "@/lib/db";
import { TextLink, cx } from "@/components/ui";
import {
  entityLinkAccess,
  linksForOrder,
  selectionHref,
  type EntityLinkAccess,
  type EntityLinks,
} from "@/lib/services/entity-links";

/*
 * Ligações entre book, seleção, produto e pedido (fase 4b,
 * docs/MILESTONES.md): links só de leitura para as telas que o login abre
 * (`entityLinkAccess`, só a Wellmix). Quem não abre a tela não vê o link.
 */

export type EntityLinkKind =
  "book" | "selection" | "supplierRequests" | "products" | "orders";

/** Os links de cada tipo pedido, na ordem do mapa (book → … → pedido). */
export function entityLinkNodes({
  t,
  links,
  access,
  kinds,
}: {
  t: Translate;
  links: Pick<
    EntityLinks,
    "selections" | "supplierRequests" | "products" | "orders"
  > &
    Partial<Pick<EntityLinks, "lots">>;
  access: EntityLinkAccess;
  kinds: readonly EntityLinkKind[];
}): ReactNode[] {
  const out: ReactNode[] = [];
  const want = new Set(kinds);
  if (want.has("book") && access.book)
    for (const lot of links.lots ?? [])
      out.push(
        <TextLink
          key={`lot-${lot.id}`}
          href={`/app/booking/lots/${lot.id}`}
          title={lot.fileName}
          data-entity-link="book"
        >
          {t("entityLinks.book", { n: lot.number })}
        </TextLink>,
      );
  if (want.has("selection") && access.book)
    for (const s of links.selections)
      out.push(
        <TextLink
          key={`sel-${s.id}`}
          href={selectionHref(s)}
          data-entity-link="selection"
        >
          {t("entityLinks.selection")}
        </TextLink>,
      );
  if (want.has("supplierRequests") && access.supplierRequests)
    for (const r of links.supplierRequests)
      out.push(
        <TextLink
          key={`sr-${r.id}`}
          href={`/app/supplier-requests/${r.id}`}
          data-entity-link="supplier-request"
        >
          {t("entityLinks.supplierRequest", { n: r.number })}
        </TextLink>,
      );
  if (want.has("products") && access.products)
    for (const p of links.products)
      out.push(
        <TextLink
          key={`p-${p.id}`}
          href={`/app/products/${p.id}`}
          title={p.sku ?? undefined}
          data-entity-link="product"
        >
          {p.name}
        </TextLink>,
      );
  if (want.has("orders") && access.orders)
    for (const o of links.orders)
      out.push(
        <TextLink
          key={`o-${o.id}`}
          href={`/app/orders/${o.id}`}
          data-entity-link="order"
        >
          {t("orders.number", { number: o.number })}
        </TextLink>,
      );
  return out;
}

/** Os links em linha, separados por "·" (vazio: nada). */
export function EntityLinkList({
  nodes,
  className,
  empty = null,
}: {
  nodes: ReactNode[];
  className?: string;
  empty?: ReactNode;
}) {
  if (!nodes.length) return <>{empty}</>;
  return (
    <span className={cx("flex flex-wrap items-center gap-x-1.5", className)}>
      {nodes.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 ? <span className="text-zinc-400">·</span> : null}
          {node}
        </span>
      ))}
    </span>
  );
}

/**
 * "Origem do pedido" no alto do pedido (só a Wellmix): o book, a seleção, as
 * solicitações ao fornecedor e os produtos. Só aparece no pedido que nasceu
 * de um book ou de uma solicitação ao fornecedor.
 */
export async function OrderOriginLinks({
  orderId,
  user,
  t,
}: {
  orderId: string;
  user: User;
  t: Translate;
}) {
  const access = entityLinkAccess(user);
  if (!access.orders) return null;
  const links = await linksForOrder(orderId);
  if (!links.lots.length && !links.supplierRequests.length) return null;
  const nodes = entityLinkNodes({
    t,
    links,
    access,
    kinds: ["book", "selection", "supplierRequests", "products"],
  });
  if (!nodes.length) return null;
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-zinc-200/80 bg-white px-3 py-2 text-xs"
      data-order-origin=""
    >
      <span className="font-semibold uppercase tracking-wide text-zinc-500">
        {t("entityLinks.orderTitle")}
      </span>
      <EntityLinkList nodes={nodes} />
    </div>
  );
}
