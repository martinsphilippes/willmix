"use client";

import { useActionState, type ReactNode } from "react";
import { Alert, Card, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  bulkTeamAreasAction,
  bulkTeamPositionsAction,
  type TeamBulkState,
} from "../../actions/team";

/*
 * Cadastro em massa de áreas e de cargos (Equipe Acessos e Parceiros; dono,
 * 16/11/2026): uma linha por nome; entram só os que faltam e o resumo, que o
 * servidor já manda no idioma de quem enviou, mostra os criados, os que já
 * existiam (com a grafia cadastrada), os repetidos e os recusados. A lista
 * da página é atualizada no lugar. `prefix` dá nome aos marcadores
 * (data-area-bulk-*, data-position-bulk-*).
 */

const INITIAL: TeamBulkState = {
  ok: false,
  error: null,
  message: null,
  done: null,
  created: 0,
  existing: 0,
  groups: [],
  text: "",
  doneAt: null,
};

const ACTIONS = {
  area: bulkTeamAreasAction,
  position: bulkTeamPositionsAction,
} as const;

export interface TeamBulkTexts {
  title: string;
  hint: string;
  label: string;
  submit: string;
}

export function TeamBulkForm({
  kind,
  texts,
  children,
}: {
  kind: keyof typeof ACTIONS;
  texts: TeamBulkTexts;
  /** Campos a mais do formulário (a área da lista, nos cargos). */
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState(ACTIONS[kind], INITIAL);
  const mark = (name: string, value: string = "") => ({
    [`data-${kind}-bulk${name ? `-${name}` : ""}`]: value,
  });
  return (
    <Card title={texts.title}>
      <div id={`${kind}-bulk`} className="scroll-mt-24" {...mark("")} />
      <p className="text-xs text-zinc-500">{texts.hint}</p>
      <form action={formAction} className="mt-2 space-y-2">
        {children}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-700">
            {texts.label}
          </span>
          {/* Com erro, o texto colado volta (o formulário é refeito a cada envio). */}
          <Textarea
            key={state.doneAt ?? "new"}
            defaultValue={state.text}
            name="names"
            rows={8}
            required
            maxLength={20000}
            className="font-mono text-sm"
            {...mark("names")}
          />
        </label>
        <SubmitButton variant="secondary" {...mark("submit")}>
          {texts.submit}
        </SubmitButton>
      </form>
      {state.doneAt ? (
        <div
          key={state.doneAt}
          className="mt-3 space-y-2"
          {...mark("result", state.ok ? "ok" : "error")}
        >
          {state.ok ? (
            <>
              <Alert tone="success">
                <span {...mark("done")}>{state.done}</span>
              </Alert>
              {state.groups.map((g) => (
                <div key={g.kind} {...mark("group", g.kind)}>
                  <p className="text-xs font-semibold text-zinc-700">
                    {g.title}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {g.items.map((item, i) => (
                      <li
                        key={`${i}:${item}`}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800"
                        {...mark("item", g.kind)}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <Alert tone="danger">
              <span {...mark("error", state.error ?? "")}>{state.message}</span>
            </Alert>
          )}
        </div>
      ) : null}
    </Card>
  );
}
