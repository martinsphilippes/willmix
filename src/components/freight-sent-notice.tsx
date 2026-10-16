import type { FreightQuote, User } from "@/lib/db";
import type { Translate } from "@/i18n";
import { sentFreightView } from "@/lib/services/freight";
import { LinkButton, formatDate, formatMoney } from "./ui";

/*
 * Frete informado: a companhia marítima chega à lista de fretes com a
 * confirmação do que mandou (produto, valor, trânsito, validade) e o próximo
 * passo à mão: informar o próximo pedido de frete, ou ver o enviado (dá para
 * atualizar até a Wellmix fechar a proposta). Só o frete da companhia dele,
 * já informado; senão não mostra nada.
 */
export async function FreightSentNotice({
  user,
  freightId,
  next,
  productOf,
  pending,
  t,
}: {
  user: User;
  freightId: string;
  /** Próximo pedido de frete esperando valor (o primeiro da lista). */
  next: FreightQuote | undefined;
  productOf: (requestId: string) => string;
  pending: number;
  t: Translate;
}) {
  const view = await sentFreightView(user, freightId);
  if (!view) return null;
  const facts = [
    view.amount !== null ? formatMoney(view.amount, view.currency, t) : null,
    view.transitDays
      ? t("freight.sent.transit", { days: view.transitDays })
      : null,
    view.validUntil
      ? t("freight.sent.until", { date: formatDate(view.validUntil, t) })
      : null,
  ].filter(Boolean);
  return (
    <section
      role="status"
      data-freight-sent={view.id}
      className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white"
        >
          ✓
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-emerald-900">{t("freight.saved")}</p>
          <p className="text-sm text-emerald-900">
            <span className="font-medium">{view.productName}</span>
            {facts.length ? ` · ${facts.join(" · ")}` : null}
          </p>
          <p className="text-sm text-emerald-800">{t("freight.sent.edit")}</p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {next ? (
              <LinkButton
                variant="primary"
                href={`/app/freight/${next.id}`}
                data-freight-sent-next
              >
                {t("freight.sent.next", { product: productOf(next.requestId) })}
              </LinkButton>
            ) : (
              <span
                className="text-sm font-medium text-emerald-900"
                data-freight-sent-none
              >
                {t("freight.sent.none")}
              </span>
            )}
            <LinkButton href={`/app/freight/${view.id}`}>
              {t("freight.sent.view")}
            </LinkButton>
          </div>
          {pending > 1 ? (
            <p className="text-xs text-emerald-800">
              {t("freight.sent.pending", { n: pending })}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
