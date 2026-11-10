import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getStore } from "@/lib/db";
import {
  SANKHYA_PRODUCTION,
  SANKHYA_SANDBOX,
  type NoteInput,
  type SankhyaConfig,
} from "./sankhya-client";

/*
 * Configuração do Sankhya gravada na tela Configurações → Integração Sankhya
 * (docs/SANKHYA.md):
 * - credenciais (Client ID, Client Secret, X-Token e ambiente), cifradas com
 *   AES-256-GCM antes de ir para a tabela `settings`; a chave vem de
 *   SANKHYA_ENCRYPTION_KEY (ou, na falta, SESSION_SECRET / APPWRITE_API_KEY).
 *   Os valores nunca voltam para a tela: só os 4 últimos caracteres.
 *   Cada campo vazio na tela usa a variável de ambiente correspondente.
 * - códigos do ERP para os pedidos do portal (empresa, TOPs, tipo de
 *   negociação, comprador, local, volume) e as escolhas de ligação.
 * As chaves não entram em DEFAULT_SETTINGS: getSettings() não as devolve.
 */

const CREDENTIALS_KEY = "sankhya.credentials";
const ERP_KEY = "sankhya.erp";

type Env = Record<string, string | undefined>;

export type SankhyaEnvironment = "production" | "sandbox";

export const SANKHYA_SECRET_FIELDS = [
  "clientId",
  "clientSecret",
  "xToken",
] as const;
export type SankhyaSecretField = (typeof SANKHYA_SECRET_FIELDS)[number];

const ENV_NAME: Record<SankhyaSecretField, string> = {
  clientId: "SANKHYA_CLIENT_ID",
  clientSecret: "SANKHYA_CLIENT_SECRET",
  xToken: "SANKHYA_X_TOKEN",
};

/** Como fica na tabela `settings` (segredos cifrados). */
export interface StoredSankhyaCredentials {
  environment?: SankhyaEnvironment | null;
  clientId?: string | null;
  clientSecret?: string | null;
  xToken?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/* ---- Cifra ---- */

/** Chave de 32 bytes derivada do segredo do servidor; null sem segredo em produção. */
export function encryptionKey(env: Env = process.env): Buffer | null {
  const secret =
    env.SANKHYA_ENCRYPTION_KEY?.trim() ||
    env.SESSION_SECRET?.trim() ||
    env.APPWRITE_API_KEY?.trim() ||
    (env.NODE_ENV === "production" ? "" : "wellmix-dev-only-sankhya");
  if (!secret) return null;
  return createHash("sha256").update(`sankhya:${secret}`).digest();
}

/** "v1:iv:tag:dados" (base64). */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(":");
}

/** null quando não decifra (chave do servidor mudou ou valor corrompido). */
export function decryptSecret(value: string, key: Buffer): string | null {
  const [version, iv, tag, data] = value.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---- Leitura e gravação na tabela settings ---- */

export async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await getStore().list("settings", {
    filter: { key },
    limit: 1,
  });
  return (row?.value as T | undefined) ?? null;
}

export async function writeSetting(key: string, value: unknown) {
  const store = getStore();
  const [existing] = await store.list("settings", {
    filter: { key },
    limit: 1,
  });
  if (existing) await store.update("settings", existing.id, { value });
  else await store.create("settings", { key, value });
}

export async function readStoredCredentials() {
  return (await readSetting<StoredSankhyaCredentials>(CREDENTIALS_KEY)) ?? {};
}

export interface CredentialsChange {
  environment: SankhyaEnvironment;
  /** Vazio/ausente: mantém o valor gravado. */
  clientId?: string;
  clientSecret?: string;
  xToken?: string;
  /** Campos a apagar da tela (voltam a usar a variável de ambiente). */
  clear?: SankhyaSecretField[];
}

export class SankhyaSettingsError extends Error {
  constructor(readonly code: "sankhya_no_encryption_key") {
    super(code);
    this.name = "SankhyaSettingsError";
  }
}

/** Aplica a mudança sobre o gravado (puro: cifra com a chave dada). */
export function mergeCredentials(
  current: StoredSankhyaCredentials,
  change: CredentialsChange,
  key: Buffer,
  meta: { at: string; by: string },
): StoredSankhyaCredentials {
  const next: StoredSankhyaCredentials = {
    ...current,
    environment: change.environment,
    updatedAt: meta.at,
    updatedBy: meta.by,
  };
  for (const field of SANKHYA_SECRET_FIELDS) {
    const value = change[field]?.trim();
    if (value) next[field] = encryptSecret(value, key);
    else if (change.clear?.includes(field)) next[field] = null;
  }
  return next;
}

