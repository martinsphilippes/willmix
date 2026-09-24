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
      className="group mb-6 rounded-xl border border-sky-200 bg-sky-50 text-sm text-sky-950"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-semibold">
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-xs text-white"
        >
          i
        </span>
        {t("help.how")}
        <span className="ml-auto text-xs font-normal text-sky-700 group-open:hidden">
          +
        </span>
        <span className="ml-auto hidden text-xs font-normal text-sky-700 group-open:inline">
          −
        </span>
      </summary>
      <div className="grid gap-4 border-t border-sky-200 px-4 py-3 lg:grid-cols-2">
        <p className="leading-relaxed">{t(help.body)}</p>
        {steps.length > 0 ? (
          <div>
            <p className="mb-1 font-semibold">
              {t(help.stepsTitle ?? "help.todo")}
            </p>
            <ol className="list-decimal space-y-1 pl-5 leading-relaxed">
              {steps.map((line, i) => {
                const [label, ...rest] = line.split(":");
                return (
                  <li key={i}>
                    {rest.length ? (
                      <>
                        <strong>{label}:</strong>
                        {rest.join(":")}
                      </>
                    ) : (
                      line
                    )}
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
