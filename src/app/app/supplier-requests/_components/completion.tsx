import type { Translate } from "@/i18n";
import type { Completion } from "@/lib/inquiry-completion";
import { Td } from "@/components/ui";

/*
 * Coluna "Completude" da lista de Consultas (dono, 27/11/2026): o percentual
 * do que a linha já resolveu, com a barra fina e as etapas na dica.
 */
export function CompletionTd({ c, t }: { c: Completion; t: Translate }) {
  const tone =
    c.percent >= 100
      ? "bg-emerald-500"
      : c.percent >= 50
        ? "bg-brand-500"
        : "bg-amber-500";
  return (
    <Td className="whitespace-nowrap" data-inquiry-completion={c.percent}>
      <span
        className="flex min-w-16 flex-col gap-1"
        title={t("inquiries.completion.hint", { done: c.done, total: c.total })}
      >
        <span className="text-right text-xs font-semibold tabular-nums text-zinc-800">
          {c.percent}%
        </span>
        <span
          aria-hidden
          className="block h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
        >
          <span
            className={`block h-full rounded-full ${tone}`}
            style={{ width: `${c.percent}%` }}
          />
        </span>
      </span>
    </Td>
  );
}
