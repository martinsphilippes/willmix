import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  Select,
  TextLink,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  executeQuery,
  loadRecords,
  type LoadRecordsInput,
  type SankhyaRow,
  type SankhyaTable,
} from "@/lib/integrations/sankhya-client";
import {
  SANKHYA_SECRET_FIELDS,
  erpMissing,
  getSankhyaConfigStatus,
  getSankhyaErpSettings,
  type SankhyaErpSettings,
} from "@/lib/integrations/sankhya-settings";
import {
  checkTestOrder,
  readNote,
  type TestOrderCheck,
} from "@/lib/integrations/sankhya-test-order";
import {
  saveSankhyaCredentialsAction,
  saveSankhyaErpAction,
  sankhyaCancelTestAction,
  sankhyaTestOrderAction,
  testSankhyaAuthAction,
} from "../../actions/sankhya-integration";
import { Failure, ResultTable, attempt, one, type Outcome } from "./_shared";

/*
 * Aba Integração Sankhya (só o administrador; docs/SANKHYA.md):
 * 1. credenciais (cifradas; a tela só mostra o final de cada uma);
 * 2. teste de autenticação;
 * 3. códigos do ERP para os pedidos (as 5 perguntas da integração);
 * 4. consultas de exemplo com o resultado em tabela e JSON;
 * 5. pedido/cotação de teste: pré-visualização (só leitura), envio, o que
 *    ficou gravado no ERP e o cancelamento.
 * Leituras rodam no servidor ao desenhar (GET); escritas são Server Actions.
 */

type Params = Record<string, string | string[] | undefined>;

const BASE = "/app/settings/sankhya";

const EXAMPLES = ["companies", "product", "partner", "tops", "notes"] as const;
type Example = (typeof EXAMPLES)[number];

const DEFAULT_TERM: Partial<Record<Example, string>> = {
  product: "WX7588",
  partner: "WELLMIX",
};

interface ExampleRun {
  request: unknown;
  result: Outcome;
}

function exampleRequest(
  example: Example,
  term: string,
  erp: SankhyaErpSettings,
): { load?: LoadRecordsInput; sql?: string } {
  switch (example) {
    case "companies":
      return {
        load: {
          entity: "Empresa",
          fields: "CODEMP, NOMEFANTASIA, RAZAOSOCIAL",
        },
      };
    case "product":
      return {
        load: {
          entity: "Produto",
          fields: "CODPROD, DESCRPROD, REFFORN, REFERENCIA, CODVOL, NCM, ATIVO",
          where: "REFFORN = ?",
          params: [{ type: "S", value: term }],
        },
      };
    case "partner":
      return {
        load: {
          entity: "Parceiro",
          fields: "CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR, ATIVO",
          where: "UPPER(NOMEPARC) LIKE ?",
          params: [{ type: "S", value: `%${term.toUpperCase()}%` }],
        },
      };
    case "tops":
      return {
        sql: "SELECT DISTINCT CODTIPOPER, DESCROPER, TIPMOV FROM TGFTOP WHERE TIPMOV = 'O' ORDER BY CODTIPOPER",
      };
    case "notes": {
      const tops = [erp.topOrder, erp.topQuote]
        .filter((v): v is number => Number.isInteger(v))
        .join(", ");
      return {
        sql: `SELECT NUNOTA, CODEMP, CODTIPOPER, CODPARC, DTNEG, VLRNOTA, STATUSNOTA FROM TGFCAB WHERE CODTIPOPER IN (${tops || "-1"}) AND NUNOTA > (SELECT MAX(NUNOTA) - 5000 FROM TGFCAB) ORDER BY NUNOTA DESC`,
      };
    }
  }
}

async function runExample(
  example: Example,
  term: string,
  erp: SankhyaErpSettings,
): Promise<ExampleRun> {
  const request = exampleRequest(example, term, erp);
  const result = await attempt<SankhyaTable>(() =>
    request.load ? loadRecords(request.load) : executeQuery(request.sql!),
  );
  return {
    request: request.load
      ? { service: "CRUDServiceProvider.loadRecords", ...request.load }
      : { service: "DbExplorerSP.executeQuery", sql: request.sql },
    result,
  };
}

/**
 * Opções das listas da parte 3, lidas do ERP. A primeira leitura também testa
 * a conexão: se falhar (credencial errada), as outras nem são pedidas.
 */
