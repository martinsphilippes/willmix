"use client";

import { useMemo, useState } from "react";
import { Alert, Card, cx } from "@/components/ui";
import {
  NO_EXCEPTIONS,
  exceptionsOf,
  inheritedScreens,
  toggleException,
  withExceptions,
  type FunctionScreens,
  type ScreenExceptions,
} from "@/lib/auth/screen-picker";

/** Uma função ativa no card: nome, o que faz e o que libera. */
export interface AccessFunction extends FunctionScreens {
  label: string;
  description: string | null;
}

export interface AccessScreenGroup {
  key: string;
  label: string;
  screens: Array<{ key: string; label: string }>;
}

/*
 * Cards "Funções" e "Telas que o login abre" de Editar acessos (dono,
 * 14/11/2026; docs/ACCESS.md). As caixas de telas reagem na hora às funções
 * marcadas, sem salvar nem recarregar:
 *
 * - Padrão das funções: as caixas mostram o que as funções liberam (só
 *   leitura; a regra é a mesma do servidor, src/lib/auth/screen-picker.ts).
 * - Personalizado: todas as caixas ficam livres, inclusive as do Início. O
 *   que o administrador marca ou desmarca à mão vira exceção e continua
 *   quando as funções mudam; o resto acompanha as funções.
 *
 * O cargo não libera telas: trocar o cargo não muda as caixas.
 */
export function TeamAccessCards({
  functions,
  selected: initialSelected,
  admin,
  custom: initialCustom,
  saved,
  base,
  groups,
  texts,
}: {
  /** Funções ativas, na ordem de Equipe → Funções e acessos. */
  functions: AccessFunction[];
  /** Funções marcadas no cadastro. */
  selected: string[];
  /** Login administrador: abre tudo; o card de telas só avisa. */
  admin: boolean;
  /** O cadastro está no Personalizado. */
  custom: boolean;
  /** Telas que o login abre hoje (vale no Personalizado). */
  saved: string[];
  /** Telas do Início. */
  base: string[];
  groups: AccessScreenGroup[];
  texts: {
    functionsTitle: string;
    screensTitle: string;
    modeHint: string;
    modeDefault: string;
    modeCustom: string;
    baseOnly: string;
    adminNote: string;
  };
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [custom, setCustom] = useState(initialCustom);
  // Exceções do Personalizado: o que a lista gravada tem a mais e a menos
  // que o padrão das funções marcadas no cadastro.
  const [exceptions, setExceptions] = useState<ScreenExceptions>(() =>
    initialCustom
      ? exceptionsOf(saved, inheritedScreens(initialSelected, functions, base))
      : NO_EXCEPTIONS,
  );
  const inherited = useMemo(
    () => inheritedScreens(selected, functions, base),
    [selected, functions, base],
  );
  const checked = custom ? withExceptions(inherited, exceptions) : inherited;
  const summary =
    groups
      .flatMap((g) => g.screens)
      .filter((s) => inherited.has(s.key) && !base.includes(s.key))
      .map((s) => s.label)
      .join(", ") || texts.baseOnly;
  const option = "inline-flex items-start gap-2 text-sm text-zinc-800";

  const toggleFunction = (key: string, on: boolean) =>
    setSelected((current) =>
      on
        ? [...current.filter((k) => k !== key), key]
        : current.filter((k) => k !== key),
    );

  return (
    <>
      <Card title={texts.functionsTitle}>
        <input type="hidden" name="functions.__form" value="1" />
        <div className="grid gap-2 space-y-3 sm:grid-cols-2">
          {functions.map((d) => (
            <label key={d.key} className={option}>
              <input
                type="checkbox"
                name="functions"
                value={d.key}
                checked={selected.includes(d.key)}
                onChange={(e) => toggleFunction(d.key, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                data-team-function={d.key}
              />
              <span>
                <span className="font-medium">{d.label}</span>
                {d.description ? (
                  <span className="block text-xs text-zinc-500">
                    {d.description}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card title={texts.screensTitle}>
        {admin ? (
          <Alert tone="info">{texts.adminNote}</Alert>
        ) : (
          <div data-team-screens-card={custom ? "custom" : "default"}>
            <input type="hidden" name="screens.__form" value="1" />
            {/* As caixas do Início vão no envio: as desmarcadas ficam gravadas. */}
            <input type="hidden" name="screens.__base" value="1" />
            <p className="mb-3 text-xs text-zinc-500">{texts.modeHint}</p>
            <div className="mb-4 flex flex-wrap gap-4">
              <label className={option}>
                <input
                  type="radio"
                  name="screensMode"
                  value="default"
                  checked={!custom}
                  onChange={() => setCustom(false)}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                  data-team-screens-mode="default"
                />
                <span>
                  {texts.modeDefault}
                  <span
                    className="block text-xs text-zinc-500"
                    data-team-screens-summary
                  >
                    {summary}
                  </span>
                </span>
              </label>
              <label className={option}>
                <input
                  type="radio"
                  name="screensMode"
                  value="custom"
                  checked={custom}
                  onChange={() => setCustom(true)}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                  data-team-screens-mode="custom"
                />
                <span>{texts.modeCustom}</span>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <fieldset
                  key={group.key}
                  className="rounded-xl border border-zinc-200/80 p-3"
                >
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {group.label}
                  </legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {group.screens.map((screen) => (
                      <label
                        key={screen.key}
                        className={cx(option, !custom && "text-zinc-600")}
                      >
                        <input
                          type="checkbox"
                          name="screens"
                          value={screen.key}
                          checked={checked.has(screen.key)}
                          disabled={!custom}
                          onChange={(e) =>
                            setExceptions((current) =>
                              toggleException(
                                current,
                                screen.key,
                                e.target.checked,
                                inherited,
                              ),
                            )
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                          data-team-screen={screen.key}
                        />
                        <span>{screen.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