export async function saveSankhyaCredentials(
  change: CredentialsChange,
  by: string,
  env: Env = process.env,
) {
  const key = encryptionKey(env);
  const writesSecret = SANKHYA_SECRET_FIELDS.some((f) => change[f]?.trim());
  if (!key && writesSecret)
    throw new SankhyaSettingsError("sankhya_no_encryption_key");
  const current = await readStoredCredentials();
  const next = key
    ? mergeCredentials(current, change, key, {
        at: new Date().toISOString(),
        by,
      })
    : {
        ...current,
        environment: change.environment,
        ...Object.fromEntries((change.clear ?? []).map((f) => [f, null])),
      };
  await writeSetting(CREDENTIALS_KEY, next);
}

/* ---- Configuração efetiva (tela > variável de ambiente) ---- */

export type SankhyaFieldSource = "screen" | "env" | "missing" | "unreadable";

export interface SankhyaConfigStatus {
  config: SankhyaConfig | null;
  environment: SankhyaEnvironment;
  /** De onde veio cada credencial. */
  sources: Record<SankhyaSecretField, SankhyaFieldSource>;
  /** 4 últimos caracteres de cada credencial em uso (nunca o valor). */
  hints: Record<SankhyaSecretField, string>;
  missing: SankhyaSecretField[];
  envNames: Record<SankhyaSecretField, string>;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Sem chave de cifra no servidor (produção sem segredo): a tela não grava. */
  canStoreSecrets: boolean;
}

const tail = (v: string) => (v.length > 8 ? `…${v.slice(-4)}` : "…");

/** Puro: combina o gravado (cifrado) com as variáveis de ambiente. */
export function resolveSankhyaConfig(
  stored: StoredSankhyaCredentials,
  env: Env = process.env,
): SankhyaConfigStatus {
  const key = encryptionKey(env);
  const values = {} as Record<SankhyaSecretField, string>;
  const sources = {} as Record<SankhyaSecretField, SankhyaFieldSource>;
  const hints = {} as Record<SankhyaSecretField, string>;
  for (const field of SANKHYA_SECRET_FIELDS) {
    const saved = stored[field];
    const fromScreen = saved && key ? decryptSecret(saved, key) : null;
    const fromEnv = env[ENV_NAME[field]]?.trim() || "";
    if (fromScreen) {
      values[field] = fromScreen;
      sources[field] = "screen";
    } else if (fromEnv) {
      values[field] = fromEnv;
      sources[field] = "env";
    } else {
      values[field] = "";
      sources[field] = saved ? "unreadable" : "missing";
    }
    hints[field] = values[field] ? tail(values[field]) : "";
  }
  const envBase = env.SANKHYA_BASE_URL?.trim().replace(/\/+$/, "");
  const environment: SankhyaEnvironment =
    stored.environment ??
    (envBase === SANKHYA_SANDBOX ? "sandbox" : "production");
  const missing = SANKHYA_SECRET_FIELDS.filter((f) => !values[f]);
  return {
    config: missing.length
      ? null
      : {
          baseUrl:
            environment === "sandbox" ? SANKHYA_SANDBOX : SANKHYA_PRODUCTION,
          clientId: values.clientId,
          clientSecret: values.clientSecret,
          xToken: values.xToken,
        },
    environment,
    sources,
    hints,
    missing,
    envNames: ENV_NAME,
    updatedAt: stored.updatedAt ?? null,
    updatedBy: stored.updatedBy ?? null,
    canStoreSecrets: key !== null,
  };
}

export async function getSankhyaConfigStatus(env: Env = process.env) {
  return resolveSankhyaConfig(await readStoredCredentials(), env);
}

/* ---- Códigos do ERP para os pedidos do portal ---- */

