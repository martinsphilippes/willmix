import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { BoardCard } from "@/lib/services/tower-board";
import type { Stage, StageGroup } from "@/lib/tower-stages";
import { cx, formatMoney } from "./ui";

/*
 * Control Tower por etapa.
 *
 * - Processo por etapa: nove cards em três linhas de três, todos da mesma
 *   altura. A cor da borda de cima é o avanço no processo (uma cor base por
 *   linha, em degradê: índigo → azul-céu → esmeralda). Dentro do card a cor
 *   é só de alerta: vermelho com o prazo (SLA) estourado, âmbar com o prazo
 *   vencendo. Zero continua à vista, em cinza.
 * - Tocar num card abre os passos dele logo abaixo da linha dele (e a lista do
 *   passo escolhido logo abaixo dos passos); tocar de novo fecha.
 * - Precisa de ação agora: só os pontos de ação que têm algo para o usuário
 *   logado (os de zero ficam ocultos).
 */

/** Borda de cima de cada linha: avanço no processo (as cores de alerta ficam livres). */
const ROW_TONE = [
  "from-indigo-700 via-indigo-500 to-indigo-300",
  "from-sky-700 via-sky-500 to-sky-300",
  "from-emerald-700 via-emerald-500 to-emerald-300",
] as const;
const COLUMNS = 3;

const lateLabel = (n: number, t: Translate) =>
  n === 1 ? t("board.late.one") : t("board.late.many", { n });
const riskLabel = (n: number, t: Translate) =>
  n === 1 ? t("tower.risk.one") : t("tower.risk.many", { n });

/** Alerta do card: o vermelho (SLA estourado) vale mais que o âmbar (vencendo). */
function alertOf(overdue: number, risk: number) {
  return overdue > 0 ? "danger" : risk > 0 ? "warning" : null;
}

function AlertBadges({
  overdue,
  risk,
  t,
}: {
  overdue: number;
  risk: number;
  t: Translate;
}) {
  return (
    <>
      {overdue > 0 ? (
        <span
          className="inline-block rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold leading-tight text-white"
          data-alert="late"
        >
          {lateLabel(overdue, t)}
        </span>
      ) : null}
      {risk > 0 ? (
        <span
          className="inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold leading-tight text-white"
          data-alert="risk"
        >
          {riskLabel(risk, t)}
        </span>
      ) : null}
    </>
  );
}

