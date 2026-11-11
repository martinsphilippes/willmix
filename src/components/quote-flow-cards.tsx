import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import {
  NEGOTIATION_DISCOUNT_PCT,
  declinedOffer,
  offerRoundOf,
  packagingProposalState,
  pendingReturn,
  suggestedReturnPrice,
  type NegotiationRound,
  type PackagingProposal,
  type PackagingProposalVersion,
} from "@/lib/quote-flow";
import {
  decidePackagingProposalAction,
  replyNegotiationAction,
  returnQuoteAction,
  sendPackagingProposalAction,
} from "@/app/app/actions/quote-flow";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  Textarea,
  formatDate,
  formatMoney,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * Cotação: cartões da negociação (devolver com comentário e a resposta do
 * fornecedor) e da proposta de embalagem (imagem e o OK do fornecedor).
 * docs/QUOTE_FLOW.md. A Wellmix vê tudo e pode registrar a resposta do
 * fornecedor; o fornecedor da cotação vê o que é dele e responde.
 */

interface QuoteView {
  id: string;
  status: string;
  price: number | null;
  currency: string | null;
  negotiation?: NegotiationRound[] | null;
  packagingProposal?: PackagingProposal | null;
}

/** Número como a pessoa digita no idioma (vírgula no português). */
const typed = (n: number | null, intl: string) =>
  n === null
    ? ""
    : new Intl.NumberFormat(intl, {
        useGrouping: false,
        maximumFractionDigits: 4,
      }).format(n);

