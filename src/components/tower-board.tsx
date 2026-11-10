import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type {
  BoardBlock,
  BoardCard,
  TowerBoard,
} from "@/lib/services/tower-board";
import { cx, formatMoney } from "./ui";

/*
 * Quadros da operação na Control Tower (o pedido de ponta a ponta em quatro
 * blocos). Cada quadrado é um link: tocar mostra os pedidos dele numa lista
 * logo abaixo do bloco dele, sem a tela pular (scroll={false}); tocar de novo
 * fecha a lista; containers e revisão levam às telas deles. Zero fica cinza (não some), para a tela ficar sempre igual.
 */

const BLOCKS: BoardBlock[] = ["request", "order", "parallel", "problem"];

const TONE: Record<BoardBlock, string> = {
  request: "from-violet-700 to-fuchsia-500",
  order: "from-sky-700 to-blue-500",
  parallel: "from-teal-700 to-emerald-500",
  problem: "from-rose-700 to-pink-500",
};

export function TowerBoardView({
  board,
  t,
  selected,
  occupancy,
  newRequestHref,
  detail = null,
}: {
  board: TowerBoard;
  t: Translate;
  /** Quadrado escolhido (?card=…). */
  selected: string | null;
  /** Ocupação média dos containers abertos (linha pequena do quadrado). */
  occupancy: string | null;
  /** "+" no quadrado "Solicitação nova" (só quem cria solicitação). */
  newRequestHref: string | null;
  /** Lista do quadrado escolhido: aparece logo abaixo do bloco dele. */
  detail?: ReactNode;
}) {
  return (
    <div data-tower-board>
      <p className="mb-3 text-xs text-zinc-500">{t("board.tap")}</p>
      {BLOCKS.map((block) => {
        const cards = board.cards.filter((c) => c.block === block);
        if (!cards.length) return null;
        return (
          <div key={block} className="mb-4" data-board-block={block}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                {t(`board.block.${block}` as DictionaryKey)}
              </h3>
              <span className="text-xs text-zinc-500">
                {t(`board.hint.${block}` as DictionaryKey)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {cards.map((card) => (
                <BoardTile
                  key={card.key}
                  card={card}
                  t={t}
                  active={selected === card.key}
                  currency={board.currency}
                  sub={card.key === "parContainers" ? occupancy : null}
                  add={
                    card.key === "reqNew" && newRequestHref
                      ? { href: newRequestHref, label: t("requests.new") }
                      : null
                  }
                />
              ))}
            </div>
            {detail && cards.some((c) => c.key === selected) ? detail : null}
          </div>
        );
      })}
    </div>
  );
}

function BoardTile({
  card,
  t,
  active,
  currency,
  sub,
  add,
}: {
  card: BoardCard;
  t: Translate;
  active: boolean;
  currency: string;
  sub: string | null;
  /** Atalho "+" no canto (ex.: nova solicitação), fora do link do quadrado. */
  add: { href: string; label: string } | null;
}) {
  const empty = card.count === 0;
  const label = t(`board.card.${card.key}` as DictionaryKey);
  // "Atrasados" já é a contagem de atrasados: sem o selo repetido.
  const late =
    card.overdue > 0 && card.key !== "probOverdue"
      ? card.overdue === 1
        ? t("board.late.one")
        : t("board.late.many", { n: card.overdue })
      : null;
  const tile = (
    <Link
      // Tocar no escolhido fecha a lista.
      href={card.href ?? (active ? "/app" : `/app?card=${card.key}`)}
      // Filtro na mesma tela: a lista muda embaixo, sem voltar ao topo.
      scroll={card.href ? undefined : false}
      aria-current={active ? "true" : undefined}
      aria-label={`${label}: ${card.count}${late ? ` (${late})` : ""}`}
      className={cx(
        "flex min-h-[5.75rem] flex-col justify-between rounded-xl p-2.5 shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
        empty
          ? "bg-zinc-200 text-zinc-600 hover:brightness-95"
          : cx("bg-gradient-to-br text-white", TONE[card.block]),
        active && "ring-4 ring-zinc-900/70 ring-offset-2",
      )}
      data-board-card={card.key}
      data-board-count={card.count}
    >
      <span className="block">
        <span className="text-2xl font-extrabold leading-none tabular-nums">
          {card.count}
        </span>
        {late ? (
          <span
            className="ml-1.5 inline-block rounded-full bg-red-600 px-2 py-0.5 align-middle text-[11px] font-bold leading-tight text-white"
            data-board-late={card.overdue}
          >
            {late}
          </span>
        ) : null}
        {card.value !== null ? (
          <span className="mt-1 block text-[11px] font-medium tabular-nums opacity-90">
            {formatMoney(card.value, currency, t)}
          </span>
        ) : null}
        {sub ? (
          <span className="mt-1 block text-[11px] font-medium opacity-90">
            {sub}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 text-[12.5px] font-semibold leading-tight">
        {label}
      </span>
    </Link>
  );
  if (!add) return tile;
  // Dois links lado a lado (link dentro de link não vale): o quadrado filtra
  // a lista; o "+" abre a tela de criar.
  return (
    <div className="relative">
      {tile}
      <Link
        href={add.href}
        title={add.label}
        aria-label={add.label}
        className={cx(
          "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-lg font-bold leading-none shadow-sm transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
          empty ? "bg-violet-700 text-white" : "bg-white text-violet-700",
        )}
        data-board-add={card.key}
      >
        +
      </Link>
    </div>
  );
}