export interface SankhyaErpSettings {
  /** Pedidos do portal vão ao ERP (desligado: número manual, como hoje). */
  ordersEnabled: boolean;
  /** Empresa que emite o pedido de compra (CODEMP): sempre 3, WELLMIX - SC. */
  codEmp: number | null;
  /** TOP do pedido de compra e da cotação (CODTIPOPER). */
  topOrder: number | null;
  topQuote: number | null;
  /** Condição de pagamento padrão (CODTIPVENDA; tabela Condições de pagamento). */
  codTipVenda: number | null;
  /** Usar a condição do fornecedor quando ele tiver uma própria. */
  paymentFromSupplier: boolean;
  /** Comprador (CODVEND; 0 = sem vendedor). */
  codVend: number | null;
  /**
   * Local de estoque (CODLOCAL): não usado. Quem cuida dele é o WMS; o portal
   * não envia nem mostra (fica só por compatibilidade com o que foi gravado).
   */
  codLocal?: number | null;
  /** Volume do item: sempre UN (fixo). */
  volumeMode: "product" | "fixed";
  codVol: string;
  /** Ligar fornecedor (CODPARC) e produto (CODPROD) do portal ao Sankhya. */
  autoLink: boolean;
  /** Natureza (CODNAT), centro de resultado (CODCENCUS) e projeto (CODPROJ). */
  codNat: number | null;
  codCenCus: number | null;
  codProj: number | null;
  /** Moeda do pedido (sigla) e o código dela no Sankhya (CODMOEDA, TSIMOE). */
  currency: string;
  codMoeda: number | null;
  /** Número de referência do pedido no portal: NUNOTA (único do sistema) ou NUMNOTA. */
  erpNumberField: "NUNOTA" | "NUMNOTA";
  /** Versão das respostas da Wellmix aplicadas (migração dos padrões). */
  version?: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** Respostas da Wellmix (10/11/2026; docs/SANKHYA.md). A tela permite ajustar. */
export const DEFAULT_SANKHYA_ERP: SankhyaErpSettings = {
  ordersEnabled: false,
  codEmp: 3,
  topOrder: 1101,
  topQuote: 1002,
  codTipVenda: 33,
  paymentFromSupplier: false,
  codVend: 0,
  volumeMode: "fixed",
  codVol: "UN",
  autoLink: true,
  codNat: 203005,
  codCenCus: 101006,
  codProj: 0,
  currency: "USD",
  codMoeda: null,
  erpNumberField: "NUNOTA",
  version: 2,
};

/**
 * Lê os códigos gravados. Gravações anteriores às respostas da Wellmix
 * (sem `version`) recebem os valores respondidos: empresa 3 e volume UN fixo.
 */
export function mergeErpSettings(
  stored: Partial<SankhyaErpSettings> | null,
): SankhyaErpSettings {
  const merged = { ...DEFAULT_SANKHYA_ERP, ...(stored ?? {}) };
  if (!stored?.version || stored.version < 2) {
    merged.codEmp = DEFAULT_SANKHYA_ERP.codEmp;
    merged.volumeMode = "fixed";
    merged.codVol = "UN";
    merged.version = 2;
  }
  return merged;
}

export async function getSankhyaErpSettings(): Promise<SankhyaErpSettings> {
  return mergeErpSettings(
    await readSetting<Partial<SankhyaErpSettings>>(ERP_KEY),
  );
}

export async function saveSankhyaErpSettings(
  value: Omit<SankhyaErpSettings, "updatedAt" | "updatedBy">,
  by: string,
) {
  await writeSetting(ERP_KEY, {
    ...value,
    version: 2,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  });
}

/** O que falta nos códigos para montar um pedido. */
export function erpMissing(
  erp: SankhyaErpSettings,
  kind: "order" | "quote",
): string[] {
  const out: string[] = [];
  if (erp.codEmp == null) out.push("CODEMP");
  if ((kind === "order" ? erp.topOrder : erp.topQuote) == null)
    out.push("CODTIPOPER");
  if (erp.codTipVenda == null) out.push("CODTIPVENDA");
  if (erp.codNat == null) out.push("CODNAT");
  if (erp.codCenCus == null) out.push("CODCENCUS");
  if (erp.volumeMode === "fixed" && !erp.codVol.trim()) out.push("CODVOL");
  return out;
}

export interface TestOrderInput {
  kind: "order" | "quote";
  codParc: number;
  codProd: number;
  quantity: number;
  unitPrice: number;
  /** TIPMOV da TOP no ERP (lido do TGFTOP). */
  tipMov: string;
  /** Volume do produto no ERP (quando volumeMode = product). */
  productVolume?: string | null;
  /** DD/MM/AAAA (Brasília). */
  date: string;
  note?: string;
}

/** Puro: cabeçalho e item do CACSP.incluirNota a partir dos códigos gravados. */
export function buildTestNote(
  erp: SankhyaErpSettings,
  input: TestOrderInput,
): NoteInput {
  const codVol =
    erp.volumeMode === "fixed"
      ? erp.codVol.trim()
      : input.productVolume?.trim() || undefined;
  return {
    header: {
      CODEMP: erp.codEmp,
      CODPARC: input.codParc,
      CODTIPOPER: input.kind === "order" ? erp.topOrder : erp.topQuote,
      CODTIPVENDA: erp.codTipVenda,
      CODVEND: erp.codVend ?? 0,
      TIPMOV: input.tipMov,
      DTNEG: input.date,
      CODNAT: erp.codNat,
      CODCENCUS: erp.codCenCus,
      CODPROJ: erp.codProj ?? 0,
      CODMOEDA: erp.codMoeda ?? undefined,
      OBSERVACAO: input.note ?? "Teste de integração do portal Wellmix",
    },
    items: [
      {
        CODPROD: input.codProd,
        QTDNEG: input.quantity,
        CODVOL: codVol,
        VLRUNIT: input.unitPrice,
        PERCDESC: 0,
      },
    ],
    informPrice: true,
  };
}
