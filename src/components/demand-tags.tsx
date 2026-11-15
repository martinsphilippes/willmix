import type { Translate } from "@/i18n";
import type { Request } from "@/lib/db/schema";
import { demandKind } from "@/lib/purchase-demand";
import { isStockCustomer } from "@/lib/services/stock-party";

/*
 * Etiquetas da demanda de compra (docs/PURCHASE_DEMAND.md): encomenda ou
 * reposição e, na encomenda, a porta de entrada (vitrine, cliente,
 * vendedor, operador). Solicitações antigas sem porta: só o tipo.
 */
export function DemandTags({
  t,
  request,
}: {
  t: Translate;
  request: Pick<Request, "origin" | "customerId"> &
    Partial<Pick<Request, "channel">>;
}) {
  const kind = demandKind(request);
  if (!kind || (kind === "order" && isStockCustomer(request.customerId)))
    return null;
  return (
    <span
      className="mt-0.5 flex flex-wrap gap-1 text-[11px] font-medium"
      data-demand-tags={kind}
      data-demand-channel={request.channel ?? undefined}
    >
      <span
        className={
          kind === "replenishment"
            ? "rounded bg-sky-50 px-1.5 py-0.5 text-sky-800 ring-1 ring-inset ring-sky-200"
            : "rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-inset ring-emerald-200"
        }
      >
        {t(`demand.kind.${kind}.one`)}
      </span>
      {request.channel ? (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
          {t(`demand.channel.${request.channel}`)}
        </span>
      ) : null}
    </span>
  );
}
