import type { User } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { Task } from "@/lib/services/tasks";
import { sentQuoteView } from "@/lib/services/quote-sheet";
import { ClearDraft } from "./form-draft-guard";
import { LinkButton, formatMoney } from "./ui";

/*
 * Cotação enviada: o fornecedor chega às Pendências com a confirmação do que
 * mandou (produto, nº, preço, prazo) e o próximo passo à mão: responder a
 * próxima cotação, ou ver a enviada (dá para corrigir e reenviar até a
 * decisão). Só a cotação dele, respondida; senão não mostra nada.
 */
export async function QuoteSentNotice({
  user,
  quoteId,
  tasks,
  t,
}: {
  user: User;
  quoteId: string;
  /** Pendências do usuário (já ordenadas pelo prazo). */
  tasks: Task[];
  t: Translate;
}) {
  const view = await sentQuoteView(user, quoteId);
  if (!view) return null;
  const pending = tasks.filter((task) => task.kind === "quote");
  const next = pending[0] ?? null;
  const facts = [
    view.requestNumber
      ? t("requests.numbered", { n: view.requestNumber })
      : null,
    view.price !== null ? formatMoney(view.price, view.currency, t) : null,
    view.leadTimeDays
      ? t("quoteSent.lead", { days: view.leadTimeDays })
      : null,
  ].filter(Boolean);
  return (
    <section
      role="status"
      data-quote-sent={view.quoteId}
      className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
    >
      {/* Enviada: o rascunho guardado desta ficha não volta mais. */}
      <ClearDraft userId={user.id} storageKey={`quote:${view.quoteId}`} />
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white"
        >
          ✓
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-emerald-900">
            {t("quotes.answered")}
          </p>
          <p className="text-sm text-emerald-900">
            <span className="font-medium">{view.productName}</span>
            {facts.length ? ` · ${facts.join(" · ")}` : null}
          </p>
          <p className="text-sm text-emerald-800">{t("quoteSent.edit")}</p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {next ? (
              <LinkButton
                variant="primary"
                href={next.link}
                data-quote-sent-next
              >
                {t("quoteSent.next", { title: next.title })}
              </LinkButton>
            ) : (
              <span
                className="text-sm font-medium text-emerald-900"
                data-quote-sent-none
              >
                {t("quoteSent.none")}
              </span>
            )}
            <LinkButton href={`/app/quotes/${view.quoteId}`}>
              {t("quoteSent.view")}
            </LinkButton>
          </div>
          {pending.length > 1 ? (
            <p className="text-xs text-emerald-800">
              {t("quoteSent.pending", { n: pending.length })}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
