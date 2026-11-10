import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  TextLink,
  Textarea,
} from "@/components/ui";
import { Failure, Outcome, ResultTable, attempt, one } from "./_shared";
import { SubmitButton } from "@/components/submit-button";
import {
  executeQuery,
  loadRecords,
  type LoadRecordsInput,
} from "@/lib/integrations/sankhya-client";
import { getSankhyaConfigStatus } from "@/lib/integrations/sankhya-settings";
import { SettingsTabs } from "../_tabs";
import { IntegrationTab } from "./_integration";
import { LoadTab } from "./_load";
import { PaymentConditionsTab } from "./_payment";
import { ProcessTab } from "./_process";
import {
  describeTable,
  searchTables,
} from "@/lib/integrations/sankhya-dictionary";
import {
  sankhyaCancelAction,
  sankhyaNoteAction,
  sankhyaSaveAction,
  testSankhyaAction,
} from "../../actions/sankhya";

// Consultas ao ERP podem demorar (gateway + banco do cliente).
export const maxDuration = 60;

/*
 * Configurações → Sankhya (só o administrador; docs/SANKHYA.md), em duas abas:
 * - Integração (padrão; _integration.tsx): credenciais, códigos do ERP e
 *   testes de autenticação, consultas e pedido;
 * - Carga (?tab=load; _load.tsx): mapeamento Sankhya → portal e amostra;
 * - Explorar (?tab=explore): teste da conexão, dicionário de dados (tabelas, entidades, campos e ligações), consulta
 * de qualquer entidade com ligações, SQL somente leitura e escrita no ERP
 * (registro, pedido/orçamento/cotação, cancelamento). Leituras são GET (o
 * servidor consulta e desenha); escritas são Server Actions auditadas.
 */

/** "tipo:valor" por linha → parâmetros do critério. */
function parseParams(raw: string): LoadRecordsInput["params"] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^([SIFDH])\s*:(.*)$/i.exec(line);
      return m
        ? { type: m[1].toUpperCase() as "S", value: m[2].trim() }
        : { type: "S" as const, value: line };
    });
}

/** "Ligação: CAMPO1, CAMPO2" por linha → joins do loadRecords. */
function parseJoins(raw: string): LoadRecordsInput["joins"] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [path, ...fields] = line.split(":");
      return { path: path.trim(), fields: fields.join(":").trim() || "*" };
    });
}

const NOTE_HEADER = `{
  "CODEMP": 1,
  "CODPARC": 0,
  "CODTIPOPER": 0,
  "CODTIPVENDA": 0,
  "CODVEND": 0,
  "TIPMOV": "P",
  "DTNEG": "${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}"
}`;

const NOTE_ITEMS = `[
  { "CODPROD": 0, "QTDNEG": 1, "CODVOL": "UN", "CODLOCALORIG": 0, "VLRUNIT": 0, "PERCDESC": 0 }
]`;

