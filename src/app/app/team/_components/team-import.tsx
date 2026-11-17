"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import { Alert, Badge, Button, Card, Textarea, cx } from "@/components/ui";
import { teamImportAction, type TeamImportState } from "../../actions/team";

/*
 * Importar equipe (Equipe → "Importar da planilha"; dono, 16/11/2026): cola
 * a planilha (Nome, Cargo, Área, Email), "Conferir" mostra o que cada linha
 * vira (cargo, área, funções, nível e o que fica "a conferir") sem gravar, e
 * "Criar os logins" cria em lotes com a senha provisória igual para todos (a
 * pessoa troca no primeiro acesso). O texto e a senha ficam na tela entre um
 * clique e outro (o formulário não é refeito).
 */

const INITIAL: TeamImportState = {
  ok: false,
  error: null,
  message: null,
  intent: null,
  header: null,
  rows: [],
  invalid: [],
  repeated: [],
  pending: [],
  result: null,
  doneAt: null,
};

export interface TeamImportTexts {
  title: string;
  hint: string;
  rows: string;
  password: string;
  passwordHint: string;
  preview: string;
  run: string;
  working: string;
  colLine: string;
  colName: string;
  colEmail: string;
  colPosition: string;
  colArea: string;
  colFunctions: string;
  colLevel: string;
  colStatus: string;
  colReview: string;
  unknownPosition: string;
  none: string;
  previewDone: string;
  runDone: string;
  remaining: string;
  failed: string;
  invalidName: string;
  invalidEmail: string;
  repeated: string;
  header: string;
  status: Record<string, string>;
  skipped: Record<string, string>;
  review: string;
  noReview: string;
  /** Funções de quem já tem login: a importação não muda. */
  keep: string;
  pendingTitle: string;
  pendingHint: string;
  pendingAlready: string;
  pendingDone: string;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );

