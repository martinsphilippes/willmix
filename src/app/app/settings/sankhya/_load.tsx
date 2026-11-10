import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Field,
  Select,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getSankhyaConfigStatus } from "@/lib/integrations/sankhya-settings";
import {
  ENTITY_MAPS,
  SANKHYA_ENTITIES,
  TOP_STAGES,
  type SankhyaEntityKey,
} from "@/lib/integrations/sankhya-mapping";
import { sankhyaImportSampleAction } from "../../actions/sankhya-integration";
import {
  loadSankhyaSample,
  type EntitySample,
} from "@/lib/integrations/sankhya-sample";
import { Failure, one } from "./_shared";
import { FullLoadCard } from "./_full";

/*
 * Aba Carga do Sankhya (só o administrador; docs/SANKHYA.md): mapeamento
 * campo a campo entre as entidades do Sankhya e as do portal e uma amostra
 * de 1 a 5 registros de cada uma, com o valor que iria para o portal e o
 * cadastro equivalente que já existe. Só leitura: nada é gravado.
 */

type Params = Record<string, string | string[] | undefined>;

const show = (v: unknown) =>
  v == null || v === ""
    ? "—"
    : typeof v === "boolean"
      ? v
        ? "✓"
        : "✗"
      : String(v);

function Json({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-700">
        {title}
      </summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-800">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function MappingTable({
  t,
  entity,
}: {
  t: Translate;
  entity: SankhyaEntityKey;
}) {
  const map = ENTITY_MAPS[entity];
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("sankhyaLoad.col.sankhya", { table: map.table })}</Th>
          <Th>
            {t("sankhyaLoad.col.portal", { table: map.portalTable ?? "—" })}
          </Th>
          <Th>{t("sankhyaLoad.col.rule")}</Th>
        </tr>
      </thead>
      <tbody>
        {map.fields.map((f) => (
          <tr key={f.sankhya}>
            <Td className="whitespace-nowrap font-mono text-xs">{f.sankhya}</Td>
            <Td className="whitespace-nowrap font-mono text-xs">
              {f.portal ?? (
                <span className="text-zinc-400">
                  {t("sankhyaLoad.noField")}
                </span>
              )}
            </Td>
            <Td className="text-xs text-zinc-600">
              {[f.transform, f.note].filter(Boolean).join(" · ")}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function SampleTable({ t, sample }: { t: Translate; sample: EntitySample }) {
  if (!sample.records.length)
    return <p className="text-sm text-zinc-500">{t("sankhya.rows.none")}</p>;
  const portalFields = sample.records[0].mapped;
  const matchable = [
    "partners",
    "products",
    "productGroups",
    "orders",
  ].includes(sample.entity);
  return (
    <Table className="max-h-[32rem] overflow-auto">
      <thead>
        <tr>
          <Th className="whitespace-nowrap">
            {ENTITY_MAPS[sample.entity].key_}
          </Th>
          {portalFields.map((f) => (
            <Th key={f.portal + f.sankhya} className="whitespace-nowrap">
              {f.portal}
              <span className="block font-mono text-[10px] font-normal text-zinc-400">
                ← {f.sankhya}
              </span>
            </Th>
          ))}
          {matchable ? <Th>{t("sankhyaLoad.inPortal")}</Th> : null}
        </tr>
      </thead>
      <tbody>
        {sample.records.map((r) => (
          <tr key={r.key}>
            <Td className="whitespace-nowrap font-mono text-xs">{r.key}</Td>
            {r.mapped.map((m) => (
              <Td key={m.portal + m.sankhya} className="max-w-64 text-xs">
                <span className="line-clamp-3">{show(m.value)}</span>
                {String(m.raw ?? "") !== String(m.value ?? "") ? (
                  <span className="block font-mono text-[10px] text-zinc-400 line-clamp-2">
                    {show(m.raw)}
                  </span>
                ) : null}
              </Td>
            ))}
            {matchable ? (
              <Td className="whitespace-nowrap text-xs">
                {r.match ? (
                  <TextLink href={r.match.href}>{r.match.label}</TextLink>
                ) : (
                  <Badge tone="info">{t("sankhyaLoad.new")}</Badge>
                )}
              </Td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

interface ImportedLine {
  e: string;
  c: string;
  o: "created" | "linked" | "existing" | "skipped";
  i: string | null;
  l: string;
  r?: string;
}

function parseImported(raw: string): ImportedLine[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as ImportedLine[]) : [];
  } catch {
    return [];
  }
}

const OUTCOME_TONE: Record<string, "success" | "info" | "neutral" | "warning"> =
  {
    created: "success",
    linked: "info",
    existing: "neutral",
    skipped: "warning",
  };

function hrefOf(l: ImportedLine): string | null {
  if (!l.i || !/^[A-Za-z0-9_-]{1,64}$/.test(l.i)) return null;
  if (l.e === "orders") return `/app/orders/${l.i}`;
  if (l.e === "products") return `/app/products/${l.i}`;
  if (l.e === "partners") return `/app/suppliers/${l.i}`;
  if (l.e === "companies") return `/app/customers/${l.i}`;
  if (l.e === "productGroups") return "/app/lines";
  return null;
}

export async function LoadTab({ t, q }: { t: Translate; q: Params }) {
  const status = await getSankhyaConfigStatus();
  const size = Math.min(5, Math.max(1, Number(one(q.n)) || 3));
  const run = one(q.run) === "1" && status.config !== null;
  let samples: EntitySample[] | null = null;
  let failure: string | null = null;
  if (run) {
    try {
      samples = await loadSankhyaSample(size);
    } catch (error) {
      const e = error as { code?: string; detail?: string; message?: string };
      failure = `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`;
    }
  }
  const byEntity = new Map(samples?.map((s) => [s.entity, s]));
  const imported = parseImported(one(q.imported));

  return (
    <div className="grid gap-4">
      <Card title={t("sankhyaLoad.title")}>
        <p className="mb-3 text-sm text-zinc-600">{t("sankhyaLoad.hint")}</p>
        {status.config ? (
          <form
            method="get"
            action="/app/settings/sankhya"
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="tab" value="load" />
            <input type="hidden" name="run" value="1" />
            <Field label={t("sankhyaLoad.size")}>
              <Select name="n" defaultValue={String(size)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton pendingText="…">{t("sankhyaLoad.run")}</SubmitButton>
          </form>
        ) : (
          <Alert tone="warning">{t("sankhyaInt.needConfig")}</Alert>
        )}
        {failure ? (
          <div className="mt-3">
            <Failure t={t} text={failure} />
          </div>
        ) : null}
        {samples ? (
          <p className="mt-3 text-xs text-zinc-500">
            {t("sankhyaLoad.summary", {
              list: samples
                .map(
                  (s) =>
                    `${t(`sankhyaLoad.entity.${s.entity}` as DictionaryKey)}: ${s.records.length}`,
                )
                .join(" · "),
            })}
          </p>
        ) : null}
      </Card>

      {status.config ? <FullLoadCard t={t} q={q} /> : null}

      {status.config ? (
        <Card title={t("sankhyaLoad.import")}>
          <div id="imported" className="scroll-mt-4" />
          <p className="mb-3 text-sm text-zinc-600">
            {t("sankhyaLoad.import.hint")}
          </p>
          {one(q.error) ? (
            <div className="mb-3">
              <Failure
                t={t}
                text={`${one(q.error)}: ${one(q.detail) || "—"}`}
              />
            </div>
          ) : null}
          {imported.length ? (
            <div className="mb-3 grid gap-2">
              <Alert tone="success">
                {t("sankhyaLoad.import.done", {
                  created: imported.filter((l) => l.o === "created").length,
                  linked: imported.filter((l) => l.o === "linked").length,
                  existing: imported.filter((l) => l.o === "existing").length,
                  skipped: imported.filter((l) => l.o === "skipped").length,
                })}
              </Alert>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("sankhyaLoad.import.entity")}</Th>
                    <Th>{t("sankhyaLoad.import.code")}</Th>
                    <Th>{t("sankhyaLoad.import.outcome")}</Th>
                    <Th>{t("sankhyaLoad.inPortal")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {imported.map((l, i) => {
                    const href = hrefOf(l);
                    return (
                      <tr key={i}>
                        <Td className="whitespace-nowrap text-xs">
                          {t(
                            `sankhyaLoad.import.entity.${l.e}` as DictionaryKey,
                          )}
                        </Td>
                        <Td className="whitespace-nowrap font-mono text-xs">
                          {l.c}
                        </Td>
                        <Td className="text-xs">
                          <Badge tone={OUTCOME_TONE[l.o] ?? "neutral"}>
                            {t(
                              `sankhyaLoad.import.outcome.${l.o}` as DictionaryKey,
                            )}
                          </Badge>
                          {l.r ? (
                            <span className="ml-2 text-zinc-500">{l.r}</span>
                          ) : null}
                        </Td>
                        <Td className="text-xs">
                          {href ? <TextLink href={href}>{l.l}</TextLink> : l.l}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : null}
          <form
            action={sankhyaImportSampleAction}
            className="flex flex-wrap items-end gap-2"
          >
            <Field label={t("sankhyaLoad.size")}>
              <Select name="n" defaultValue={String(size)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton
              pendingText="…"
              confirmText={t("sankhyaLoad.import.confirm")}
            >
              {t("sankhyaLoad.import.run")}
            </SubmitButton>
          </form>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
              {t("sankhyaLoad.import.stages")}
            </summary>
            <Table className="mt-2">
              <thead>
                <tr>
                  <Th>TOP</Th>
                  <Th>{t("sankhyaLoad.import.stage")}</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TOP_STAGES).map(([top, s]) => (
                  <tr key={top}>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {top} {s.label}
                    </Td>
                    <Td className="text-xs">
                      {t(`stage.${s.stage}` as DictionaryKey)}
                      {s.closed ? ` · ${t("sankhyaLoad.import.closed")}` : ""}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </details>
        </Card>
      ) : null}

      {SANKHYA_ENTITIES.map((entity) => {
        const map = ENTITY_MAPS[entity];
        const sample = byEntity.get(entity);
        return (
          <Card
            key={entity}
            title={`${t(`sankhyaLoad.entity.${entity}` as DictionaryKey)} · ${map.sankhyaEntity} (${map.table}) → ${map.portalTable ?? t("sankhyaLoad.computed")}`}
          >
            <div id={`load-${entity}`} className="scroll-mt-4" />
            <p className="mb-3 text-sm text-zinc-600">
              {t(`sankhyaLoad.about.${entity}` as DictionaryKey)}
            </p>
            {sample ? (
              <div className="mb-4 grid gap-2">
                {sample.missing.length ? (
                  <Alert tone="warning">
                    {t("sankhyaLoad.missing", {
                      columns: sample.missing.join(", "),
                    })}
                  </Alert>
                ) : null}
                {sample.error && !sample.missing.length ? (
                  <Failure t={t} text={sample.error} />
                ) : (
                  <SampleTable t={t} sample={sample} />
                )}
                <Json title={t("sankhyaLoad.sql")} value={sample.sql} />
                {sample.records.length ? (
                  <Json
                    title={t("sankhyaLoad.raw")}
                    value={sample.records.map((r) => r.raw)}
                  />
                ) : null}
                {sample.missing.length ? (
                  <Json
                    title={t("sankhyaLoad.columns")}
                    value={sample.columns.join(", ")}
                  />
                ) : null}
              </div>
            ) : null}
            <details open={!sample}>
              <summary className="mb-2 cursor-pointer text-sm font-semibold text-zinc-800">
                {t("sankhyaLoad.mapping")}
              </summary>
              <MappingTable t={t} entity={entity} />
            </details>
          </Card>
        );
      })}
    </div>
  );
}
