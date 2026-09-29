import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { SourcingStatus, VisitStatus } from "@/lib/db";
import { cx, type Tone } from "@/components/ui";

/*
 * Peças compartilhadas do módulo Sourcing (uso no celular, na fábrica ou na feira):
 * campos grandes, seções recolhíveis, barra de salvar ao alcance do polegar e
 * miniatura da foto principal servida por /api/files/<documentId>.
 */

/** Campo maior no celular (py-2.5, 16 px para o iOS não dar zoom); tamanho padrão no desktop. */
export const bigField = "py-2.5 text-base sm:text-sm";

export function sourcingTone(status: SourcingStatus): Tone {
  switch (status) {
    case "negotiating":
      return "brand";
    case "approved":
    case "promoted":
      return "success";
    default:
      return "neutral";
  }
}

export function visitTone(status: VisitStatus): Tone {
  return status === "done" ? "success" : "brand";
}

/** Mensagem de erro vinda de ?error=: traduzida quando o código é do módulo; senão a genérica com o código. */
export function errorMessage(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const key = `sourcing.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? `${t("common.error")} (${code})` : text;
}

/** Miniatura da foto principal (ou marcador quando não há foto). */
export function Thumb({
  documentId,
  alt,
  className,
}: {
  documentId: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const base =
    "shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100";
  if (!documentId) {
    return (
      <span
        aria-label={alt}
        className={cx(
          base,
          "flex items-center justify-center text-lg text-zinc-400",
          className,
        )}
      >
        <span aria-hidden>📷</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
    <img
      src={`/api/files/${documentId}`}
      alt={alt}
      loading="lazy"
      className={cx(base, "object-cover", className)}
    />
  );
}

/** Seção recolhível do formulário (<details>): a primeira abre por padrão. */
export function Section({
  title,
  open = false,
  children,
  className,
}: {
  title: ReactNode;
  open?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      open={open}
      className="group rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        {title}
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base font-normal text-zinc-500 transition group-open:rotate-45 group-hover:bg-zinc-100"
        >
          +
        </span>
      </summary>
      <div
        className={cx(
          "grid gap-3 border-t border-zinc-100 px-4 py-4 sm:grid-cols-2",
          className,
        )}
      >
        {children}
      </div>
    </details>
  );
}

/** Barra com o botão principal: fixa no fim da tela no celular, normal no desktop. */
export function SaveBar({
  hint,
  children,
}: {
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-zinc-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-2">
      {hint ? <p className="mb-2 text-xs text-zinc-500">{hint}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {children}
      </div>
    </div>
  );
}

/** Número com até 3 casas, sem zeros à direita. */
export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    value,
  );
}

/** Data ISO → valor de <input type="date">. */
export function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

/** Hoje em AAAA-MM-DD (padrão dos campos de data no celular). */
export function todayValue() {
  return new Date().toISOString().slice(0, 10);
}
