import "server-only";

/*
 * Cliente da API do Sankhya Om pelo API Gateway (docs/SANKHYA.md).
 *
 * Autenticação OAuth 2.0 (client credentials): POST /authenticate com o
 * cabeçalho X-Token (token da tela "Configurações Gateway" do Sankhya Om) e,
 * no corpo, client_id e client_secret (Área do Desenvolvedor). O token vale
 * poucos minutos (expires_in) e fica em memória por instância até 30 s antes
 * de vencer; um 401 numa chamada pede um token novo uma vez.
 *
 * Três portas, todas com o mesmo token Bearer:
 * - serviços "service.sbr" (módulos mge e mgecom): loadRecords, DatasetSP.save,
 *   CACSP.incluirNota, DbExplorerSP.executeQuery, logAlteracoesTabelas...;
 * - API REST v1 (/v1/...): produtos, parceiros, pedidos de venda, estoque...;
 * - dicionário de dados (TDDTAB/TDDCAM/TDDINS/TDDLIG) por SQL somente leitura.
 *
 * Variáveis: SANKHYA_CLIENT_ID, SANKHYA_CLIENT_SECRET, SANKHYA_X_TOKEN e,
 * opcional, SANKHYA_BASE_URL (padrão produção; sandbox:
 * https://api.sandbox.sankhya.com.br). Sem elas, `sankhyaConfig()` é null e
 * as telas dizem o que falta (nada é inventado).
 */

export interface SankhyaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  xToken: string;
}

type Env = Record<string, string | undefined>;

export const SANKHYA_PRODUCTION = "https://api.sankhya.com.br";
export const SANKHYA_SANDBOX = "https://api.sandbox.sankhya.com.br";

/** Variáveis que faltam para ligar a integração (vazio = configurada). */
export function sankhyaMissingEnv(env: Env = process.env): string[] {
  return (
    ["SANKHYA_CLIENT_ID", "SANKHYA_CLIENT_SECRET", "SANKHYA_X_TOKEN"] as const
  ).filter((key) => !env[key]?.trim());
}

export function sankhyaConfig(env: Env = process.env): SankhyaConfig | null {
  if (sankhyaMissingEnv(env).length) return null;
  const base = (env.SANKHYA_BASE_URL?.trim() || SANKHYA_PRODUCTION).replace(
    /\/+$/,
    "",
  );
  // Só os dois gateways oficiais: a URL vem de variável, mas o segredo nunca
  // vai para outro endereço.
  if (base !== SANKHYA_PRODUCTION && base !== SANKHYA_SANDBOX) return null;
  return {
    baseUrl: base,
    clientId: env.SANKHYA_CLIENT_ID!.trim(),
    clientSecret: env.SANKHYA_CLIENT_SECRET!.trim(),
    xToken: env.SANKHYA_X_TOKEN!.trim(),
  };
}

/** Falha vinda do Sankhya (ou da rede), com a mensagem original para o admin. */
export class SankhyaError extends Error {
  constructor(
    /** Código curto para a tela (snake_case). */
    readonly code:
      | "sankhya_not_configured"
      | "sankhya_auth"
      | "sankhya_http"
      | "sankhya_service"
      | "sankhya_network"
      | "sankhya_sql_readonly",
    /** Texto do Sankhya (statusMessage, error_description, corpo da resposta). */
    readonly detail: string,
    readonly status?: number,
  ) {
    super(code);
    this.name = "SankhyaError";
  }
}

type Fetch = typeof fetch;

const TIMEOUT_MS = 25_000;