export function QuoteNegotiationCard({
  t,
  quote,
  wellmix,
  notice,
  chat,
}: {
  t: Translate;
  quote: QuoteView;
  /** Quem vê é da Wellmix (senão, o fornecedor da cotação). */
  wellmix: boolean;
  notice?: string;
  /** Botão das mensagens, mostrado quando o preço difere do desejado. */
  chat?: ReactNode;
}) {
  const rounds = quote.negotiation ?? [];
  const pending = pendingReturn(rounds);
  const open = quote.status === "answered" && quote.price !== null;
  // Fornecedor sem nada para ver: o cartão não aparece.
  if (!rounds.length && !(wellmix && open)) return null;
  const currency = quote.currency ?? "USD";
  const money = (n: number | null | undefined, cur: string = currency) =>
    typeof n === "number" ? formatMoney(n, cur, t) : "—";
  const { price: suggested, fromOffer } = suggestedReturnPrice(
    quote.price,
    rounds,
  );
  // Preço desejado enviado e o fornecedor respondeu com outro: negociar.
  const wanted = offerRoundOf(rounds)?.targetPrice;
  const differs = open && typeof wanted === "number" && quote.price !== wanted;
  return (
    <div id="negotiation" className="scroll-mt-24" data-quote-negotiation>
      <Card title={t("quoteFlow.neg.title")} dense>
        <div className="space-y-3">
          {notice === "returned" ? (
            <Alert tone="success">{t("quoteFlow.neg.done.returned")}</Alert>
          ) : notice === "replied" ? (
            <Alert tone="success">{t("quoteFlow.neg.done.replied")}</Alert>
          ) : notice === "confirmed" ? (
            <Alert tone="success">{t("quoteFlow.neg.done.confirmed")}</Alert>
          ) : notice === "countered" ? (
            <Alert tone="success">{t("quoteFlow.neg.done.countered")}</Alert>
          ) : null}
          {differs ? (
            <Alert tone="warning">
              <span data-negotiation-differs>
                {t("quoteFlow.neg.differs", {
                  price: money(quote.price),
                  wanted: money(wanted),
                })}
              </span>
              {chat ? <span className="mt-2 block">{chat}</span> : null}
            </Alert>
          ) : null}
          {wellmix && open && !pending ? (
            <p className="text-sm text-zinc-600">
              {t("quoteFlow.neg.hint.wellmix")}
            </p>
          ) : null}
          {open ? (
            <p className="text-sm font-medium text-zinc-900">
              {t("quoteFlow.neg.current", { price: money(quote.price) })}
            </p>
          ) : null}
          {pending ? (
            <Alert tone="warning">
              <span data-negotiation-pending>
                {wellmix
                  ? t("quoteFlow.neg.waiting", {
                      date: formatDate(pending.at, t),
                    })
                  : t("quoteFlow.neg.pending.supplier")}
              </span>
              <span className="mt-1 block whitespace-pre-wrap font-medium">
                {pending.comment}
              </span>
              {typeof pending.targetPrice === "number" ? (
                <span className="mt-1 block" data-negotiation-target>
                  {t("quoteFlow.neg.proposed", {
                    price: money(pending.targetPrice),
                  })}
                </span>
              ) : null}
            </Alert>
          ) : null}
          {/* Wellmix: devolver com comentário (sem devolução em aberto). */}
          {wellmix && open && !pending ? (
            <form
              action={returnQuoteAction}
              className="grid gap-3 sm:grid-cols-[1fr_14rem]"
              data-negotiation-return
            >
              <input type="hidden" name="quoteId" value={quote.id} />
              <Field label={t("quoteFlow.neg.comment")}>
                <Textarea name="comment" rows={2} maxLength={1000} required />
              </Field>
              <Field
                label={t("quoteFlow.neg.target", { currency })}
                hint={
                  suggested === null
                    ? undefined
                    : fromOffer
                      ? t("quoteFlow.neg.targetHintOffer", {
                          suggested: money(suggested),
                        })
                      : t("quoteFlow.neg.targetHint", {
                          pct: NEGOTIATION_DISCOUNT_PCT,
                          suggested: money(suggested),
                        })
                }
              >
                <Input
                  name="targetPrice"
                  inputMode="decimal"
                  autoComplete="off"
                  defaultValue={typed(suggested, t.intl)}
                />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton variant="secondary">
                  {t("quoteFlow.neg.return")}
                </SubmitButton>
              </div>
            </form>
          ) : null}
          {/* Resposta: o fornecedor, ou a Wellmix registrando por ele. */}
          {pending && open ? (
            <form
              action={replyNegotiationAction}
              className="space-y-2 rounded-xl border border-zinc-200 p-3"
              data-negotiation-reply
            >
              <input type="hidden" name="quoteId" value={quote.id} />
              <p className="text-sm font-semibold text-zinc-900">
                {wellmix
                  ? t("quoteFlow.neg.reply.title.wellmix")
                  : t("quoteFlow.neg.reply.title")}
              </p>
              <div className="space-y-1.5 text-sm text-zinc-800">
                {typeof pending.targetPrice === "number" ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="decision"
                      value="accept"
                      defaultChecked
                      required
                    />
                    {t("quoteFlow.neg.reply.accept", {
                      price: money(pending.targetPrice),
                    })}
                  </label>
                ) : null}
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="decision"
                    value="counter"
                    defaultChecked={typeof pending.targetPrice !== "number"}
                    required
                  />
                  {t("quoteFlow.neg.reply.counter")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="decision" value="keep" required />
                  {t("quoteFlow.neg.reply.keep", { price: money(quote.price) })}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
                <Field label={t("quoteFlow.neg.reply.price", { currency })}>
                  <Input name="price" inputMode="decimal" autoComplete="off" />
                </Field>
                <Field label={t("quoteFlow.neg.reply.comment")}>
                  <Textarea name="comment" rows={2} maxLength={1000} />
                </Field>
              </div>
              <SubmitButton>{t("quoteFlow.neg.reply.submit")}</SubmitButton>
              <p className="text-xs text-zinc-500">{t("quoteFlow.neg.chat")}</p>
            </form>
          ) : null}
          {rounds.length ? (
            <details open={rounds.length <= 4}>
              <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                {t("quoteFlow.neg.history")} ({rounds.length})
              </summary>
              <ol className="mt-2 space-y-1.5 text-sm" data-negotiation-history>
                {rounds.map((r, i) => (
                  <li
                    key={`${r.at}-${i}`}
                    className="rounded-lg bg-zinc-50 px-2.5 py-1.5"
                  >
                    <span className="font-medium text-zinc-900">
                      {t(`quoteFlow.neg.round.${r.kind}`)}
                    </span>
                    <span className="text-zinc-500">
                      {" · "}
                      {r.byName} · {formatDate(r.at, t)}
                    </span>
                    <span className="block text-zinc-700">
                      {r.kind === "decline"
                        ? money(r.previousPrice, r.currency ?? currency)
                        : r.kind === "return" || r.kind === "offer"
                          ? typeof r.targetPrice === "number"
                            ? t("quoteFlow.neg.round.target", {
                                price: money(
                                  r.targetPrice,
                                  r.currency ?? currency,
                                ),
                              })
                            : null
                          : r.price !== r.previousPrice
                            ? t("quoteFlow.neg.round.price", {
                                from: money(
                                  r.previousPrice,
                                  r.currency ?? currency,
                                ),
                                to: money(r.price, r.currency ?? currency),
                              })
                            : money(r.price, r.currency ?? currency)}
                      {r.comment ? (
                        <span className="block whitespace-pre-wrap">
                          {r.comment}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function ProposalImage({
  t,
  version,
}: {
  t: Translate;
  version: PackagingProposalVersion;
}): ReactNode {
  if (!version.imageDocumentId) return null;
  const href = `/api/files/${version.imageDocumentId}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block w-fit"
      title={t("quoteFlow.pack.open")}
    >
      {/* Arquivo servido pelo portal (com checagem de acesso): sem otimização. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={href}
        alt={t("quoteFlow.pack.title")}
        className="max-h-72 max-w-full rounded-xl border border-zinc-200 object-contain"
        data-proposal-image
      />
    </a>
  );
}

export function QuotePackagingProposalCard({
  t,
  quote,
  wellmix,
  notice,
}: {
  t: Translate;
  quote: QuoteView;
  wellmix: boolean;
  notice?: string;
}) {
  const proposal = quote.packagingProposal ?? null;
  const state = packagingProposalState(proposal);
  const open = quote.status === "invited" || quote.status === "answered";
  if (!proposal && !(wellmix && open)) return null;
  const tone =
    state === "ok" ? "success" : state === "no" ? "danger" : "warning";
  // Com proposta, a situação é uma das três (nunca "none").
  const stateLabel = t(
    `quoteFlow.pack.state.${state === "none" ? "waiting" : state}`,
  );
  return (
    <div
      id="packaging-proposal"
      className="scroll-mt-24"
      data-packaging-proposal={state}
    >
      <Card
        title={t("quoteFlow.pack.title")}
        dense
        actions={proposal ? <Badge tone={tone}>{stateLabel}</Badge> : null}
      >
        <div className="space-y-3">
          {notice === "sent" ? (
            <Alert tone="success">{t("quoteFlow.pack.done.sent")}</Alert>
          ) : notice === "ok" ? (
            <Alert tone="success">{t("quoteFlow.pack.done.ok")}</Alert>
          ) : notice === "no" ? (
            <Alert tone="success">{t("quoteFlow.pack.done.no")}</Alert>
          ) : null}
          {wellmix && !proposal ? (
            <p className="text-sm text-zinc-600">
              {t("quoteFlow.pack.hint.wellmix")}
            </p>
          ) : null}
          {proposal ? (
            <>
              <p className="text-sm text-zinc-600">
                {t("quoteFlow.pack.version", {
                  n: proposal.version,
                  date: formatDate(proposal.sentAt, t),
                  name: proposal.sentByName,
                })}
              </p>
              <ProposalImage t={t} version={proposal} />
              {proposal.prompt ? (
                <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700">
                  {proposal.prompt}
                </p>
              ) : null}
              {proposal.decision ? (
                <p className="text-sm text-zinc-700" data-proposal-decision>
                  <span className="font-medium">{stateLabel}</span>
                  {": "}
                  {t("quoteFlow.pack.decided", {
                    name: proposal.decidedByName ?? "—",
                    date: formatDate(proposal.decidedAt, t),
                  })}
                  {proposal.comment ? (
                    <span className="block whitespace-pre-wrap">
                      {proposal.comment}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {wellmix && state === "no" ? (
                <Alert tone="warning">
                  {t("quoteFlow.pack.refused.wellmix")}
                </Alert>
              ) : null}
            </>
          ) : null}
          {/* OK ou Não: o fornecedor, ou a Wellmix registrando por ele. */}
          {proposal && state === "waiting" && open ? (
            <form
              action={decidePackagingProposalAction}
              className="space-y-2 rounded-xl border border-zinc-200 p-3"
              data-proposal-decide
            >
              <input type="hidden" name="quoteId" value={quote.id} />
              <p className="text-sm font-semibold text-zinc-900">
                {wellmix
                  ? t("quoteFlow.pack.register.wellmix")
                  : t("quoteFlow.pack.ask.supplier")}
              </p>
              <Field label={t("quoteFlow.pack.comment")}>
                <Textarea name="comment" rows={2} maxLength={1000} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton name="decision" value="ok">
                  {t("quoteFlow.pack.ok")}
                </SubmitButton>
                <SubmitButton name="decision" value="no" variant="secondary">
                  {t("quoteFlow.pack.no")}
                </SubmitButton>
              </div>
            </form>
          ) : null}
          {/* Wellmix: enviar a proposta (a primeira ou uma nova). */}
          {wellmix && open ? (
            <details open={!proposal || state === "no"}>
              <summary className={linkClass}>
                {proposal
                  ? t("quoteFlow.pack.sendNew")
                  : t("quoteFlow.pack.send")}
              </summary>
              <form
                action={sendPackagingProposalAction}
                className="mt-2 space-y-3"
                data-proposal-send
              >
                <input type="hidden" name="quoteId" value={quote.id} />
                <Field label={t("quoteFlow.pack.prompt")}>
                  <Textarea name="prompt" rows={3} maxLength={2000} />
                </Field>
                <Field label={t("quoteFlow.pack.image")}>
                  <Input
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </Field>
                <SubmitButton variant="secondary">
                  {t("quoteFlow.pack.send")}
                </SubmitButton>
              </form>
            </details>
          ) : null}
          {proposal?.history?.length ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                {t("quoteFlow.pack.history")} ({proposal.history.length})
              </summary>
              <ol className="mt-2 space-y-2 text-sm">
                {proposal.history.map((v) => (
                  <li
                    key={v.version}
                    className="rounded-lg bg-zinc-50 px-2.5 py-1.5"
                  >
                    {t("quoteFlow.pack.version", {
                      n: v.version,
                      date: formatDate(v.sentAt, t),
                      name: v.sentByName,
                    })}{" "}
                    {v.decision
                      ? t(`quoteFlow.pack.state.${v.decision}`)
                      : t("quoteFlow.pack.state.waiting")}
                    {v.comment ? `: ${v.comment}` : ""}
                    {v.imageDocumentId ? (
                      <a
                        href={`/api/files/${v.imageDocumentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`ml-2 ${linkClass}`}
                      >
                        {t("quoteFlow.pack.open")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/** Etiquetas da cotação na lista da solicitação (só a Wellmix vê). */
export function quoteFlowChips(
  t: Translate,
  quote: Pick<QuoteView, "negotiation" | "packagingProposal">,
): Array<{
  key: string;
  text: string;
  tone: "warning" | "success" | "danger";
}> {
  const chips: Array<{
    key: string;
    text: string;
    tone: "warning" | "success" | "danger";
  }> = [];
  if (pendingReturn(quote.negotiation))
    chips.push({
      key: "returned",
      text: t("quoteFlow.chip.returned"),
      tone: "warning",
    });
  if (declinedOffer(quote.negotiation))
    chips.push({
      key: "offerDeclined",
      text: t("quoteFlow.chip.offerDeclined"),
      tone: "danger",
    });
  const state = packagingProposalState(quote.packagingProposal);
  if (state === "waiting")
    chips.push({
      key: "pack",
      text: t("quoteFlow.chip.packWaiting"),
      tone: "warning",
    });
  else if (state === "ok")
    chips.push({
      key: "pack",
      text: t("quoteFlow.chip.packOk"),
      tone: "success",
    });
  else if (state === "no")
    chips.push({
      key: "pack",
      text: t("quoteFlow.chip.packNo"),
      tone: "danger",
    });
  return chips;
}
