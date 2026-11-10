import type { Translate } from "@/i18n";
import { Alert, Table, Td, TextLink, Th } from "@/components/ui";
import type { SankhyaTable } from "@/lib/integrations/sankhya-client";

/* Peças comuns das abas do Sankhya (Integração e Explorar). */

export const MAX_ROWS = 300;

export const one = (v: unknown) => (typeof v === "string" ? v : "");

export type Outcome =
  { data: SankhyaTable; error: null } | { data: null; error: string };

export async function attempt<T>(job: () => Promise<T>) {
  try {
    return { data: await job(), error: null } as const;
  } catch (error) {
    const e = error as { code?: string; detail?: string; message?: string };
    return {
      data: null,
      error: `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`,
    } as const;
  }
}

export function ResultTable({
  t,
  table,
  linkColumn,
}: {
  t: Translate;
  table: SankhyaTable;
  /** Coluna cujo valor vira link para o detalhe da tabela. */
  linkColumn?: string;
}) {
  if (!table.rows.length)
    return <p className="text-sm text-zinc-500">{t("sankhya.rows.none")}</p>;
  const rows = table.rows.slice(0, MAX_ROWS);
  return (
    <>
      {table.rows.length > MAX_ROWS ? (
        <p className="mb-2 text-xs text-zinc-500">
          {t("sankhya.rows.limited", {
            shown: MAX_ROWS,
            total: table.rows.length,
          })}
        </p>
      ) : null}
      <Table className="max-h-[32rem] overflow-y-auto">
        <thead>
          <tr>
            {table.columns.map((c) => (
              <Th key={c} className="whitespace-nowrap">
                {c}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {table.columns.map((c) => {
                const v = row[c];
                const text = v == null ? "" : String(v);
                return (
                  <Td key={c} className="whitespace-nowrap font-mono text-xs">
                    {linkColumn === c && text ? (
                      <TextLink
                        href={`/app/settings/sankhya?tab=explore&table=${encodeURIComponent(text)}#table`}
                      >
                        {text}
                      </TextLink>
                    ) : (
                      text
                    )}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export function Failure({ t, text }: { t: Translate; text: string }) {
  const [code, ...rest] = text.split(": ");
  return (
    <Alert tone="danger">
      {t("sankhya.error", { code, detail: rest.join(": ") })}
    </Alert>
  );
}

export function Outcome({
  t,
  result,
  linkColumn,
}: {
  t: Translate;
  result: Outcome;
  linkColumn?: string;
}) {
  return result.error !== null ? (
    <Failure t={t} text={result.error} />
  ) : (
    <ResultTable t={t} table={result.data} linkColumn={linkColumn} />
  );
}