interface CachedToken {
  key: string;
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

/** Para testes: esquece o token em memória. */
export function resetSankhyaTokenCache() {
  cached = null;
}

const cacheKey = (c: SankhyaConfig) =>
  `${c.baseUrl}|${c.clientId}|${c.xToken.slice(-6)}`;

function limited(text: string, max = 2000) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function timedFetch(fetcher: Fetch, url: string, init: RequestInit) {
  try {
    return await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new SankhyaError(
      "sankhya_network",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export interface SankhyaTokenInfo {
  token: string;
  expiresIn: number;
}

/** Pede um token novo ao gateway (sem cache). */
export async function authenticate(
  config: SankhyaConfig,
  fetcher: Fetch = fetch,
): Promise<SankhyaTokenInfo> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const res = await timedFetch(fetcher, `${config.baseUrl}/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-Token": config.xToken,
    },
    body,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* corpo não JSON: vai inteiro no detalhe */
  }
  const token = typeof json.access_token === "string" ? json.access_token : "";
  if (!res.ok || !token)
    throw new SankhyaError(
      "sankhya_auth",
      limited(
        String(json.error_description ?? json.error ?? json.message ?? text) ||
          `HTTP ${res.status}`,
      ),
      res.status,
    );
  const expiresIn = Number(json.expires_in) > 0 ? Number(json.expires_in) : 300;
  return { token, expiresIn };
}

async function bearer(config: SankhyaConfig, fetcher: Fetch, fresh = false) {
  const key = cacheKey(config);
  const now = Date.now();
  if (!fresh && cached && cached.key === key && cached.expiresAt > now)
    return cached.token;
  const { token, expiresIn } = await authenticate(config, fetcher);
  // Renova 30 s antes de vencer (e nunca guarda por menos de 10 s).
  cached = {
    key,
    token,
    expiresAt: now + Math.max(10, expiresIn - 30) * 1000,
  };
  return token;
}

export interface SankhyaClientOptions {
  config?: SankhyaConfig | null;
  fetch?: Fetch;
}

function requireConfig(options: SankhyaClientOptions = {}) {
  const config =
    options.config === undefined ? sankhyaConfig() : options.config;
  if (!config)
    throw new SankhyaError(
      "sankhya_not_configured",
      sankhyaMissingEnv().join(", ") || "SANKHYA_BASE_URL",
    );
  return { config, fetcher: options.fetch ?? fetch };
}

/** Chamada autenticada; um 401 renova o token e tenta mais uma vez. */
async function authorized(
  options: SankhyaClientOptions,
  path: string,
  init: RequestInit,
) {
  const { config, fetcher } = requireConfig(options);
  const send = async (fresh: boolean) =>
    timedFetch(fetcher, `${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${await bearer(config, fetcher, fresh)}`,
      },
    });
  let res = await send(false);
  if (res.status === 401) res = await send(true);
  return res;
}

export type SankhyaModule = "mge" | "mgecom";

/** Módulo de cada serviço especialista (os do mgecom não funcionam no mge). */
export function moduleOf(serviceName: string): SankhyaModule {
  return /^(CACSP|SelecaoDocumentoSP)\./i.test(serviceName) ? "mgecom" : "mge";
}

export interface SankhyaServiceResponse {
  serviceName?: string;
  status?: string;
  statusMessage?: string;
  transactionId?: string;
  responseBody?: unknown;
  [key: string]: unknown;
}

/** Mensagem de erro do Sankhya: às vezes vem em Base64. */
export function decodeStatusMessage(message: unknown): string {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return "";
  if (/^[A-Za-z0-9+/=\s]{16,}$/.test(text) && text.length % 4 === 0) {
    try {
      const decoded = Buffer.from(text, "base64").toString("utf8");
      // Só aceita se virou texto legível.
      if (decoded && !/[\u0000-\u0008\u000e-\u001f�]/.test(decoded))
        return decoded;
    } catch {
      /* não era Base64 */
    }
  }
  return text;
}

/**
 * Serviço "service.sbr" (status "1" = sucesso). O corpo segue o formato da
 * documentação: { serviceName, requestBody }.
 */
export async function callService(
  serviceName: string,
  requestBody: unknown,
  options: SankhyaClientOptions & { module?: SankhyaModule } = {},
): Promise<SankhyaServiceResponse> {
  if (!/^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/.test(serviceName))
    throw new SankhyaError(
      "sankhya_service",
      `serviceName inválido: ${serviceName}`,
    );
  const mod = options.module ?? moduleOf(serviceName);
  const path = `/gateway/v1/${mod}/service.sbr?serviceName=${encodeURIComponent(serviceName)}&outputType=json`;
  const res = await authorized(options, path, {
    method: "POST",
    body: JSON.stringify({ serviceName, requestBody }),
  });
  const text = await res.text();
  let json: SankhyaServiceResponse | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* tratado abaixo */
  }
  if (!res.ok || !json)
    throw new SankhyaError(
      res.status === 401 || res.status === 403
        ? "sankhya_auth"
        : "sankhya_http",
      limited(text) || `HTTP ${res.status}`,
      res.status,
    );
  if (json.status !== "1")
    throw new SankhyaError(
      "sankhya_service",
      limited(decodeStatusMessage(json.statusMessage) || text),
      res.status,
    );
  return json;
}

/** API REST v1 (ex.: GET /v1/produtos, POST /v1/vendas/pedidos). */
export async function rest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  options: SankhyaClientOptions = {},
): Promise<T> {
  if (!/^\/v\d+\/[A-Za-z0-9_\-/{}.?=&%,:]*$/.test(path))
    throw new SankhyaError("sankhya_http", `caminho inválido: ${path}`);
  const res = await authorized(options, path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok)
    throw new SankhyaError(
      res.status === 401 || res.status === 403
        ? "sankhya_auth"
        : "sankhya_http",
      limited(typeof json === "string" ? json : JSON.stringify(json)) ||
        `HTTP ${res.status}`,
      res.status,
    );
  return json as T;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export type SankhyaRow = Record<string, string | number | null>;

export interface SankhyaTable {
  columns: string[];
  rows: SankhyaRow[];
}

export interface LoadRecordsInput {
  /** Entidade (instância) do dicionário: Produto, Parceiro, CabecalhoNota... */
  entity: string;
  /** Campos da entidade raiz ("*" = todos). */
  fields?: string;
  /** Entidades ligadas a trazer junto: { path: "Parceiro", fields: "NOMEPARC" }. */
  joins?: Array<{ path: string; fields: string }>;
  /** Critério com "?" e os valores (tipo S, I, F, D ou H). */
  where?: string;
  params?: Array<{ value: string; type: "S" | "I" | "F" | "D" | "H" }>;
  page?: number;
  /** Só registros alterados desde (exige o log de alterações ligado no ERP). */
  modifiedSince?: string;
}

export interface LoadRecordsResult extends SankhyaTable {
  total: number | null;
  hasMore: boolean;
  page: number;
}

const ENTITY_NAME = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const PATH_NAME = /^[A-Za-z][A-Za-z0-9_.]{0,159}$/;
const FIELD_LIST = /^(\*|[A-Za-z0-9_]+(\s*,\s*[A-Za-z0-9_]+)*)$/;

function cell(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "object" && "$" in (value as object))
    return cell((value as { $: unknown }).$);
  if (typeof value === "object")
    return Object.keys(value as object).length ? JSON.stringify(value) : null;
  if (typeof value === "number") return value;
  return String(value);
}

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

/** Converte o "entities" do loadRecords (f0, f1... + metadata) em linhas. */
export function parseLoadRecords(responseBody: unknown): LoadRecordsResult {
  const entities =
    (responseBody as { entities?: Record<string, unknown> })?.entities ?? {};
  const meta = asArray(
    ((entities.metadata as { fields?: { field?: unknown } })?.fields?.field ??
      []) as Array<{ name?: string }>,
  );
  const columns = meta.map((f, i) => f?.name ?? `f${i}`);
  const rows = asArray(entities.entity as Record<string, unknown>[]).map(
    (entity) => {
      const row: SankhyaRow = {};
      columns.forEach((name, i) => {
        row[name] = cell(entity?.[`f${i}`]);
      });
      return row;
    },
  );
  const total = Number(cell(entities.total));
  return {
    columns,
    rows,
    total: Number.isFinite(total) ? total : null,
    hasMore: String(cell(entities.hasMoreResult)) === "true",
    page: Number(cell(entities.offsetPage)) || 0,
  };
}

/** CRUDServiceProvider.loadRecords: qualquer entidade, com ligações (joins). */
export async function loadRecords(
  input: LoadRecordsInput,
  options: SankhyaClientOptions = {},
): Promise<LoadRecordsResult> {
  if (!ENTITY_NAME.test(input.entity))
    throw new SankhyaError(
      "sankhya_service",
      `entidade inválida: ${input.entity}`,
    );
  const fields = (input.fields ?? "*").trim() || "*";
  if (!FIELD_LIST.test(fields))
    throw new SankhyaError("sankhya_service", `campos inválidos: ${fields}`);
  const joins = (input.joins ?? []).filter((j) => j.path.trim());
  for (const j of joins)
    if (!PATH_NAME.test(j.path) || !FIELD_LIST.test(j.fields.trim()))
      throw new SankhyaError("sankhya_service", `ligação inválida: ${j.path}`);
  const dataSet: Record<string, unknown> = {
    rootEntity: input.entity,
    ignoreCalculatedFields: "true",
    includePresentationFields: "N",
    tryJoinedFields: "true",
    offsetPage: String(Math.max(0, Math.floor(input.page ?? 0))),
    entity: [
      { path: "", fieldset: { list: fields } },
      ...joins.map((j) => ({
        path: j.path,
        fieldset: { list: j.fields.trim() },
      })),
    ],
  };
  if (input.where?.trim())
    dataSet.criteria = {
      expression: { $: input.where.trim() },
      parameter: (input.params ?? []).map((p) => ({
        $: p.value,
        type: p.type,
      })),
    };
  if (input.modifiedSince) dataSet.modifiedSince = input.modifiedSince;
  const json = await callService(
    "CRUDServiceProvider.loadRecords",
    { dataSet },
    options,
  );
  return parseLoadRecords(json.responseBody);
}

/**
 * SQL somente leitura (um SELECT ou WITH, sem ";" no meio). O Sankhya roda no
 * Oracle ou no SQL Server do cliente: use sintaxe compatível com o banco dele.
 */
export function assertReadOnlySql(sql: string): string {
  const text = sql.trim().replace(/;\s*$/, "");
  const plain = text
    .replace(/'(?:[^']|'')*'/g, "''") // ignora o conteúdo de textos
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  if (
    !/^\s*(select|with)\b/i.test(plain) ||
    plain.includes(";") ||
    /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|exec|execute|call|commit|rollback)\b/i.test(
      plain,
    )
  )
    throw new SankhyaError(
      "sankhya_sql_readonly",
      "Só SELECT (consulta): nada que altere o banco.",
    );
  return text;
}

/** Converte a resposta do DbExplorerSP.executeQuery em linhas. */
export function parseExecuteQuery(responseBody: unknown): SankhyaTable {
  const body = (responseBody ?? {}) as {
    fieldsMetadata?: Array<{ name?: string }>;
    rows?: unknown[][];
  };
  const columns = asArray(body.fieldsMetadata).map(
    (f, i) => f?.name ?? `C${i}`,
  );
  const rows = asArray(body.rows).map((values) => {
    const row: SankhyaRow = {};
    columns.forEach((name, i) => {
      row[name] = cell((values as unknown[])?.[i]);
    });
    return row;
  });
  return { columns, rows };
}

/** DbExplorerSP.executeQuery (exige o usuário do gateway com acesso ao Explorador de banco). */
export async function executeQuery(
  sql: string,
  options: SankhyaClientOptions = {},
): Promise<SankhyaTable> {
  const json = await callService(
    "DbExplorerSP.executeQuery",
    { sql: assertReadOnlySql(sql) },
    options,
  );
  return parseExecuteQuery(json.responseBody);
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export interface DatasetSaveInput {
  entity: string;
  /** Campos e valores; com `pk` altera o registro, sem `pk` inclui. */
  values: Record<string, string | number | null>;
  pk?: Record<string, string | number>;
}

/** DatasetSP.save: inclui ou altera um registro de qualquer entidade. */
export async function datasetSave(
  input: DatasetSaveInput,
  options: SankhyaClientOptions = {},
): Promise<SankhyaTable> {
  if (!ENTITY_NAME.test(input.entity))
    throw new SankhyaError(
      "sankhya_service",
      `entidade inválida: ${input.entity}`,
    );
  const fields = Object.keys(input.values);
  if (!fields.length || fields.some((f) => !PATH_NAME.test(f)))
    throw new SankhyaError("sankhya_service", "campos inválidos");
  const values: Record<string, string> = {};
  fields.forEach((f, i) => {
    const v = input.values[f];
    values[String(i)] = v == null ? "" : String(v);
  });
  const record: Record<string, unknown> = { values };
  if (input.pk && Object.keys(input.pk).length)
    record.pk = Object.fromEntries(
      Object.entries(input.pk).map(([k, v]) => [k, String(v)]),
    );
  const json = await callService(
    "DatasetSP.save",
    { entityName: input.entity, standAlone: false, fields, records: [record] },
    options,
  );
  const result = asArray(
    (json.responseBody as { result?: unknown[][] })?.result,
  ).map((values) => {
    const row: SankhyaRow = {};
    fields.forEach((name, i) => {
      row[name] = cell((values as unknown[])?.[i]);
    });
    return row;
  });
  return { columns: fields, rows: result };
}

/** Valor no formato do CACSP: { "$": "valor" }. */
const wrap = (fields: Record<string, string | number | null | undefined>) =>
  Object.fromEntries(
    Object.entries(fields)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v == null || v === "" ? {} : { $: String(v) }]),
  );

export interface NoteInput {
  /** Sem NUNOTA inclui uma nota nova; com NUNOTA, só os itens (incluirAlterarItemNota). */
  header: Record<string, string | number | null | undefined>;
  items: Array<Record<string, string | number | null | undefined>>;
  /** true: usa VLRUNIT/PERCDESC enviados; false: preço da tabela vigente no ERP. */
  informPrice?: boolean;
}

function notePayload(input: NoteInput) {
  return {
    nota: {
      cabecalho: wrap({ NUNOTA: null, ...input.header }),
      itens: {
        INFORMARPRECO: input.informPrice ? "True" : "False",
        item: input.items.map((item) =>
          wrap({
            NUNOTA: input.header.NUNOTA ?? null,
            IGNOREDESCPROMOQTD: "True",
            ...item,
          }),
        ),
      },
    },
  };
}

/** NUNOTA devolvido pelo CACSP (responseBody.pk.NUNOTA). */
function nunotaOf(responseBody: unknown): string | null {
  const v = cell((responseBody as { pk?: { NUNOTA?: unknown } })?.pk?.NUNOTA);
  return v == null ? null : String(v);
}

/**
 * CACSP.incluirNota: pedido de venda/compra, orçamento ou cotação (o que a nota
 * é vem da TOP, CODTIPOPER, e do TIPMOV configurados no Sankhya do cliente).
 */
export async function createNote(
  input: NoteInput,
  options: SankhyaClientOptions = {},
): Promise<{ nunota: string | null }> {
  if (!input.items.length)
    throw new SankhyaError("sankhya_service", "nota sem itens");
  const json = await callService(
    "CACSP.incluirNota",
    notePayload(input),
    options,
  );
  return { nunota: nunotaOf(json.responseBody) };
}

/** CACSP.incluirAlterarItemNota: inclui ou altera itens de uma nota existente (SEQUENCIA altera). */
export async function upsertNoteItems(
  nunota: string | number,
  items: NoteInput["items"],
  informPrice = true,
  options: SankhyaClientOptions = {},
) {
  const json = await callService(
    "CACSP.incluirAlterarItemNota",
    notePayload({ header: { NUNOTA: nunota }, items, informPrice }),
    options,
  );
  return json.responseBody;
}

/** CACSP.cancelarNota: cancela notas (pedidos faturados não são cancelados). */
export async function cancelNotes(
  nunotas: Array<string | number>,
  justification: string,
  options: SankhyaClientOptions = {},
) {
  const json = await callService(
    "CACSP.cancelarNota",
    {
      notasCanceladas: {
        nunota: nunotas.map((n) => ({ $: String(n) })),
        justificativa: justification,
        validarProcessosWmsEmAndamento: "true",
      },
    },
    options,
  );
  return json.responseBody;
}

/** SelecaoDocumentoSP.faturar: fatura notas (pedido → nota fiscal) com a TOP de destino; data DD/MM/AAAA. */
export async function invoiceNotes(
  nunotas: Array<string | number>,
  targetTop: string | number,
  options: SankhyaClientOptions & { date?: string; series?: string } = {},
) {
  const json = await callService(
    "SelecaoDocumentoSP.faturar",
    {
      notas: {
        codTipOper: Number(targetTop),
        dtFaturamento: options.date ?? "",
        tipoFaturamento: "FaturamentoNormal",
        dataValidada: true,
        notasComMoeda: {},
        nota: nunotas.map((n) => ({ $: Number(n) })),
        codLocalDestino: "",
        faturarTodosItens: true,
        umaNotaParaCada: "false",
        ehWizardFaturamento: true,
        dtFixaVenc: "",
        ehPedidoWeb: false,
        nfeDevolucaoViaRecusa: false,
        ...(options.series ? { serie: options.series } : {}),
      },
    },
    options,
  );
  return json.responseBody;
}

/** GatewayServiceProviderSP.logAlteracoesTabelas: o que mudou desde uma data (sincronização). */
export async function tableChanges(
  entities: string[],
  /** AAAA-MM-DDTHH:MM:SS */
  since: string,
  page = 0,
  options: SankhyaClientOptions = {},
) {
  const json = await callService(
    "GatewayServiceProviderSP.logAlteracoesTabelas",
    {
      dhAlter: since,
      size: 100,
      page,
      entidades: entities
        .filter((e) => ENTITY_NAME.test(e))
        .map((nome) => ({ nome })),
    },
    options,
  );
  return json.responseBody;
}

/** Teste de conexão: autentica e lê um registro de Empresa. */
export async function pingSankhya(options: SankhyaClientOptions = {}) {
  const { config, fetcher } = requireConfig(options);
  const started = Date.now();
  const { expiresIn } = await authenticate(config, fetcher);
  const sample = await loadRecords(
    { entity: "Empresa", fields: "CODEMP, NOMEFANTASIA" },
    options,
  );
  return {
    baseUrl: config.baseUrl,
    expiresIn,
    ms: Date.now() - started,
    companies: sample.rows.slice(0, 5),
  };
}
