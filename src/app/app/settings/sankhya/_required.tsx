import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Alert, Badge, Card, Table, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getSankhyaErpSettings } from "@/lib/integrations/sankhya-settings";
import {
  checkRequired,
  type RequiredStatus,
} from "@/lib/integrations/sankhya-required";

/*
 * Integração → 6. O que o Sankhya exige para incluir: colunas obrigatórias
 * (NOT NULL sem padrão no banco do ERP) de Parceiro, Produto, Cabeçalho e
 * Item da nota, e se o portal as envia (campo do cadastro, valor fixo da
 * Integração/Processos, gerada pelo Sankhya) ou se falta. Só lê.
 */

type Params = Record<string, string | string[] | undefined>;

const TONE: Record<RequiredStatus, "success" | "info" | "neutral" | "danger"> =
  {
    portal: "success",
    fixed: "info",
    generated: "neutral",
    auto: "neutral",
    missing: "danger",
  };

export async function RequiredCard({
  t,
  q,
  ready,
}: {
  t: Translate;
  q: Params;
  ready: boolean;
}) {
  const run = q.req === "1" && ready;
  const checks = run ? await checkRequired(await getSankhyaErpSettings()) : [];
  // Só conta o que o portal inclui; as tabelas só lidas não bloqueiam.
  const missing = checks
    .filter((c) => c.mode === "create")
    .flatMap((c) =>
      c.rows
        .filter((r) => r.status === "missing")
        .map((r) => `${c.table}.${r.column}`),
    );
  return (
    <Card title={t("sankhyaInt.req")}>
      <div id="required" className="scroll-mt-4" />
      <p className="mb-3 text-sm text-zinc-600">{t("sankhyaInt.req.hint")}</p>
      {ready ? (
        <form method="get" action="/app/settings/sankhya#required">
          <input type="hidden" name="tab" value="integration" />
          <input type="hidden" name="req" value="1" />
          <SubmitButton variant="secondary" pendingText="…">
            {t("sankhyaInt.req.run")}
          </SubmitButton>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">{t("sankhyaInt.needConfig")}</p>
      )}
      {run ? (
        <div className="mt-4 grid gap-4">
          {checks.length && !checks.some((c) => c.error) ? (
            <Alert tone={missing.length ? "warning" : "success"}>
              {missing.length
                ? t("sankhyaInt.req.missingList", {
                    columns: missing.join(", "),
                  })
                : t("sankhyaInt.req.ok")}
            </Alert>
          ) : null}
          {checks.map((c) => (
            <section key={c.table}>
              <h3 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-800">
                {t(`sankhyaInt.req.table.${c.table}` as DictionaryKey)} (
                {c.table})
                <Badge tone={c.mode === "create" ? "success" : "neutral"}>
                  {t(`sankhyaInt.req.mode.${c.mode}`)}
                </Badge>
                {c.source ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {c.source}
                  </span>
                ) : null}
              </h3>
              {c.mode === "read" ? (
                <p className="mb-1 text-xs text-zinc-500">
                  {t(`sankhyaInt.req.why.${c.table}` as DictionaryKey)}
                </p>
              ) : null}
              {c.error ? (
                <Alert tone="danger">
                  {t("sankhyaInt.req.error", { detail: c.error })}
                </Alert>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("sankhyaLoad.col.column")}</Th>
                      <Th>{t("sankhyaInt.req.status")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr key={r.column}>
                        <Td className="font-mono text-xs">{r.column}</Td>
                        <Td>
                          <Badge
                            tone={
                              c.mode === "read" && r.status === "missing"
                                ? "neutral"
                                : TONE[r.status]
                            }
                          >
                            {t(
                              (c.mode === "read"
                                ? `sankhyaInt.req.read.${r.status}`
                                : `sankhyaInt.req.${r.status}`) as DictionaryKey,
                            )}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
