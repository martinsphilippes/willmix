import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import type { Translate } from "@/i18n";
import { PageHelp, type HelpSpec } from "./page-help";

/*
 * Kit de componentes com a identidade Wellmix. Tailwind 4, sem dependências.
 *
 * Regras da marca (ver docs/ARQUITETURA.md, "Identidade visual"):
 * - vermelho da marca (brand-600) = ação principal, item ativo, seleção, progresso;
 * - cinzas (zinc) = estrutura e texto;
 * - verde/âmbar/vermelho-rosado = estados (sucesso, atenção, erro), sempre com texto;
 * - ação destrutiva usa contorno vermelho, nunca o mesmo botão cheio da ação principal.
 */

/**
 * Junta classes e resolve conflitos do Tailwind: a classe de quem usa o componente
 * vence a do kit (ex.: <Td className="text-red-700"> troca a cor padrão da célula).
 */
export function cx(...classes: Array<string | false | null | undefined>) {
  return twMerge(...classes);
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60";
const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-zinc-50",
  danger:
    "border border-red-300 bg-white text-red-700 hover:border-red-400 hover:bg-red-50",
  ghost: "text-zinc-700 hover:bg-zinc-100",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(buttonBase, buttonStyles[variant], className)}
    />
  );
}

export function LinkButton({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      {...props}
      className={cx(buttonBase, buttonStyles[variant], className)}
    />
  );
}

/** Link de texto na cor da marca (navegação dentro de tabelas, cards e listas). */
export const linkClass =
  "font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-600";

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={cx(linkClass, className)} />;
}

export function Card({
  className,
  title,
  actions,
  children,
}: {
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-5",
        className,
      )}
    >
      {title || actions ? (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  help,
  t,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Painel "Como funciona / O que fazer aqui" exibido logo abaixo do título. */
  help?: HelpSpec;
  t?: Translate;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="border-l-4 border-brand-600 pl-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {help && t ? <PageHelp t={t} help={help} /> : null}
    </>
  );
}

export type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";
const badgeStyles: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        badgeStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea {...props} className={cx(inputClass, "min-h-24", className)} />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, className)} />;
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "-mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border",
        className,
      )}
    >
      <table className="w-full min-w-[32rem] text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cx(
        "border-b border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cx(
        "border-b border-zinc-100 px-3 py-2.5 align-top text-zinc-800",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Linha de tabela com realce ao passar o mouse. */
export const rowClass = "transition hover:bg-brand-50/40";

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white/60 px-4 py-8 text-center text-sm text-zinc-500">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-8 w-8 text-zinc-300"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M3 13h5l1.5 3h5L16 13h5M5 6h14l2 7v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2-7Z" />
      </svg>
      {children}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const styles: Record<Tone, string> = {
    neutral: "border-zinc-300 bg-zinc-50 text-zinc-800",
    info: "border-sky-400 bg-sky-50 text-sky-900",
    success: "border-emerald-500 bg-emerald-50 text-emerald-900",
    warning: "border-amber-500 bg-amber-50 text-amber-900",
    danger: "border-red-500 bg-red-50 text-red-900",
    brand: "border-brand-600 bg-brand-50 text-brand-900",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cx(
        "rounded-lg border-l-4 px-4 py-3 text-sm shadow-sm",
        styles[tone],
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  href,
  tone = "neutral",
  active = false,
}: {
  label: ReactNode;
  value: ReactNode;
  href?: string;
  tone?: Tone;
  /** Card selecionado (ex.: filtro atual da Control Tower). */
  active?: boolean;
}) {
  const content = (
    <div
      className={cx(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition",
        href && "hover:-translate-y-0.5 hover:shadow-md",
        active
          ? "border-brand-600 ring-2 ring-brand-600"
          : tone === "danger"
            ? "border-red-200 bg-red-50/60"
            : tone === "warning"
              ? "border-amber-200 bg-amber-50/60"
              : "border-zinc-200/80",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute inset-x-0 top-0 h-1",
          active
            ? "bg-brand-600"
            : tone === "danger"
              ? "bg-red-500"
              : tone === "warning"
                ? "bg-amber-400"
                : "bg-transparent",
        )}
      />
      <div
        className={cx(
          "text-xs font-semibold uppercase tracking-wide",
          active ? "text-brand-700" : "text-zinc-500",
        )}
      >
        {label}
      </div>
      <div className="mt-auto break-words pt-1.5 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
        {value}
      </div>
    </div>
  );
  return href ? (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className="block h-full rounded-2xl"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

export function Progress({ percent }: { percent: number }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/80"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}%`}
    >
      <div
        className={cx(
          "h-full rounded-full transition-all",
          value >= 100 ? "bg-emerald-500" : "bg-brand-600",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export type StepState = "done" | "active" | "blocked" | "pending";

/**
 * Tom do selo de etapa, igual em todas as telas: concluída verde, em andamento
 * vermelho da marca, bloqueada âmbar (com o texto "Bloqueada"), não iniciada cinza.
 * Vermelho de erro fica para o que está errado (atraso, reprovação), não para bloqueio.
 */
export function stageTone(state: StepState): Tone {
  return state === "done"
    ? "success"
    : state === "blocked"
      ? "warning"
      : state === "active"
        ? "brand"
        : "neutral";
}

/** Marcador de etapa da linha do tempo (pedido, solicitação). */
export function StepDot({
  state,
  children,
}: {
  state: StepState;
  children?: ReactNode;
}) {
  const styles: Record<StepState, string> = {
    done: "bg-emerald-600 text-white",
    active: "bg-brand-600 text-white ring-4 ring-brand-100",
    blocked: "bg-amber-500 text-white ring-4 ring-amber-100",
    pending: "bg-zinc-200 text-zinc-500",
  };
  return (
    <span
      className={cx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        styles[state],
      )}
    >
      {state === "done" ? "✓" : state === "blocked" ? "!" : children}
    </span>
  );
}

export function DescriptionList({
  items,
}: {
  items: Array<[ReactNode, ReactNode]>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([label, value], i) => (
        <div key={i} className="flex flex-col">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {label}
          </dt>
          <dd className="mt-0.5 text-zinc-900">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function formatDate(value: string | null | undefined, locale = "pt-BR") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
) {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency ?? "BRL",
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount.toFixed(2)}`;
  }
}

/** Prazo vencido? (função pura do ponto de vista do componente: o instante é lido aqui, fora do render.) */
export function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  const due = Date.parse(value);
  return !Number.isNaN(due) && due < Date.now();
}
