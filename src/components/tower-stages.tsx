import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { BoardCard } from "@/lib/services/tower-board";
import type { Stage, StageGroup } from "@/lib/tower-stages";
import { cx, formatMoney } from "./ui";

/*
 * Control Tower por etapa: "Precisa de ação agora" (chips do que o perfil
 * resolve) e as sete etapas do processo, com os passos dentro. Tudo é link
 * (sem a tela pular: scroll={false}); tocar de novo no escolhido fecha. Zero
 * fica cinza e continua à vista: saber o que não está acontecendo também faz
 * parte do processo. A lista do escolhido aparece logo abaixo dele.
 */

const STAGE_TONE: Record<string, string> = {
  request: "from-violet-700 to-fuchsia-500",
  prep: "from-sky-700 to-blue-500",
  production: "from-indigo-700 to-sky-500",
  shipping: "from-teal-700 to-emerald-500",
  port: "from-cyan-700 to-teal-500",
  delivery: "from-emerald-700 to-lime-500",
  closed: "from-zinc-700 to-zinc-500",
};

const lateLabel = (n: number, t: Translate) =>
  n === 1 ? t("board.late.one") : t("board.late.many", { n });

/** Chips do que precisa de ação, só dos quadrados que o perfil abre. */
export function ActionStrip({
  cards,
  t,
  selected,
  detail = null,
}: {
  cards: BoardCard[];
  t: Translate;
  /** Quadrado escolhido (?card=…). */
  selected: string | null;
  detail?: ReactNode;
}) {
  if (!cards.length) return null;
  return (
    <section
      aria-label={t("tower.action.title")}
      className="mb-5"
      data-tower-actions
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {t("tower.action.title")}
        </h2>
        <span className="text-xs text-zinc-500">{t("tower.action.hint")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.map((card) => {
          const label = t(`board.card.${card.key}` as DictionaryKey);
          const active = selected === card.key;
          const hot = card.count > 0;
          return (
            <Link
              key={card.key}
              href={card.href ?? (active ? "/app" : `/app?card=${card.key}`)}
              scroll={card.href ? undefined : false}
              aria-current={active ? "true" : undefined}
              aria-label={`${label}: ${card.count}`}
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
                hot
                  ? card.block === "problem"
                    ? "bg-rose-600 text-white"
                    : "bg-amber-500 text-white"
                  : "bg-zinc-100 text-zinc-500 hover:brightness-95",
                active && "ring-4 ring-zinc-900/70 ring-offset-2",
              )}
              data-action-card={card.key}
              data-board-count={card.count}
            >
              <span className="text-base font-extrabold leading-none tabular-nums">
                {card.count}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      {detail && selected && cards.some((c) => c.key === selected)
        ? detail
        : null}
    </section>
  );
}

/** As sete etapas e, na escolhida, os passos dela. */
export function StageBoard({
  stages,
  t,
  stage,
  group,
  detail = null,
  currency,
  newRequestHref,
}: {
  stages: Stage[];
  t: Translate;
  /** Etapa aberta (?stage=…). */
  stage: string | null;
  /** Passo escolhido (?group=…); a lista dele vem em `detail`. */
  group: string | null;
  detail?: ReactNode;
  currency: string;
  /** "+" no passo da cotação (só quem cria solicitação). */
  newRequestHref: string | null;
}) {
  const open = stages.find((s) => s.key === stage) ?? null;
  return (
    <section
      aria-label={t("tower.stages.title")}
      className="mb-5"
      data-tower-stages
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {t("tower.stages.title")}
        </h2>
        <span className="text-xs text-zinc-500">{t("tower.stages.hint")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {stages.map((s) => {
          const active = s.key === stage;
          const empty = s.count === 0;
          const label = t(`tower.stage.${s.key}` as DictionaryKey);
          return (
            <Link
              key={s.key}
              // Etapa de um passo só abre a lista direto; tocar no aberto fecha.
              href={
                active
                  ? "/app"
                  : `/app?stage=${s.key}${s.single ? `&group=${s.single}` : ""}`
              }
              scroll={false}
              aria-current={active ? "true" : undefined}
              aria-label={`${label}: ${s.count}${
                s.overdue ? ` (${lateLabel(s.overdue, t)})` : ""
              }`}
              className={cx(
                "flex min-h-[6.5rem] flex-col justify-between rounded-xl p-2.5 shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
                empty
                  ? "bg-zinc-200 text-zinc-600 hover:brightness-95"
                  : cx("bg-gradient-to-br text-white", STAGE_TONE[s.key]),
                active && "ring-4 ring-zinc-900/70 ring-offset-2",
              )}
              data-tower-stage={s.key}
              data-stage-count={s.count}
            >
              <span className="block">
                <span className="text-2xl font-extrabold leading-none tabular-nums">
                  {s.count}
                </span>
                {s.overdue > 0 ? (
                  <span
                    className="ml-1.5 inline-block rounded-full bg-red-600 px-2 py-0.5 align-middle text-[11px] font-bold leading-tight text-white"
                    data-stage-late={s.overdue}
                  >
                    {lateLabel(s.overdue, t)}
                  </span>
                ) : null}
                {s.alongside.map((a) => (
                  <span
                    key={a.key}
                    className="mt-1 block text-[11px] font-medium opacity-90"
                  >
                    {t("tower.alongside", {
                      label: t(`tower.group.${a.key}` as DictionaryKey),
                      n: a.count,
                    })}
                  </span>
                ))}
              </span>
              <span className="mt-1.5 text-[12.5px] font-semibold leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {open ? (
        <div
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
          data-tower-groups={open.key}
        >
          {open.groups.map((g) => (
            <GroupTile
              key={g.key}
              g={g}
              t={t}
              stage={open.key}
              tone={STAGE_TONE[open.key]}
              active={g.key === group}
              currency={currency}
              add={
                g.key === "quoting" && newRequestHref
                  ? { href: newRequestHref, label: t("requests.new") }
                  : null
              }
            />
          ))}
        </div>
      ) : null}
      {open && group && open.groups.some((g) => g.key === group)
        ? detail
        : null}
    </section>
  );
}

function GroupTile({
  g,
  t,
  stage,
  tone,
  active,
  currency,
  add,
}: {
  g: StageGroup;
  t: Translate;
  stage: string;
  tone: string;
  active: boolean;
  currency: string;
  add: { href: string; label: string } | null;
}) {
  const empty = g.count === 0;
  const label = t(`tower.group.${g.key}` as DictionaryKey);
  const tile = (
    <Link
      href={`/app?stage=${stage}${active ? "" : `&group=${g.key}`}`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      aria-label={`${label}: ${g.count}${
        g.overdue ? ` (${lateLabel(g.overdue, t)})` : ""
      }`}
      className={cx(
        "flex min-h-[5.25rem] flex-col justify-between rounded-xl border p-2.5 shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
        empty
          ? "border-zinc-200 bg-zinc-50 text-zinc-500"
          : cx("border-transparent bg-gradient-to-br text-white", tone),
        active && "ring-4 ring-zinc-900/70 ring-offset-2",
      )}
      data-tower-group={g.key}
      data-group-count={g.count}
    >
      <span className="block">
        <span className="text-xl font-extrabold leading-none tabular-nums">
          {g.count}
        </span>
        {g.overdue > 0 ? (
          <span className="ml-1.5 inline-block rounded-full bg-red-600 px-2 py-0.5 align-middle text-[11px] font-bold leading-tight text-white">
            {lateLabel(g.overdue, t)}
          </span>
        ) : null}
        {g.value !== null ? (
          <span className="mt-1 block text-[11px] font-medium tabular-nums opacity-90">
            {formatMoney(g.value, currency, t)}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 text-[12.5px] font-semibold leading-tight">
        {label}
        {g.parallel ? (
          <span className="ml-1 text-[11px] font-medium opacity-80">
            ({t("tower.parallel")})
          </span>
        ) : null}
      </span>
    </Link>
  );
  if (!add) return tile;
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
        data-board-add="reqNew"
      >
        +
      </Link>
    </div>
  );
}
