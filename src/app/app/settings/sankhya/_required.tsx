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
  const missing = checks.flatMap((c) =>
    c.rows.filter((r) => r.status === "missing").map((r) => r.column),
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
              <h3 className="mb-1 text-sm font-semibold text-zinc-800">
                {c.entity} ({c.table})
                {c.source ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {c.source}
                  </span>
                ) : null}
              </h3>
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
                          <Badge tone={TONE[r.status]}>
                            {t(`sankhyaInt.req.${r.status}` as DictionaryKey)}
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