/** "Precisa de ação agora": só o que tem ação para o usuário logado. */
export function ActionList({
  cards,
  t,
  selected,
}: {
  /** Pontos de ação do perfil (os de zero são escondidos aqui). */
  cards: BoardCard[];
  t: Translate;
  /** Quadrado escolhido (?card=…). */
  selected: string | null;
}) {
  const shown = cards.filter((c) => c.count > 0);
  return (
    <section
      aria-label={t("tower.action.title")}
      className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm"
      data-tower-actions={shown.length}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {t("tower.action.title")}
      </h2>
      <p className="mb-2 text-xs text-zinc-500">{t("tower.action.hint")}</p>
      {shown.length === 0 ? (
        <p
          className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500"
          data-action-empty
        >
          {t("tower.action.empty")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((card) => {
            const label = t(`board.card.${card.key}` as DictionaryKey);
            const active = selected === card.key;
            return (
              <li key={card.key}>
                <Link
                  href={
                    card.href ?? (active ? "/app" : `/app?card=${card.key}`)
                  }
                  scroll={card.href ? undefined : false}
                  aria-current={active ? "true" : undefined}
                  aria-label={`${label}: ${card.count}`}
                  className={cx(
                    "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
                    card.block === "problem" ? "bg-rose-600" : "bg-amber-500",
                    active && "ring-4 ring-zinc-900/70 ring-offset-2",
                  )}
                  data-action-card={card.key}
                  data-board-count={card.count}
                >
                  <span className="leading-tight">{label}</span>
                  <span className="text-base font-extrabold tabular-nums">
                    {card.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Processo por etapa: três linhas de três cards. Os passos da etapa aberta e a
 * lista do passo escolhido entram logo abaixo da linha do card tocado.
 */
export function ProcessBoard({
  stages,
  t,
  stage,
  group,
  detail = null,
  currency,
}: {
  stages: Stage[];
  t: Translate;
  /** Etapa aberta (?stage=…). */
  stage: string | null;
  /** Passo escolhido (?group=…); a lista dele vem em `detail`. */
  group: string | null;
  detail?: ReactNode;
  currency: string;
}) {
  const rows: Stage[][] = [];
  for (let i = 0; i < stages.length; i += COLUMNS)
    rows.push(stages.slice(i, i + COLUMNS));
  return (
    <section aria-label={t("tower.stages.title")} data-tower-stages>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {t("tower.stages.title")}
        </h2>
        <span className="text-xs text-zinc-500">{t("tower.stages.hint")}</span>
      </div>
      <div className="space-y-3">
        {rows.map((row, rowIndex) => {
          const tone = ROW_TONE[Math.min(rowIndex, ROW_TONE.length - 1)];
          const open = row.find((s) => s.key === stage) ?? null;
          return (
            <div key={rowIndex} data-tower-row={rowIndex}>
              <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-3">
                {row.map((s) => (
                  <StageCard
                    key={s.key}
                    s={s}
                    t={t}
                    tone={tone}
                    active={s.key === stage}
                  />
                ))}
              </div>
              {open ? (
                <div
                  className="mt-3 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/70 shadow-sm"
                  data-tower-groups={open.key}
                >
                  <span
                    aria-hidden
                    className={cx("block h-1 bg-gradient-to-r", tone)}
                  />
                  <div className="p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      {t(`tower.stage.${open.key}` as DictionaryKey)}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {open.groups.map((g) => (
                        <GroupCard
                          key={g.key}
                          g={g}
                          t={t}
                          stage={open.key}
                          active={g.key === group}
                          currency={currency}
                        />
                      ))}
                    </div>
                    {group && open.groups.some((g) => g.key === group)
                      ? detail
                      : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StageCard({
  s,
  t,
  tone,
  active,
}: {
  s: Stage;
  t: Translate;
  tone: string;
  active: boolean;
}) {
  const label = t(`tower.stage.${s.key}` as DictionaryKey);
  const alert = alertOf(s.overdue, s.risk);
  return (
    <Link
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
      }${s.risk ? ` (${riskLabel(s.risk, t)})` : ""}`}
      className={cx(
        "flex min-h-[8.5rem] flex-col overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
        alert === "danger"
          ? "border-red-300 bg-red-50"
          : alert === "warning"
            ? "border-amber-300 bg-amber-50"
            : "border-zinc-200/80 bg-white",
        active && "ring-4 ring-zinc-900/70 ring-offset-2",
      )}
      data-tower-stage={s.key}
      data-stage-count={s.count}
    >
      <span
        aria-hidden
        className={cx("block h-1.5 w-full bg-gradient-to-r", tone)}
      />
      <span className="flex flex-1 flex-col justify-between gap-2 p-3">
        <span className="block">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cx(
                "text-3xl font-extrabold leading-none tabular-nums",
                s.count === 0
                  ? "text-zinc-300"
                  : alert === "danger"
                    ? "text-red-700"
                    : alert === "warning"
                      ? "text-amber-700"
                      : "text-zinc-900",
              )}
            >
              {s.count}
            </span>
            <AlertBadges overdue={s.overdue} risk={s.risk} t={t} />
          </span>
          {s.alongside.map((a) => (
            <span
              key={a.key}
              className="mt-1 block text-[11px] font-medium text-zinc-500"
            >
              {t("tower.alongside", {
                label: t(`board.card.${a.key}` as DictionaryKey),
                n: a.count,
              })}
            </span>
          ))}
        </span>
        <span className="text-[13px] font-semibold leading-tight text-zinc-800">
          {label}
        </span>
      </span>
    </Link>
  );
}

function GroupCard({
  g,
  t,
  stage,
  active,
  currency,
}: {
  g: StageGroup;
  t: Translate;
  stage: string;
  active: boolean;
  currency: string;
}) {
  const label = t(`board.card.${g.key}` as DictionaryKey);
  const alert = alertOf(g.overdue, g.risk);
  return (
    <Link
      href={`/app?stage=${stage}${active ? "" : `&group=${g.key}`}`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      aria-label={`${label}: ${g.count}${
        g.overdue ? ` (${lateLabel(g.overdue, t)})` : ""
      }${g.risk ? ` (${riskLabel(g.risk, t)})` : ""}`}
      className={cx(
        "flex min-h-[5rem] flex-col justify-between rounded-lg border p-2.5 shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900",
        alert === "danger"
          ? "border-red-300 bg-red-50"
          : alert === "warning"
            ? "border-amber-300 bg-amber-50"
            : "border-zinc-200/80 bg-white",
        active && "ring-4 ring-zinc-900/70 ring-offset-2",
      )}
      data-tower-group={g.key}
      data-group-count={g.count}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <span
          className={cx(
            "text-xl font-extrabold leading-none tabular-nums",
            g.count === 0
              ? "text-zinc-300"
              : alert === "danger"
                ? "text-red-700"
                : alert === "warning"
                  ? "text-amber-700"
                  : "text-zinc-900",
          )}
        >
          {g.count}
        </span>
        <AlertBadges overdue={g.overdue} risk={g.risk} t={t} />
        {g.value !== null ? (
          <span className="text-[11px] font-medium tabular-nums text-zinc-500">
            {formatMoney(g.value, currency, t)}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 text-[12.5px] font-semibold leading-tight text-zinc-800">
        {label}
        {g.parallel ? (
          <span className="ml-1 text-[11px] font-medium text-zinc-500">
            ({t("tower.parallel")})
          </span>
        ) : null}
      </span>
    </Link>
  );
}