export default async function SankhyaPage({
  searchParams,
}: PageProps<"/app/settings/sankhya">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/settings/sankhya");
  requireScreen(user, "settings");
  if (user.role !== "admin") notFound();
  const t = await getT();
  const q = await searchParams;

  // Aba: Explorar quando pedida ou quando a URL traz uma consulta/resultado dela.
  const exploreSk = ["ping", "saved", "note", "cancelled"];
  const tab =
    one(q.tab) === "explore" ||
    ["q", "table", "entity", "sql"].some((k) => q[k] !== undefined) ||
    exploreSk.includes(one(q.sk))
      ? "explore"
      : "integration";

  if (one(q.tab) === "process")
    return (
      <>
        <PageHeader
          title={t("processes.title")}
          subtitle={t("processes.subtitle")}
          actions={
            <TextLink href="/app/settings" className="text-sm">
              {t("sankhya.back")}
            </TextLink>
          }
        />
        <SettingsTabs t={t} active="process" admin />
        <ProcessTab t={t} q={q} />
      </>
    );

  if (one(q.tab) === "payment")
    return (
      <>
        <PageHeader
          title={t("paymentConditions.title")}
          subtitle={t("paymentConditions.subtitle")}
          actions={
            <TextLink href="/app/settings" className="text-sm">
              {t("sankhya.back")}
            </TextLink>
          }
        />
        <SettingsTabs t={t} active="payment" admin />
        <PaymentConditionsTab t={t} q={q} />
      </>
    );

  if (one(q.tab) === "load")
    return (
      <>
        <PageHeader
          title={t("sankhyaInt.tab.load")}
          subtitle={t("sankhyaLoad.title")}
          actions={
            <TextLink href="/app/settings" className="text-sm">
              {t("sankhya.back")}
            </TextLink>
          }
        />
        <SettingsTabs t={t} active="load" admin />
        <LoadTab t={t} q={q} />
      </>
    );

  if (tab === "integration")
    return (
      <>
        <PageHeader
          title={t("sankhyaInt.title")}
          subtitle={t("sankhyaInt.subtitle")}
          actions={
            <TextLink href="/app/settings" className="text-sm">
              {t("sankhya.back")}
            </TextLink>
          }
        />
        <SettingsTabs t={t} active="integration" admin />
        <IntegrationTab t={t} q={q} />
      </>
    );

  const status = await getSankhyaConfigStatus();
  const config = status.config;
  const missing = status.missing.map((f) => status.envNames[f]);

  const dictQuery = one(q.q);
  const table = one(q.table);
  const entity = one(q.entity);
  const fields = one(q.fields) || "*";
  const joins = one(q.joins);
  const where = one(q.where);
  const params = one(q.params);
  const page = Math.max(0, Number(one(q.page)) || 0);
  const sql = one(q.sql);

  const [dict, detail, records, sqlResult] = config
    ? await Promise.all([
        q.q !== undefined ? attempt(() => searchTables(dictQuery)) : null,
        table ? describeTable(table) : null,
        entity
          ? attempt(() =>
              loadRecords({
                entity,
                fields,
                joins: parseJoins(joins),
                where,
                params: parseParams(params),
                page,
              }),
            )
          : null,
        sql ? attempt(() => executeQuery(sql)) : null,
      ])
    : [null, null, null, null];

  const sk = one(q.sk);
  const error = one(q.error);
  const errorDetail = one(q.detail);
  const errorText = error
    ? t("sankhya.error", { code: error, detail: errorDetail || "—" })
    : null;
  const notice = (anchor: string, ok: string | null) => {
    const hash = {
      ping: "status",
      saved: "write",
      note: "note",
      cancelled: "cancel",
    }[sk];
    return (
      <>
        {ok && hash === anchor ? <Alert tone="success">{ok}</Alert> : null}
        {errorText && anchor === "any" ? (
          <Alert tone="danger">{errorText}</Alert>
        ) : null}
      </>
    );
  };

  const pageLink = (target: number) => {
    const u = new URLSearchParams({
      tab: "explore",
      entity,
      fields,
      joins,
      where,
      params,
      page: String(target),
    });
    return `/app/settings/sankhya?${u.toString()}#records`;
  };

  return (
    <>
      <PageHeader
        title={t("sankhya.title")}
        subtitle={t("sankhya.subtitle")}
        actions={
          <TextLink href="/app/settings" className="text-sm">
            {t("sankhya.back")}
          </TextLink>
        }
      />
      <SettingsTabs t={t} active="explore" admin />
      {notice("any", null)}

      <div className="grid gap-4">
        <Card title={t("sankhya.status")}>
          <div id="status" className="scroll-mt-4" />
          {config ? (
            <p className="text-sm text-zinc-700">
              {t("sankhya.status.configured", { base: config.baseUrl })}
            </p>
          ) : (
            <Alert tone="warning">
              {t("sankhya.status.missing", {
                vars: missing.length ? missing.join(", ") : "SANKHYA_BASE_URL",
              })}
            </Alert>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            {t("sankhya.status.help")}
          </p>
          {notice(
            "status",
            sk === "ping"
              ? t("sankhya.status.ok", {
                  ms: one(q.ms),
                  base: one(q.base),
                  companies: one(q.companies) || "—",
                })
              : null,
          )}
          {config ? (
            <form action={testSankhyaAction} className="mt-3">
              <SubmitButton variant="secondary" pendingText="…">
                {t("sankhya.status.test")}
              </SubmitButton>
            </form>
          ) : null}
        </Card>

        {config ? (
          <>
            <Card title={t("sankhya.dict")}>
              <div id="dict" className="scroll-mt-4" />
              <p className="mb-3 text-sm text-zinc-600">
                {t("sankhya.dict.hint")}
              </p>
              <form
                method="get"
                action="/app/settings/sankhya#dict"
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="tab" value="explore" />
                <Field label={t("sankhya.dict.search")}>
                  <Input
                    name="q"
                    defaultValue={dictQuery}
                    placeholder={t("sankhya.dict.placeholder")}
                  />
                </Field>
                <SubmitButton variant="secondary" pendingText="…">
                  {t("sankhya.dict.search")}
                </SubmitButton>
              </form>
              {dict ? (
                <div className="mt-3">
                  <Outcome t={t} result={dict} linkColumn="NOMETAB" />
                </div>
              ) : null}
            </Card>

            {detail ? (
              <Card
                title={t("sankhya.table", { table: detail.table })}
                actions={
                  "rows" in detail.instances &&
                  detail.instances.rows[0]?.NOMEINSTANCIA ? (
                    <TextLink
                      className="text-sm"
                      href={`/app/settings/sankhya?tab=explore&entity=${encodeURIComponent(String(detail.instances.rows[0].NOMEINSTANCIA))}#records`}
                    >
                      {t("sankhya.table.query")}
                    </TextLink>
                  ) : null
                }
              >
                <div id="table" className="scroll-mt-4" />
                {(
                  [
                    ["sankhya.table.instances", detail.instances],
                    ["sankhya.table.fields", detail.fields],
                    ["sankhya.table.links", detail.links],
                  ] as const
                ).map(([key, part]) => (
                  <section key={key} className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold text-zinc-800">
                      {t(key)}
                    </h3>
                    {"error" in part ? (
                      <Failure t={t} text={`sankhya_service: ${part.error}`} />
                    ) : (
                      <ResultTable
                        t={t}
                        table={part}
                        linkColumn={
                          key === "sankhya.table.links"
                            ? "TABELA_DESTINO"
                            : undefined
                        }
                      />
                    )}
                  </section>
                ))}
              </Card>
            ) : null}

            <Card title={t("sankhya.records")}>
              <div id="records" className="scroll-mt-4" />
              <p className="mb-3 text-sm text-zinc-600">
                {t("sankhya.records.hint")}
              </p>
              <form
                method="get"
                action="/app/settings/sankhya#records"
                className="grid gap-2 md:grid-cols-2"
              >
                <input type="hidden" name="tab" value="explore" />
                <Field label={t("sankhya.records.entity")}>
                  <Input
                    name="entity"
                    defaultValue={entity}
                    placeholder="Produto"
                    required
                  />
                </Field>
                <Field label={t("sankhya.records.fields")}>
                  <Input name="fields" defaultValue={fields} />
                </Field>
                <Field label={t("sankhya.records.joins")}>
                  <Textarea
                    name="joins"
                    defaultValue={joins}
                    placeholder="GrupoProduto: CODGRUPOPROD, DESCRGRUPOPROD"
                  />
                </Field>
                <Field label={t("sankhya.records.where")}>
                  <Textarea
                    name="where"
                    defaultValue={where}
                    placeholder="ATIVO = ?"
                  />
                </Field>
                <Field label={t("sankhya.records.params")}>
                  <Textarea
                    name="params"
                    defaultValue={params}
                    placeholder="S:S"
                  />
                </Field>
                <div className="flex items-end">
                  <SubmitButton variant="secondary" pendingText="…">
                    {t("sankhya.records.run")}
                  </SubmitButton>
                </div>
              </form>
              {records ? (
                <div className="mt-3">
                  {records.error === null ? (
                    <>
                      <p className="mb-2 text-xs text-zinc-500">
                        {t("sankhya.records.total", {
                          shown: records.data.rows.length,
                          total: records.data.total ?? "—",
                        })}
                      </p>
                      <ResultTable t={t} table={records.data} />
                      <div className="mt-2 flex gap-3 text-sm">
                        {page > 0 ? (
                          <TextLink href={pageLink(page - 1)}>
                            {t("sankhya.records.prev")}
                          </TextLink>
                        ) : null}
                        {records.data.hasMore ? (
                          <TextLink href={pageLink(page + 1)}>
                            {t("sankhya.records.next")}
                          </TextLink>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <Failure t={t} text={records.error} />
                  )}
                </div>
              ) : null}
            </Card>

            <Card title={t("sankhya.sql")}>
              <div id="sql" className="scroll-mt-4" />
              <p className="mb-3 text-sm text-zinc-600">
                {t("sankhya.sql.hint")}
              </p>
              <form
                method="get"
                action="/app/settings/sankhya#sql"
                className="grid gap-2"
              >
                <input type="hidden" name="tab" value="explore" />
                <Textarea
                  name="sql"
                  defaultValue={sql}
                  className="min-h-28 font-mono text-xs"
                  placeholder="SELECT CODPROD, DESCRPROD FROM TGFPRO WHERE ATIVO = 'S'"
                />
                <div>
                  <SubmitButton variant="secondary" pendingText="…">
                    {t("sankhya.sql.run")}
                  </SubmitButton>
                </div>
              </form>
              {sqlResult ? (
                <div className="mt-3">
                  <Outcome t={t} result={sqlResult} />
                </div>
              ) : null}
            </Card>

            <Card title={t("sankhya.note")}>
              <div id="note" className="scroll-mt-4" />
              <p className="mb-3 text-sm text-zinc-600">
                {t("sankhya.note.hint")}
              </p>
              {notice(
                "note",
                sk === "note"
                  ? t("sankhya.note.ok", { nunota: one(q.nunota) || "—" })
                  : null,
              )}
              <form
                action={sankhyaNoteAction}
                className="grid gap-2 md:grid-cols-2"
              >
                <Field label={t("sankhya.note.header")}>
                  <Textarea
                    name="header"
                    defaultValue={NOTE_HEADER}
                    className="min-h-48 font-mono text-xs"
                  />
                </Field>
                <Field label={t("sankhya.note.items")}>
                  <Textarea
                    name="items"
                    defaultValue={NOTE_ITEMS}
                    className="min-h-48 font-mono text-xs"
                  />
                </Field>
                <Field label={t("sankhya.note.informPrice")}>
                  <Select name="informPrice" defaultValue="1">
                    <option value="1">✓</option>
                    <option value="0">—</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <SubmitButton pendingText="…">
                    {t("sankhya.note.submit")}
                  </SubmitButton>
                </div>
              </form>
            </Card>

            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Card title={t("sankhya.write")}>
                <div id="write" className="scroll-mt-4" />
                <p className="mb-3 text-sm text-zinc-600">
                  {t("sankhya.write.hint")}
                </p>
                {notice(
                  "write",
                  sk === "saved"
                    ? t("sankhya.write.ok", { result: one(q.result) })
                    : null,
                )}
                <form action={sankhyaSaveAction} className="grid gap-2">
                  <Field label={t("sankhya.write.entity")}>
                    <Input name="entity" placeholder="Parceiro" required />
                  </Field>
                  <Field label={t("sankhya.write.pk")}>
                    <Input
                      name="pk"
                      placeholder='{"CODPARC": 123}'
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field label={t("sankhya.write.values")}>
                    <Textarea
                      name="values"
                      placeholder='{"NOMEPARC": "…", "ATIVO": "S"}'
                      className="min-h-28 font-mono text-xs"
                      required
                    />
                  </Field>
                  <div>
                    <SubmitButton pendingText="…">
                      {t("sankhya.write.submit")}
                    </SubmitButton>
                  </div>
                </form>
              </Card>

              <Card title={t("sankhya.cancel")}>
                <div id="cancel" className="scroll-mt-4" />
                <p className="mb-3 text-sm text-zinc-600">
                  {t("sankhya.cancel.hint")}
                </p>
                {notice(
                  "cancel",
                  sk === "cancelled"
                    ? t("sankhya.cancel.ok", { nunota: one(q.nunota) })
                    : null,
                )}
                <form action={sankhyaCancelAction} className="grid gap-2">
                  <Field label={t("sankhya.cancel.nunotas")}>
                    <Input name="nunotas" required />
                  </Field>
                  <Field label={t("sankhya.cancel.justification")}>
                    <Input name="justification" required minLength={5} />
                  </Field>
                  <div>
                    <SubmitButton variant="danger" pendingText="…">
                      {t("sankhya.cancel.submit")}
                    </SubmitButton>
                  </div>
                </form>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">{t("sankhya.notConfigured")}</p>
        )}
      </div>
    </>
  );
}
