import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Alert, Badge, Card, Table, Td, Th } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FULL_LOAD_ENTITIES } from "@/lib/integrations/sankhya-mapping";
import { getFullLoadProgress } from "@/lib/integrations/sankhya-full-load";
import { getServerLoad } from "@/lib/integrations/sankhya-load-queue";
import {
  sankhyaFullLoadAction,
  sankhyaServerLoadAction,
} from "../../actions/sankhya-integration";
import { one } from "./_shared";
import { AutoContinue } from "./_auto";

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
  const server = await getServerLoad();
  const queued = new Set(server.active ? server.queue : []);
  const ran = one(q.ran);
  const full = one(q.full);
  const auto = one(q.auto) === "1" && ran === "partial";
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
      <div
        className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"
        data-sankhya-server-load={server.active ? "on" : "off"}
      >
        <span className="flex-1">
          {server.active ? (
            <>
              <Badge tone="info">{t("sankhyaLoad.server.on")}</Badge>{" "}
              {t("sankhyaLoad.server.queue", {
                list: server.queue
                  .map((e) =>
                    t(`sankhyaLoad.full.entity.${e}` as DictionaryKey),
                  )
                  .join(" → "),
                last: fmt(server.lastRunAt),
              })}
            </>
          ) : server.finishedAt && !server.lastError ? (
            t("sankhyaLoad.server.finished", { at: fmt(server.finishedAt) })
          ) : (
            t("sankhyaLoad.server.hint")
          )}
          {server.lastError ? (
            <span className="mt-1 block text-xs text-red-700">
              {t("sankhyaLoad.server.error", {
                n: server.failures,
                error: server.lastError,
              })}
            </span>
          ) : null}
        </span>
        <form action={sankhyaServerLoadAction}>
          {server.active ? <input type="hidden" name="stop" value="1" /> : null}
          <SubmitButton
            variant={server.active ? "secondary" : "primary"}
            pendingText="…"
          >
            {server.active
              ? t("sankhyaLoad.server.stop")
              : t("sankhyaLoad.server.startAll")}
          </SubmitButton>
        </form>
      </div>
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
                  {!p.done ? (
                    <form
                      id={`full-auto-${entity}`}
                      action={sankhyaFullLoadAction}
                    >
                      <input type="hidden" name="entity" value={entity} />
                      <input type="hidden" name="auto" value="1" />
                      <SubmitButton variant="secondary" pendingText="…">
                        {t("sankhyaLoad.full.auto")}
                      </SubmitButton>
                    </form>
                  ) : null}
                  {!p.done && !queued.has(entity) ? (
                    <form action={sankhyaServerLoadAction}>
                      <input type="hidden" name="entity" value={entity} />
                      <SubmitButton variant="secondary" pendingText="…">
                        {t("sankhyaLoad.server.one")}
                      </SubmitButton>
                    </form>
                  ) : queued.has(entity) ? (
                    <Badge tone="info">{t("sankhyaLoad.server.queued")}</Badge>
                  ) : null}
                  {auto && full === entity && !p.done ? (
                    <>
                      <AutoContinue formId={`full-auto-${entity}`} />
                      <a
                        href="/app/settings/sankhya?tab=load#full"
                        className="self-center text-xs font-semibold text-red-700 underline"
                      >
                        {t("sankhyaLoad.full.stop")}
                      </a>
                    </>
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
