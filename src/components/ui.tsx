import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Translate } from "@/i18n";
import { PageHelp, type HelpSpec } from "./page-help";

/* Kit mínimo de componentes. Tailwind 4, sem dependências. */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-sky-700 text-white hover:bg-sky-600 disabled:bg-zinc-400",
  secondary: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
  danger: "bg-red-600 text-white hover:bg-red-500",
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
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        buttonStyles[variant],
        className,
      )}
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
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
        buttonStyles[variant],
        className,
      )}
    />
  );
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
        "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {title || actions ? (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {help && t ? <PageHelp t={t} help={help} /> : null}
    </>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const badgeStyles: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
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

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200";

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
    <div className={cx("-mx-4 overflow-x-auto sm:mx-0", className)}>
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
        "border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500",
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
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cx(
        "border-b border-zinc-100 px-3 py-2 align-top text-zinc-800",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
      {children}
    </p>
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
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-800",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={cx("rounded-md border px-4 py-3 text-sm", styles[tone])}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  href?: string;
  tone?: Tone;
}) {
  const content = (
    <div
      className={cx(
        "rounded-xl border p-4 transition",
        href && "hover:shadow-md",
        tone === "danger"
          ? "border-red-200 bg-red-50"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50"
            : "border-zinc-200 bg-white",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function Progress({ percent }: { percent: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"
      aria-label={`${percent}%`}
    >
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function DescriptionList({
  items,
}: {
  items: Array<[ReactNode, ReactNode]>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([label, value], i) => (
        <div key={i} className="flex flex-col">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {label}
          </dt>
          <dd className="text-zinc-900">{value ?? "—"}</dd>
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