async function erpOptions() {
  const empty = {
    companies: [] as SankhyaRow[],
    tops: [] as SankhyaRow[],
    payment: [] as SankhyaRow[],
    buyers: [] as SankhyaRow[],
    currencies: [] as SankhyaRow[],
  };
  const first = await attempt(() =>
    loadRecords({ entity: "Empresa", fields: "CODEMP, NOMEFANTASIA" }),
  );
  if (first.error !== null) return empty;
  const list = async (sql: string) =>
    (await attempt(() => executeQuery(sql))).data?.rows ?? [];
  const [tops, payment, buyers, currencies] = await Promise.all([
    list(
      "SELECT DISTINCT CODTIPOPER, DESCROPER FROM TGFTOP WHERE TIPMOV = 'O' ORDER BY CODTIPOPER",
    ),
    list(
      "SELECT DISTINCT CODTIPVENDA, DESCRTIPVENDA FROM TGFTPV ORDER BY CODTIPVENDA",
    ),
    list(
      "SELECT CODVEND, APELIDO FROM TGFVEN WHERE ATIVO = 'S' ORDER BY CODVEND",
    ),
    list("SELECT CODMOEDA, NOMEMOEDA FROM TSIMOE ORDER BY CODMOEDA"),
  ]);
  return { companies: first.data.rows, tops, payment, buyers, currencies };
}

function Options({
  id,
  rows,
  code,
  label,
}: {
  id: string;
  rows: SankhyaRow[];
  code: string;
  label: string;
}) {
  return (
    <datalist id={id}>
      {rows.map((row, i) => (
        <option key={i} value={String(row[code] ?? "")}>
          {String(row[label] ?? "").trim()}
        </option>
      ))}
    </datalist>
  );
}

function Json({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-700">
        {title}
      </summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

const anchor = (id: string) => <div id={id} className="scroll-mt-4" />;

const nameOf = (row: SankhyaRow | undefined, ...fields: string[]) =>
  fields
    .map((f) => row?.[f])
    .filter((v) => v != null && String(v).trim())
    .map((v) => String(v).trim())
    .join(" · ");

function parseRows(raw: string): SankhyaRow[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as SankhyaRow[]) : [];
  } catch {
    return [];
  }
}