export function TeamImport({
  texts,
  functionLabels,
  levelLabels,
}: {
  texts: TeamImportTexts;
  functionLabels: Record<string, string>;
  levelLabels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(
    teamImportAction,
    INITIAL,
  );
  const [rows, setRows] = useState("");
  const [password, setPassword] = useState("");
  const [intent, setIntent] = useState<"preview" | "run">("preview");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const chosen = submitter?.value === "run" ? "run" : "preview";
    setIntent(chosen);
    const data = new FormData();
    data.set("intent", chosen);
    data.set("rows", rows);
    if (chosen === "run") data.set("password", password);
    startTransition(() => formAction(data));
  };

  const counts = state.rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const toReview = state.rows.filter((r) => r.review.length).length;
  const result = state.result;

  return (
    <div className="space-y-4" data-team-import>
      <Card title={texts.title}>
        <p className="mb-3 text-sm text-zinc-600">{texts.hint}</p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700">
              {texts.rows}
            </span>
            <Textarea
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              rows={10}
              required
              maxLength={100000}
              className="font-mono text-xs"
              data-team-import-rows
            />
          </label>
          <label className="block max-w-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700">
              {texts.password}
            </span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete="off"
              className="block min-h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[13px] text-zinc-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
              data-team-import-password
            />
            <span className="mt-1 block text-xs text-zinc-500">
              {texts.passwordHint}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              value="preview"
              variant="secondary"
              disabled={pending}
              data-team-import-preview
            >
              {pending && intent === "preview" ? texts.working : texts.preview}
            </Button>
            <Button
              type="submit"
              value="run"
              disabled={
                pending ||
                password.length < 8 ||
                (!state.rows.length && !state.pending.length)
              }
              data-team-import-run
            >
              {pending && intent === "run" ? texts.working : texts.run}
            </Button>
          </div>
        </form>
      </Card>

      {state.doneAt && !state.ok ? (
        <Alert tone="danger">
          <span data-team-import-error={state.error ?? ""}>
            {state.message}
          </span>
        </Alert>
      ) : null}

      {state.ok && result ? (
        <div className="space-y-2" data-team-import-result>
          <Alert tone={result.failed.length ? "warning" : "success"}>
            <span className="block" data-team-import-done>
              {fill(texts.runDone, {
                created: result.created.length,
                linked: result.linked.length,
                review: result.created.filter((c) => c.review).length,
              })}
            </span>
            {result.pending.length ? (
              <span className="mt-1 block" data-team-import-pending-done>
                {fill(texts.pendingDone, { n: result.pending.length })}
              </span>
            ) : null}
            {result.remaining ? (
              <span
                className="mt-1 block font-semibold"
                data-team-import-remaining
              >
                {fill(texts.remaining, { n: result.remaining })}
              </span>
            ) : null}
          </Alert>
          {result.failed.length ? (
            <Alert tone="danger">
              <span className="block font-semibold">
                {fill(texts.failed, { n: result.failed.length })}
              </span>
              <ul className="mt-1 list-disc pl-5">
                {result.failed.map((f) => (
                  <li key={f.email} data-team-import-failed={f.email}>
                    {f.name} ({f.email}): {f.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {result.skipped.length ? (
            <ul className="text-xs text-zinc-600" data-team-import-skipped>
              {result.skipped.map((s) => (
                <li key={s.email}>
                  {s.name} ({s.email}): {texts.skipped[s.reason] ?? s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state.ok && (state.rows.length || state.pending.length) ? (
        <Card
          title={fill(texts.previewDone, {
            n: state.rows.length,
            fresh: counts.new ?? 0,
            review: toReview,
          })}
        >
          {state.header ? (
            <p className="mb-2 text-xs text-zinc-500">
              {fill(texts.header, { header: state.header })}
            </p>
          ) : null}
          {state.invalid.length || state.repeated.length ? (
            <div className="mb-3">
              <Alert tone="warning">
                <ul className="list-disc pl-5" data-team-import-invalid>
                  {state.invalid.map((i) => (
                    <li key={`i${i.line}`}>
                      {fill(
                        i.reason === "name"
                          ? texts.invalidName
                          : texts.invalidEmail,
                        { line: i.line, text: i.text },
                      )}
                    </li>
                  ))}
                  {state.repeated.map((r) => (
                    <li key={`r${r.line}`}>
                      {fill(texts.repeated, { line: r.line, email: r.email })}
                    </li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
          {state.pending.length ? (
            <div className="mb-3" data-team-import-pending>
              <Alert tone="info">
                <span className="block font-semibold">
                  {fill(texts.pendingTitle, { n: state.pending.length })}
                </span>
                <span className="block text-xs">{texts.pendingHint}</span>
                <ul className="mt-1 list-disc pl-5">
                  {state.pending.map((p) => (
                    <li
                      key={`p${p.line}`}
                      data-team-import-pending-row={p.name}
                    >
                      {p.name} · {p.position || texts.none} ·{" "}
                      {p.area ?? texts.none}
                      {p.already ? ` (${texts.pendingAlready})` : ""}
                    </li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-1.5">{texts.colLine}</th>
                  <th className="px-2 py-1.5">{texts.colName}</th>
                  <th className="px-2 py-1.5">{texts.colEmail}</th>
                  <th className="px-2 py-1.5">{texts.colPosition}</th>
                  <th className="px-2 py-1.5">{texts.colArea}</th>
                  <th className="px-2 py-1.5">{texts.colFunctions}</th>
                  <th className="px-2 py-1.5">{texts.colLevel}</th>
                  <th className="px-2 py-1.5">{texts.colStatus}</th>
                  <th className="px-2 py-1.5">{texts.colReview}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {state.rows.map((r) => (
                  <tr
                    key={r.email}
                    className="align-top"
                    data-team-import-row={r.email}
                    data-team-import-status={r.status}
                  >
                    <td className="px-2 py-1.5 text-zinc-500">{r.line}</td>
                    <td className="px-2 py-1.5 font-medium text-zinc-900">
                      {r.name}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-700">{r.email}</td>
                    <td className="px-2 py-1.5">
                      {r.position || texts.none}
                      {r.position && !r.positionKnown ? (
                        <span className="ml-1 text-amber-700">
                          ({texts.unknownPosition})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">{r.area ?? texts.none}</td>
                    <td className="px-2 py-1.5">
                      {r.status !== "new"
                        ? texts.keep
                        : r.functions.length
                          ? r.functions
                              .map((f) => functionLabels[f] ?? f)
                              .join(", ")
                          : texts.none}
                    </td>
                    <td className="px-2 py-1.5">
                      {levelLabels[r.level] ?? r.level}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <Badge
                        tone={
                          r.status === "new"
                            ? "info"
                            : r.status === "existing"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {texts.status[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td
                      className={cx(
                        "px-2 py-1.5",
                        r.review.length ? "text-amber-800" : "text-zinc-400",
                      )}
                      data-team-import-review={r.review.length ? "1" : "0"}
                    >
                      {r.review.length ? (
                        <>
                          <span className="font-semibold">{texts.review}</span>
                          <ul className="list-disc pl-4">
                            {r.review.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        texts.noReview
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
