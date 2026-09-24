import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";

export interface HelpSpec {
  /** Chave do parágrafo "Como funciona". */
  body: DictionaryKey;
  /** Chave da lista "O que fazer aqui" (linhas separadas por \n). */
  steps?: DictionaryKey;
  /** Título alternativo da lista. */
  stepsTitle?: DictionaryKey;
}

/**
 * Painel de ajuda contextual. Toda tela explica a lógica e o próximo passo,
 * no idioma do usuário. Recolhível para quem já conhece o fluxo.
 */
export function PageHelp({ t, help }: { t: Translate; help: HelpSpec }) {
  const steps = help.steps ? t(help.steps).split("\n").filter(Boolean) : [];
  return (
    <details
      open
      className="group mb-6 overflow-hidden rounded-2xl border border-zinc-200/80 border-l-4 border-l-brand-600 bg-white text-sm text-zinc-700 shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
        >
          i
        </span>
        {t("help.how")}
        <span
          aria-hidden
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-base font-normal text-zinc-500 transition group-open:rotate-45 group-hover:bg-zinc-100"
        >
          +
        </span>
      </summary>
      <div className="grid gap-5 border-t border-zinc-100 bg-zinc-50/60 px-4 py-4 lg:grid-cols-2">
        <p className="leading-relaxed">{t(help.body)}</p>
        {steps.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
              {t(help.stepsTitle ?? "help.todo")}
            </p>
            <ol className="space-y-1.5 leading-relaxed">
              {steps.map((line, i) => {
                const [label, ...rest] = line.split(":");
                return (
                  <li key={i} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 ring-1 ring-inset ring-brand-200"
                    >
                      {i + 1}
                    </span>
                    <span>
                      {rest.length ? (
                        <>
                          <strong className="text-zinc-900">{label}:</strong>
                          {rest.join(":")}
                        </>
                      ) : (
                        line
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </details>
  );
}
