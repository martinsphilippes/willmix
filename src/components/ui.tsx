import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cloneElement, isValidElement, useId } from "react";
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
  dense,
  children,
}: {
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
  /** Formulário denso: menos espaço interno e título menor. */
  dense?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]",
        dense ? "p-3 sm:p-4" : "p-4 sm:p-5",
        className,
      )}
    >
      {title || actions ? (
        <header
          className={cx(
            "flex flex-wrap items-center justify-between gap-2",
            dense ? "mb-3" : "mb-4",
          )}
        >
          {title ? (
            <h2
              className={cx(
                "font-semibold tracking-tight text-zinc-900",
                dense ? "text-sm" : "text-base",
              )}
            >
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
  "neutral" | "info" | "success" | "warning" | "danger" | "brand";
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
  const generatedId = useId();
  /*
   * Campo de arquivo não fica dentro do <label>: no Safari (iPhone/iPad) o toque
   * no botão dentro do rótulo abre o seletor duas vezes e, depois de cancelar,
   * o campo para de responder. O rótulo aponta para o campo (htmlFor).
   */
  if (
    isValidElement<{ type?: string; id?: string }>(children) &&
    children.props.type === "file"
  ) {
    const id = children.props.id ?? `file-${generatedId}`;
    return (
      <div className="block min-w-0 space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
          {label}
        </label>
        {cloneElement(children, { id })}
        {hint ? (
          <span className="block text-xs text-zinc-500">{hint}</span>
        ) : null}
      </div>
    );
  }
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "block w-full min-w-0 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100";

/** Campo compacto (formulários densos, ex.: ficha de compra): mais baixo e com letra menor. */
export const inputDenseClass =
  "block min-h-8 w-full min-w-0 max-w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[13px] leading-5 text-zinc-900 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

const LABELABLE = new Set([
  "input",
  "select",
  "textarea",
  "button",
  "meter",
  "output",
  "progress",
]);

/** Larguras dos campos compactos (no celular ocupam a linha toda). */
export const fieldRowWidth = {
  xs: "sm:w-24",
  sm: "sm:w-36",
  md: "sm:w-56",
  lg: "sm:w-80",
  full: "sm:w-full",
} as const;

/**
 * Campo em linha para formulários densos: rótulo à esquerda (largura fixa),
 * campo à direita com largura por tamanho, dica ao lado. Um campo abaixo do
 * outro, sem caixas gigantes. No celular, rótulo em cima do campo.
 */
export function FieldRow({
  label,
  hint,
  required,
  size = "md",
  requiredTitle,
  anchor,
  missing,
  missingText,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  size?: keyof typeof fieldRowWidth;
  /** Texto do asterisco de obrigatório (acessibilidade). */
  requiredTitle?: string;
  /** Chave(s) do campo, separadas por espaço: o aviso "faltam" leva até aqui. */
  anchor?: string;
  /** Campo obrigatório ainda vazio: rótulo e caixa em vermelho. */
  missing?: boolean;
  /** Texto ao lado do campo vazio (ex.: "Preencha este campo"). */
  missingText?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  // Um controle só: rótulo ligado por htmlFor (vale para arquivo também, pois o
  // campo não fica dentro do <label>). Vários controles: grupo com nome.
  // Componente (repassa o id) ou elemento rotulável; um <div> com vários
  // controles vira grupo com nome.
  const single =
    isValidElement<{ id?: string }>(children) &&
    (typeof children.type !== "string" || LABELABLE.has(children.type));
  const id =
    single && isValidElement<{ id?: string }>(children)
      ? (children.props.id ?? `f-${generatedId}`)
      : undefined;
  const groupLabelId = `fl-${generatedId}`;
  const text = (
    <>
      {label}
      {required ? (
        <span
          className="ml-0.5 font-semibold text-brand-600"
          title={requiredTitle}
        >
          <span aria-hidden>*</span>
          {requiredTitle ? (
            <span className="sr-only">({requiredTitle})</span>
          ) : null}
        </span>
      ) : null}
    </>
  );
  const labelClass = cx(
    "block text-xs font-medium leading-5 sm:pt-1.5",
    missing ? "text-red-700" : "text-zinc-700",
  );
  return (
    <div
      className="grid min-w-0 scroll-mt-24 grid-cols-1 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-3"
      data-field-anchor={anchor}
      data-missing={missing ? "true" : undefined}
    >
      {single ? (
        <label htmlFor={id} className={labelClass}>
          {text}
        </label>
      ) : (
        <span id={groupLabelId} className={labelClass}>
          {text}
        </span>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <div
          className={cx(
            "w-full min-w-0",
            fieldRowWidth[size],
            missing && "rounded-md ring-2 ring-red-400 ring-offset-1",
          )}
          role={single ? undefined : "group"}
          aria-labelledby={single ? undefined : groupLabelId}
        >
          {single && isValidElement<{ id?: string }>(children)
            ? cloneElement(children, { id })
            : children}
        </div>
        {missing && missingText ? (
          <span className="text-xs font-medium leading-5 text-red-700">
            {missingText}
          </span>
        ) : null}
        {hint ? (
          <span className="text-xs leading-5 text-zinc-500">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

/** `dense`: campo compacto (formulários densos), em vez do campo padrão. */
export function Input({
  className,
  dense,
  ...props
}: ComponentProps<"input"> & { dense?: boolean }) {
  return (
    <input
      {...props}
      className={cx(dense ? inputDenseClass : inputClass, className)}
    />
  );
}

export function Textarea({
  className,
  dense,
  ...props
}: ComponentProps<"textarea"> & { dense?: boolean }) {
  return (
    <textarea
      {...props}
      className={cx(
        dense ? inputDenseClass : inputClass,
        dense ? "min-h-16" : "min-h-24",
        className,
      )}
    />
  );
}

export function Select({
  className,
  dense,
  ...props
}: ComponentProps<"select"> & { dense?: boolean }) {
  return (
    <select
      {...props}
      className={cx(dense ? inputDenseClass : inputClass, className)}
    />
  );
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

export function Progress({
  percent,
  tone,
}: {
  percent: number;
  /** "danger": 100% ou mais é problema (ex.: container acima da capacidade), não conclusão. */
  tone?: "danger";
}) {
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
          value >= 100
            ? tone === "danger"
              ? "bg-red-500"
              : "bg-emerald-500"
            : tone === "danger" && value > 90
              ? "bg-amber-500"
              : "bg-brand-600",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export type StepState = "done" | "active" | "blocked" | "pending" | "cancelled";

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
    cancelled: "bg-zinc-300 text-zinc-600 line-through",
  };
  return (
    <span
      className={cx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        styles[state],
      )}
    >
      {state === "done"
        ? "✓"
        : state === "blocked"
          ? "!"
          : state === "cancelled"
            ? "×"
            : children}
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

/** Tag Intl a partir de t (idioma do usuário) ou de uma tag direta; sem nada, pt-BR. */
export function intlOf(locale?: string | { intl: string } | null) {
  if (!locale) return "pt-BR";
  return typeof locale === "string" ? locale : locale.intl;
}

export function formatDate(
  value: string | null | undefined,
  locale?: string | { intl: string } | null,
) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(intlOf(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale?: string | { intl: string } | null,
) {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(intlOf(locale), {
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
