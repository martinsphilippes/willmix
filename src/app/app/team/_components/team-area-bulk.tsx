"use client";

import { useActionState } from "react";
import { Alert, Card, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { bulkTeamAreasAction, type AreaBulkState } from "../../actions/team";

/*
 * Cadastro em massa das áreas (Equipe Acessos e Parceiros → Áreas; dono,
 * 16/11/2026): uma área por linha; entram só as que faltam e o resumo mostra
 * as criadas, as que já existiam (com a grafia cadastrada), as repetidas na
 * lista e as recusadas. A lista da página é atualizada no lugar.
 */

const INITIAL: AreaBulkState = {
  ok: false,
  error: null,
  message: null,
  created: [],
  existing: [],
  repeated: [],
  invalid: [],
  text: "",
  doneAt: null,
};

export interface AreaBulkTexts {
  title: string;
  hint: string;
  label: string;
  submit: string;
  done: string;
  created: string;
  existing: string;
  as: string;
  inactive: string;
  repeated: string;
  invalid: string;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );

function Group({
  title,
  items,
  kind,
}: {
  title: string;
  items: string[];
  kind: string;
}) {
  if (!items.length) return null;
  return (
    <div data-area-bulk-group={kind}>
      <p className="text-xs font-semibold text-zinc-700">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <li
            key={`${i}:${item}`}
            className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800"
            data-area-bulk-item={kind}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamAreaBulk({ texts }: { texts: AreaBulkTexts }) {
  const [state, formAction] = useActionState(bulkTeamAreasAction, INITIAL);
  const existing = state.existing.map((e) => {
    const parts = [e.asked];
    if (e.name !== e.asked) parts.push(`(${fill(texts.as, { name: e.name })})`);
    if (!e.active) parts.push(texts.inactive);
    return parts.join(" ");
  });
  return (
    <Card title={texts.title}>
      <div id="area-bulk" className="scroll-mt-24" data-area-bulk />
      <p className="text-xs text-zinc-500">{texts.hint}</p>
      <form action={formAction} className="mt-2 space-y-2">
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
            data-area-bulk-names
          />
        </label>
        <SubmitButton variant="secondary" data-area-bulk-submit>
          {texts.submit}
        </SubmitButton>
      </form>
      {state.doneAt ? (
        <div
          key={state.doneAt}
          className="mt-3 space-y-2"
          data-area-bulk-result={state.ok ? "ok" : "error"}
        >
          {state.ok ? (
            <>
              <Alert tone="success">
                <span data-area-bulk-done>
                  {fill(texts.done, {
                    created: state.created.length,
                    existing: state.existing.length,
                  })}
                </span>
              </Alert>
              <Group
                kind="created"
                title={fill(texts.created, { n: state.created.length })}
                items={state.created}
              />
              <Group
                kind="existing"
                title={fill(texts.existing, { n: state.existing.length })}
                items={existing}
              />
              <Group
                kind="repeated"
                title={fill(texts.repeated, { n: state.repeated.length })}
                items={state.repeated}
              />
              <Group
                kind="invalid"
                title={fill(texts.invalid, { n: state.invalid.length })}
                items={state.invalid}
              />
            </>
          ) : (
            <Alert tone="danger">
              <span data-area-bulk-error={state.error ?? ""}>
                {state.message}
              </span>
            </Alert>
          )}
        </div>
      ) : null}
    </Card>
  );
}
