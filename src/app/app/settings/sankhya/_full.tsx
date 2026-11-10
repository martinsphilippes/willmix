import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Alert, Badge, Card, Table, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FULL_LOAD_ENTITIES } from "@/lib/integrations/sankhya-mapping";
import { getFullLoadProgress } from "@/lib/integrations/sankhya-full-load";
import { sankhyaFullLoadAction } from "../../actions/sankhya-integration";
import { one } from "./_shared";

/*
 * Carga completa dos cadastros (aba Carga do Sankhya): condições de pagamento,
 * fornecedores e clientes, produtos (com os grupos). Cada clique processa
 * lotes por ~40 s e guarda onde parou; o Sankhya é a fonte desses cadastros.
 */

type Params = Record<string, string | string[] | undefined>;

export async function FullLoadCard({ t, q }: { t: Translate; q: Params }) {
  const progress = await Promise.all(
    FULL_LOAD_ENTITIES.map(async (entity) => ({
      entity,
      progress: await getFullLoadProgress(entity),
    })),
  );
  const ran = one(q.ran);
  const full = one(q.full);
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" })
      : "—";

  return (
    <Card title={t("sankhyaLoad.full")}>
      <div id="full" className="scroll-mt-4" />
      <p className="mb-3 text-sm text-zinc-600">{t("sankhyaLoad.full.hint")}</p>
      {ran && full ? (
        <Alert tone={ran === "done" ? "success" : "info"}>
          {t(
            ran === "done"
              ? "sankhyaLoad.full.finished"
              : "sankhyaLoad.full.partial",
            {
              entity: t(`sankhyaLoad.full.entity.${full}` as DictionaryKey),
            },
          )}
        </Alert>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("sankhyaLoad.import.entity")}</Th>
            <Th>{t("sankhyaLoad.full.status")}</Th>
            <Th>{t("sankhyaLoad.full.counts")}</Th>
            <Th>{t("sankhyaLoad.full.updated")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {progress.map(({ entity, progress: p }) => (
            <tr key={entity}>
              <Td className="whitespace-nowrap text-sm font-medium">
                {t(`sankhyaLoad.full.entity.${entity}` as DictionaryKey)}
              </Td>
              <Td className="text-xs">
                {p.done ? (
                  <Badge tone="success">{t("sankhyaLoad.full.done")}</Badge>
                ) : p.startedAt ? (
                  <Badge tone="info">
                    {t("sankhyaLoad.full.running", {
                      after: p.after,
                      remaining: p.remaining ?? "—",
                    })}
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    {t("sankhyaLoad.full.notStarted")}
                  </Badge>
                )}
                {p.missing.length ? (
                  <span className="mt-1 block text-amber-700">
                    {t("sankhyaLoad.full.missing", {
                      columns: p.missing.join(", "),
                    })}
                  </span>
                ) : null}
              </Td>
              <Td className="text-xs">
                {Object.entries(p.counts)
                  .map(
                    ([o, n]) =>
                      `${t(`sankhyaLoad.import.outcome.${o}` as DictionaryKey)}: ${n}`,
                  )
                  .join(" · ") || "—"}
              </Td>
              <Td className="whitespace-nowrap text-xs">{fmt(p.updatedAt)}</Td>
              <Td className="whitespace-nowrap">
                <div className="flex gap-2">
                  {!p.done ? (
                    <form action={sankhyaFullLoadAction}>
                      <input type="hidden" name="entity" value={entity} />
                      <SubmitButton pendingText="…">
                        {p.startedAt
                          ? t("sankhyaLoad.full.continue")
                          : t("sankhyaLoad.full.start")}
                      </SubmitButton>
                    </form>
                  ) : null}
                  {p.startedAt ? (
                    <form action={sankhyaFullLoadAction}>
                      <input type="hidden" name="entity" value={entity} />
                      <input type="hidden" name="reset" value="1" />
                      <SubmitButton
                        variant="secondary"
                        pendingText="…"
                        confirmText={t("sankhyaLoad.full.resetConfirm")}
                      >
                        {t("sankhyaLoad.full.reset")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