export async function IntegrationTab({ t, q }: { t: Translate; q: Params }) {
  const [status, erp] = await Promise.all([
    getSankhyaConfigStatus(),
    getSankhyaErpSettings(),
  ]);
  const ready = status.config !== null;

  const it = one(q.it);
  const at = one(q.at);
  const error = one(q.error);
  const detail = one(q.detail);

  /** Aviso de erro na parte onde ele aconteceu. */
  const errorAt = (part: string) => {
    if (!error || at !== part) return null;
    const own = `sankhyaInt.error.${error}` as DictionaryKey;
    const text = t(own, { detail: detail || "—" });
    return (
      <Alert tone="danger">
        {text !== own
          ? text
          : t("sankhya.error", { code: error, detail: detail || "—" })}
      </Alert>
    );
  };

  // Consultas de exemplo (GET ?ex=…&term=…#queries).
  const exParam = one(q.ex) as Example;
  const example = EXAMPLES.includes(exParam) ? exParam : null;
  const term =
    one(q.term).trim() || (example ? (DEFAULT_TERM[example] ?? "") : "");

  // Pedido de teste: pré-visualização (GET ?op=preview…) e resultado do envio.
  const op = one(q.op);
  const orderForm = {
    kind: one(q.kind) === "quote" ? ("quote" as const) : ("order" as const),
    codParc: one(q.codParc),
    codProd: one(q.codProd),
    quantity: one(q.quantity) || "1",
    unitPrice: one(q.unitPrice) || "1",
  };
  const previewInput =
    op === "preview" &&
    Number(orderForm.codParc) > 0 &&
    Number(orderForm.codProd) > 0 &&
    Number(orderForm.quantity.replace(",", ".")) > 0 &&
    Number(orderForm.unitPrice.replace(",", ".")) >= 0
      ? {
          kind: orderForm.kind,
          codParc: Math.trunc(Number(orderForm.codParc)),
          codProd: Math.trunc(Number(orderForm.codProd)),
          quantity: Number(orderForm.quantity.replace(",", ".")),
          unitPrice: Number(orderForm.unitPrice.replace(",", ".")),
        }
      : null;
  const nunota = it === "order" ? one(q.nunota).replace(/\D/g, "") : "";

  const [options, exampleRun, preview, saved] = ready
    ? await Promise.all([
        erpOptions(),
        example ? runExample(example, term, erp) : null,
        previewInput
          ? attempt<TestOrderCheck>(() => checkTestOrder(erp, previewInput))
          : null,
        nunota ? attempt(() => readNote(nunota)) : null,
      ])
    : [null, null, null, null];

  const missingErp = [
    ...new Set([...erpMissing(erp, "order"), ...erpMissing(erp, "quote")]),
  ];
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" })
      : "—";
  const codeValue = (v: number | null) => (v == null ? "" : String(v));

  return (
    <div className="grid gap-4">
      {/* 1. Credenciais */}
      <Card title={t("sankhyaInt.cred")}>
        {anchor("credentials")}
        <p className="mb-3 text-sm text-zinc-600">
          {t("sankhyaInt.cred.hint")}
        </p>
        {it === "credentials" ? (
          <Alert tone="success">{t("sankhyaInt.cred.saved")}</Alert>
        ) : null}
        {errorAt("credentials")}
        {!status.canStoreSecrets ? (
          <Alert tone="warning">{t("sankhyaInt.cred.noKey")}</Alert>
        ) : null}
        <p className="mb-3 text-sm">
          {ready ? (
            <Badge tone="success">
              {t("sankhyaInt.cred.ready", { base: status.config!.baseUrl })}
            </Badge>
          ) : (
            <Badge tone="warning">
              {t("sankhyaInt.cred.missing", {
                fields: status.missing
                  .map((f) => t(`sankhyaInt.cred.field.${f}` as DictionaryKey))
                  .join(", "),
              })}
            </Badge>
          )}
        </p>
        <form action={saveSankhyaCredentialsAction} className="grid gap-3">
          <Field
            label={t("sankhyaInt.cred.environment")}
            hint={t("sankhyaInt.cred.envHint")}
          >
            <Select name="environment" defaultValue={status.environment}>
              <option value="production">
                {t("sankhyaInt.cred.env.production")}
              </option>
              <option value="sandbox">
                {t("sankhyaInt.cred.env.sandbox")}
              </option>
            </Select>
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            {SANKHYA_SECRET_FIELDS.map((field) => {
              const source = status.sources[field];
              const sourceText =
                source === "screen"
                  ? t("sankhyaInt.cred.source.screen", {
                      hint: status.hints[field],
                    })
                  : source === "env"
                    ? t("sankhyaInt.cred.source.env", {
                        env: status.envNames[field],
                        hint: status.hints[field],
                      })
                    : t(`sankhyaInt.cred.source.${source}` as DictionaryKey);
              return (
                <div key={field} className="grid gap-1">
                  <Field
                    label={t(`sankhyaInt.cred.field.${field}` as DictionaryKey)}
                    hint={sourceText}
                  >
                    <Input
                      name={field}
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        source === "missing" ? "" : t("sankhyaInt.cred.keep")
                      }
                      disabled={!status.canStoreSecrets}
                      data-sankhya-secret={field}
                    />
                  </Field>
                  {source === "screen" || source === "unreadable" ? (
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input type="checkbox" name="clear" value={field} />
                      {t("sankhyaInt.cred.clear")}
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="…">
              {t("sankhyaInt.cred.save")}
            </SubmitButton>
            {status.updatedAt ? (
              <span className="text-xs text-zinc-500">
                {t("sankhyaInt.cred.updated", { at: fmt(status.updatedAt) })}
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      {/* 2. Autenticação */}
      <Card title={t("sankhyaInt.auth")}>
        {anchor("auth")}
        <p className="mb-3 text-sm text-zinc-600">
          {t("sankhyaInt.auth.hint")}
        </p>
        {errorAt("auth")}
        {it === "auth" ? (
          <div className="mb-3 grid gap-3">
            <Alert tone="success">
              {t("sankhyaInt.auth.ok", { base: one(q.base) })}
            </Alert>
            <DescriptionList
              items={[
                [
                  t("sankhyaInt.auth.authMs"),
                  t("sankhyaInt.auth.ms", { n: one(q.authMs) }),
                ],
                [
                  t("sankhyaInt.auth.totalMs"),
                  t("sankhyaInt.auth.ms", { n: one(q.ms) }),
                ],
                [
                  t("sankhyaInt.auth.expires"),
                  t("sankhyaInt.auth.seconds", { n: one(q.expires) }),
                ],
                [
                  t("sankhyaInt.auth.tokenLength"),
                  t("sankhyaInt.auth.chars", { n: one(q.tokenLength) }),
                ],
              ]}
            />
            <h3 className="text-sm font-semibold text-zinc-800">
              {t("sankhyaInt.auth.companies", { total: one(q.total) || "—" })}
            </h3>
            <ResultTable
              t={t}
              table={{
                columns: ["CODEMP", "NOMEFANTASIA"],
                rows: parseRows(one(q.companies)),
              }}
            />
          </div>
        ) : null}
        {ready ? (
          <form action={testSankhyaAuthAction}>
            <SubmitButton variant="secondary" pendingText="…">
              {t("sankhyaInt.auth.run")}
            </SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-zinc-500">{t("sankhyaInt.needConfig")}</p>
        )}
      </Card>

      {/* 3. Códigos do ERP (as 5 perguntas) */}
      <Card title={t("sankhyaInt.erp")}>
        {anchor("erp")}
        <p className="mb-3 text-sm text-zinc-600">{t("sankhyaInt.erp.hint")}</p>
        {it === "erp" ? (
          <Alert tone="success">{t("sankhyaInt.erp.saved")}</Alert>
        ) : null}
        {errorAt("erp")}
        {missingErp.length ? (
          <Alert tone="warning">
            {t("sankhyaInt.erp.missing", { fields: missingErp.join(", ") })}
          </Alert>
        ) : null}
        {options ? (
          <>
            <Options
              id="sk-companies"
              rows={options.companies}
              code="CODEMP"
              label="NOMEFANTASIA"
            />
            <Options
              id="sk-tops"
              rows={options.tops}
              code="CODTIPOPER"
              label="DESCROPER"
            />
            <Options
              id="sk-payment"
              rows={options.payment}
              code="CODTIPVENDA"
              label="DESCRTIPVENDA"
            />
            <Options
              id="sk-buyers"
              rows={options.buyers}
              code="CODVEND"
              label="APELIDO"
            />
            <Options
              id="sk-currencies"
              rows={options.currencies}
              code="CODMOEDA"
              label="NOMEMOEDA"
            />
          </>
        ) : null}
        <form action={saveSankhyaErpAction} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("sankhyaInt.erp.q1")}>
              <Input
                name="codEmp"
                inputMode="numeric"
                list="sk-companies"
                defaultValue={codeValue(erp.codEmp)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.q2order")}>
              <Input
                name="topOrder"
                inputMode="numeric"
                list="sk-tops"
                defaultValue={codeValue(erp.topOrder)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.q2quote")}>
              <Input
                name="topQuote"
                inputMode="numeric"
                list="sk-tops"
                defaultValue={codeValue(erp.topQuote)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.q3")}>
              <Input
                name="codTipVenda"
                inputMode="numeric"
                list="sk-payment"
                defaultValue={codeValue(erp.codTipVenda)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.q3supplier")}>
              <Select
                name="paymentFromSupplier"
                defaultValue={erp.paymentFromSupplier ? "1" : "0"}
              >
                <option value="0">{t("sankhyaInt.no")}</option>
                <option value="1">{t("sankhyaInt.yes")}</option>
              </Select>
            </Field>
            <Field label={t("sankhyaInt.erp.q4vend")}>
              <Input
                name="codVend"
                inputMode="numeric"
                list="sk-buyers"
                defaultValue={codeValue(erp.codVend)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.codNat")}>
              <Input
                name="codNat"
                inputMode="numeric"
                defaultValue={codeValue(erp.codNat)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.codCenCus")}>
              <Input
                name="codCenCus"
                inputMode="numeric"
                defaultValue={codeValue(erp.codCenCus)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.codProj")}>
              <Input
                name="codProj"
                inputMode="numeric"
                defaultValue={codeValue(erp.codProj)}
              />
            </Field>
            <Field label={t("sankhyaInt.erp.currency")}>
              <Select name="currency" defaultValue={erp.currency}>
                {["USD", "BRL", "CNY", "EUR"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("sankhyaInt.erp.codMoeda")}
              hint={t("sankhyaInt.erp.codMoedaHint")}
            >
              <Input
                name="codMoeda"
                inputMode="numeric"
                list="sk-currencies"
                defaultValue={codeValue(erp.codMoeda)}
              />
            </Field>
            <Field
              label={t("sankhyaInt.erp.erpNumberField")}
              hint={t("sankhyaInt.erp.erpNumberFieldHint")}
            >
              <Select name="erpNumberField" defaultValue={erp.erpNumberField}>
                <option value="NUNOTA">NUNOTA</option>
                <option value="NUMNOTA">NUMNOTA</option>
              </Select>
            </Field>
            <Field label={t("sankhyaInt.erp.volume")}>
              <Select name="volumeMode" defaultValue={erp.volumeMode}>
                <option value="product">
                  {t("sankhyaInt.erp.volume.product")}
                </option>
                <option value="fixed">
                  {t("sankhyaInt.erp.volume.fixed")}
                </option>
              </Select>
            </Field>
            <Field label={t("sankhyaInt.erp.codVol")}>
              <Input name="codVol" maxLength={6} defaultValue={erp.codVol} />
            </Field>
            <Field label={t("sankhyaInt.erp.q5")}>
              <Select name="autoLink" defaultValue={erp.autoLink ? "1" : "0"}>
                <option value="1">{t("sankhyaInt.yes")}</option>
                <option value="0">{t("sankhyaInt.no")}</option>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-zinc-500">
            {t("sankhyaInt.erp.ordersOff")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="…">
              {t("sankhyaInt.erp.save")}
            </SubmitButton>
            {erp.updatedAt ? (
              <span className="text-xs text-zinc-500">
                {t("sankhyaInt.erp.updated", { at: fmt(erp.updatedAt) })}
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      {/* 4. Consultas de exemplo */}
      <Card title={t("sankhyaInt.q")}>
        {anchor("queries")}
        <p className="mb-3 text-sm text-zinc-600">{t("sankhyaInt.q.hint")}</p>
        {ready ? (
          <>
            <form
              method="get"
              action={`${BASE}#queries`}
              className="flex flex-wrap items-end gap-2"
            >
              <Field label={t("sankhyaInt.q.run")}>
                <Select name="ex" defaultValue={example ?? "companies"}>
                  {EXAMPLES.map((ex) => (
                    <option key={ex} value={ex}>
                      {t(`sankhyaInt.q.ex.${ex}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("sankhyaInt.q.term")}>
                <Input name="term" defaultValue={term} placeholder="WX7588" />
              </Field>
              <SubmitButton variant="secondary" pendingText="…">
                {t("sankhyaInt.q.run")}
              </SubmitButton>
            </form>
            {exampleRun ? (
              <div className="mt-3">
                <Json
                  title={t("sankhyaInt.q.request")}
                  value={exampleRun.request}
                />
                {exampleRun.result.error !== null ? (
                  <div className="mt-2">
                    <Failure t={t} text={exampleRun.result.error} />
                  </div>
                ) : (
                  <>
                    <p className="mb-2 mt-3 text-xs text-zinc-500">
                      {t("sankhyaInt.q.rows", {
                        n: exampleRun.result.data.rows.length,
                      })}
                    </p>
                    <ResultTable t={t} table={exampleRun.result.data} />
                    <Json
                      title={t("sankhyaInt.q.json")}
                      value={exampleRun.result.data.rows.slice(0, 50)}
                    />
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-zinc-500">{t("sankhyaInt.needConfig")}</p>
        )}
      </Card>

      {/* 5. Pedido ou cotação de teste */}
      <Card title={t("sankhyaInt.order")}>
        {anchor("order")}
        <p className="mb-3 text-sm text-zinc-600">
          {t("sankhyaInt.order.hint")}
        </p>
        {errorAt("order")}
        {it === "cancelled" ? (
          <Alert tone="success">
            {t("sankhyaInt.order.cancelled", { nunota: one(q.nunota) })}
          </Alert>
        ) : null}
        {ready ? (
          <>
            <form
              method="get"
              action={`${BASE}#order`}
              className="grid gap-3 md:grid-cols-5"
            >
              <input type="hidden" name="op" value="preview" />
              <Field label={t("sankhyaInt.order.kind")}>
                <Select name="kind" defaultValue={orderForm.kind}>
                  <option value="order">
                    {t("sankhyaInt.order.kind.order", {
                      top: codeValue(erp.topOrder) || "—",
                    })}
                  </option>
                  <option value="quote">
                    {t("sankhyaInt.order.kind.quote", {
                      top: codeValue(erp.topQuote) || "—",
                    })}
                  </option>
                </Select>
              </Field>
              <Field label={t("sankhyaInt.order.codParc")}>
                <Input
                  name="codParc"
                  inputMode="numeric"
                  required
                  defaultValue={orderForm.codParc}
                />
              </Field>
              <Field label={t("sankhyaInt.order.codProd")}>
                <Input
                  name="codProd"
                  inputMode="numeric"
                  required
                  defaultValue={orderForm.codProd}
                />
              </Field>
              <Field label={t("sankhyaInt.order.quantity")}>
                <Input
                  name="quantity"
                  inputMode="decimal"
                  required
                  defaultValue={orderForm.quantity}
                />
              </Field>
              <Field label={t("sankhyaInt.order.unitPrice")}>
                <Input
                  name="unitPrice"
                  inputMode="decimal"
                  required
                  defaultValue={orderForm.unitPrice}
                />
              </Field>
              <div className="md:col-span-5">
                <SubmitButton variant="secondary" pendingText="…">
                  {t("sankhyaInt.order.preview")}
                </SubmitButton>
              </div>
            </form>

            {preview ? (
              <div className="mt-4 grid gap-3">
                {preview.error !== null ? (
                  <Failure t={t} text={preview.error} />
                ) : !preview.data.ok ? (
                  <Alert tone="danger">
                    {t(
                      `sankhyaInt.error.${preview.data.code}` as DictionaryKey,
                      {
                        detail: preview.data.detail,
                      },
                    )}
                  </Alert>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-zinc-800">
                      {t("sankhyaInt.order.previewTitle")}
                    </h3>
                    <DescriptionList
                      items={[
                        [
                          "TOP",
                          nameOf(
                            preview.data.top,
                            "CODTIPOPER",
                            "DESCROPER",
                            "TIPMOV",
                          ),
                        ],
                        [
                          t("sankhyaInt.order.codParc"),
                          nameOf(preview.data.partner, "CODPARC", "NOMEPARC"),
                        ],
                        [
                          t("sankhyaInt.order.codProd"),
                          nameOf(
                            preview.data.product,
                            "CODPROD",
                            "DESCRPROD",
                            "CODVOL",
                          ),
                        ],
                      ]}
                    />
                    <Json title="CACSP.incluirNota" value={preview.data.note} />
                    <p className="text-xs text-zinc-500">
                      {t("sankhyaInt.order.previewNote")}
                    </p>
                    <form action={sankhyaTestOrderAction}>
                      <input type="hidden" name="kind" value={orderForm.kind} />
                      <input
                        type="hidden"
                        name="codParc"
                        value={orderForm.codParc}
                      />
                      <input
                        type="hidden"
                        name="codProd"
                        value={orderForm.codProd}
                      />
                      <input
                        type="hidden"
                        name="quantity"
                        value={orderForm.quantity}
                      />
                      <input
                        type="hidden"
                        name="unitPrice"
                        value={orderForm.unitPrice}
                      />
                      <SubmitButton pendingText="…">
                        {t("sankhyaInt.order.send")}
                      </SubmitButton>
                    </form>
                  </>
                )}
              </div>
            ) : null}

            {nunota ? (
              <div className="mt-4 grid gap-3">
                <Alert tone="success">
                  {t("sankhyaInt.order.ok", { nunota })}
                </Alert>
                {saved?.error ? (
                  <Failure t={t} text={saved.error} />
                ) : saved?.data ? (
                  <>
                    <h3 className="text-sm font-semibold text-zinc-800">
                      {t("sankhyaInt.order.header")}
                    </h3>
                    <ResultTable t={t} table={saved.data.header} />
                    <h3 className="text-sm font-semibold text-zinc-800">
                      {t("sankhyaInt.order.items")}
                    </h3>
                    <ResultTable t={t} table={saved.data.items} />
                    <Json
                      title={t("sankhyaInt.q.json")}
                      value={{
                        header: saved.data.header.rows,
                        items: saved.data.items.rows,
                      }}
                    />
                  </>
                ) : null}
                <form
                  action={sankhyaCancelTestAction}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="nunota" value={nunota} />
                  <Field label={t("sankhyaInt.order.justification")}>
                    <Input
                      name="justification"
                      required
                      minLength={5}
                      defaultValue={t("sankhyaInt.order.cancelReason")}
                    />
                  </Field>
                  <SubmitButton
                    variant="danger"
                    pendingText="…"
                    confirmText={t("sankhyaInt.order.cancel")}
                  >
                    {t("sankhyaInt.order.cancel")}
                  </SubmitButton>
                </form>
                <TextLink
                  className="text-sm"
                  href={`${BASE}?tab=explore&entity=CabecalhoNota&where=${encodeURIComponent("NUNOTA = ?")}&params=${encodeURIComponent(`I:${nunota}`)}#records`}
                >
                  {t("sankhya.table.query")}
                </TextLink>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-zinc-500">{t("sankhyaInt.needConfig")}</p>
        )}
      </Card>
    </div>
  );
}
