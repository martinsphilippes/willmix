import { LOCALE_NAMES } from "@/i18n";
import { LOCALES, type Locale } from "@/lib/db/schema";
import { setLocaleAction } from "@/app/app/actions";

/**
 * PT / EN / ZH: um toque troca o idioma (Server Action; vale antes e depois
 * do login, guardado em cookie). `dark` para o cabeçalho; claro no painel do
 * celular e na tela de entrada. `full` mostra o nome do idioma (Português,
 * English, 中文) com o ícone do globo, para quem ainda não entrou.
 */
export function LocaleSwitcher({
  locale,
  dark,
  label,
  full = false,
}: {
  locale: Locale;
  dark: boolean;
  label: string;
  full?: boolean;
}) {
  const form = (
    <form
      action={setLocaleAction}
      aria-label={label}
      className={`inline-flex rounded-lg p-0.5 ${dark ? "bg-black/15" : "bg-zinc-100"}`}
      data-locale-switcher={locale}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          type="submit"
          aria-label={LOCALE_NAMES[l]}
          aria-pressed={l === locale}
          lang={l}
          data-locale={l}
          className={`rounded-md font-semibold transition ${
            dark
              ? `px-2 py-0.5 text-xs focus-visible:outline-white ${
                  l === locale
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`
              : `px-3 py-1.5 text-sm ${
                  l === locale
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`
          }`}
        >
          {full ? LOCALE_NAMES[l] : l.toUpperCase()}
        </button>
      ))}
    </form>
  );
  if (!full) return form;
  return (
    <div className="flex items-center gap-2 text-zinc-500">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
      </svg>
      {form}
    </div>
  );
}
