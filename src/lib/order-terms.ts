/*
 * Condições do pedido na Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md): tipo de operação, formato de venda, entrega
 * (transportador e re-despacho), país de origem e grupo de produto, e os
 * contatos do cliente (sócio, comprador, financeiro e fiscal, logística).
 * Regras puras, usadas na tela e no servidor.
 */

/** Tipo de operação: TS (Trading Sales) ou Venda. */
export const OPERATION_TYPES = ["ts", "sale"] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

/**
 * Tipos de operação que se escolhem hoje (dono, 15/11/2026): só TS; Venda
 * aparece desabilitada.
 */
export const ENABLED_OPERATION_TYPES: readonly OperationType[] = ["ts"];

/**
 * Países de origem que não valem no TS (dono, 15/11/2026): TS é importação,
 * então BRASIL aparece desabilitado.
 */
export const TS_BLOCKED_COUNTRIES: readonly string[] = ["BRASIL"];

/** O país pode ser escolhido com este tipo de operação? */
export const countryAllowed = (operation: OperationType, key: string) =>
  !!key && !(operation === "ts" && TS_BLOCKED_COUNTRIES.includes(key));

/** Formato de venda: WD ou Wellmix (este com o nível). */
export const SALE_FORMATS = ["wd", "wellmix"] as const;
export type SaleFormat = (typeof SALE_FORMATS)[number];

/** Níveis do formato Wellmix, na ordem pedida pelo dono. */
export const WELLMIX_TIERS = [
  "pleno",
  "mega",
  "hiper",
  "ultra",
  "evo",
  "super",
] as const;
export type WellmixTier = (typeof WELLMIX_TIERS)[number];

/** Transportadora escolhida: do cadastro do portal ou do Sankhya (TGFPAR). */
export interface CarrierChoice {
  source: "portal" | "sankhya";
  /** Id do parceiro no portal ou CODPARC no Sankhya. */
  code: string;
  /** Nome no momento da escolha (o cadastro pode mudar depois). */
  name: string;
}

/** Valor do campo de transportadora no formulário: "portal:<id>" ou "sankhya:<CODPARC>". */
export const carrierValue = (c: Pick<CarrierChoice, "source" | "code">) =>
  `${c.source}:${c.code}`;

export function parseCarrierValue(
  value: string,
): Pick<CarrierChoice, "source" | "code"> | null {
  const m = /^(portal|sankhya):([A-Za-z0-9_-]{1,64})$/.exec(value.trim());
  return m ? { source: m[1] as CarrierChoice["source"], code: m[2] } : null;
}

/** Transportadora do re-despacho, informada pelo cliente pelo CNPJ. */
export interface RedispatchCarrier {
  cnpj: string;
  name: string;
  /** Parceiro (Transportadora) do portal com este CNPJ, criado se não havia. */
  partyId: string;
  /** "brasilapi" = dados da Receita pela BrasilAPI; "manual" = digitados. */
  source: "brasilapi" | "manual";
}

/** Confirmação do pedido pelo cliente (aviso "sem devoluções" + "Li e concordo"). */
export interface CustomerConfirmation {
  at: string;
  userId: string;
  userName: string;
  noReturnsAccepted: true;
  redispatchCarrier: RedispatchCarrier | null;
}

/** Condições do pedido gravadas em cada solicitação do lote (`requests.orderTerms`). */
export interface OrderTerms {
  operationType: OperationType;
  saleFormat: SaleFormat;
  /** Só com o formato Wellmix. */
  wellmixTier: WellmixTier | null;
  /** Transportador (obrigatório desde 15/11/2026; nulo só nas antigas). */
  carrier: CarrierChoice | null;
  /** Antes de 15/11/2026 (2ª rodada): transportadora do re-despacho. */
  redispatch?: CarrierChoice | null;
  /** Re-despacho: Sim ou Não (o cliente informa a transportadora na confirmação). */
  redispatchRequired?: boolean;
  /** País de origem (chave normalizada, ver `countryKey`). Produto sem país não é vendido. */
  originCountry: string;
  /** Nome do país como a tela mostrou. */
  originCountryName: string;
  /** Família de produto (grupo pai no Sankhya; ver product-origin.ts). */
  productFamily?: string;
  productFamilyName?: string;
  /** Antes de 15/11/2026 (2ª rodada): o grupo era a linha. */
  productLineId?: string;
  productLineName?: string;
  /** O aviso "sem devoluções" fica para o cliente, na confirmação. */
  noReturnsNotice: true;
  /** Antes de 15/11/2026 (2ª rodada): o vendedor marcava "Li e concordo". */
  noReturnsAccepted?: boolean;
  /** Confirmação do cliente; nula = aguardando o cliente. */
  confirmation?: CustomerConfirmation | null;
}

/* ------------------------------------------------------------------ */
/* CNPJ                                                                */
/* ------------------------------------------------------------------ */

/** Só os dígitos do CNPJ. */
export const cnpjDigits = (value: string | null | undefined) =>
  (value ?? "").replace(/\D/g, "");

/** CNPJ válido (14 dígitos e os dois dígitos verificadores). */
export function validCnpj(value: string | null | undefined): boolean {
  const d = cnpjDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digit = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}

/** "12.345.678/0001-90" */
export function formatCnpj(value: string): string {
  const d = cnpjDigits(value);
  return d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : value;
}

/* ------------------------------------------------------------------ */
/* País de origem                                                      */
/* ------------------------------------------------------------------ */

/** Siglas que aparecem no cadastro (a demonstração usa "CN", "BR"). */
const ISO_NAMES: Record<string, string> = {
  CN: "CHINA",
  BR: "BRASIL",
  IN: "ÍNDIA",
  VN: "VIETNÃ",
  TR: "TURQUIA",
  EG: "EGITO",
  PK: "PAQUISTÃO",
  US: "ESTADOS UNIDOS",
  TW: "TAIWAN",
  HK: "HONG KONG",
  BD: "BANGLADESH",
  ID: "INDONÉSIA",
  TH: "TAILÂNDIA",
  MY: "MALÁSIA",
  KR: "COREIA DO SUL",
  JP: "JAPÃO",
  IT: "ITÁLIA",
  PT: "PORTUGAL",
  ES: "ESPANHA",
  DE: "ALEMANHA",
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Nome do país para a tela (sigla vira nome; caixa alta). Vazio = não informado. */
export function countryName(raw: string | null | undefined): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!text) return "";
  return ISO_NAMES[text] ?? text;
}

/** Chave do país sem acento e sem caixa ("China", "CHINA" e "CN" são o mesmo). */
export function countryKey(raw: string | null | undefined): string {
  return fold(countryName(raw));
}

/* ------------------------------------------------------------------ */
/* Contatos do cliente                                                 */
/* ------------------------------------------------------------------ */

/** Os quatro contatos, na ordem da tela. */
export const CONTACT_ROLES = [
  "partner",
  "buyer",
  "finance",
  "logistics",
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface ContactEntry {
  phone: string;
  email: string;
}

export type CustomerContacts = Record<ContactRole, ContactEntry>;

/** Só os dígitos do telefone (para comparar "(47) 9999-0000" com "4799990000"). */
export const phoneDigits = (phone: string | null | undefined) =>
  (phone ?? "").replace(/\D/g, "");

/** Telefone comparável: sem o 55 do Brasil na frente. */
function phoneComparable(phone: string | null | undefined) {
  const digits = phoneDigits(phone);
  return digits.length > 11 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}

const emailComparable = (email: string | null | undefined) =>
  (email ?? "").trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ContactIssue =
  | { role: ContactRole; field: "phone" | "email"; code: "required" }
  | { role: ContactRole; field: "phone"; code: "invalid_phone" }
  | { role: ContactRole; field: "email"; code: "invalid_email" }
  | { role: ContactRole; field: "phone" | "email"; code: "same_as_seller" };

/** Contato de quem não pode aparecer como contato do cliente (representante, vendedor). */
export interface SellerContact {
  email?: string | null;
  phone?: string | null;
}

/**
 * Confere os contatos: telefone (10 a 13 dígitos) e e-mail em todos, e
 * nenhum igual ao do representante ou vendedor (dono, 15/11/2026).
 */
export function contactIssues(
  contacts: CustomerContacts,
  sellers: readonly SellerContact[],
): ContactIssue[] {
  const emails = new Set(
    sellers.map((s) => emailComparable(s.email)).filter(Boolean),
  );
  const phones = new Set(
    sellers.map((s) => phoneComparable(s.phone)).filter((p) => p.length >= 8),
  );
  const issues: ContactIssue[] = [];
  for (const role of CONTACT_ROLES) {
    const entry = contacts[role];
    const phone = phoneDigits(entry.phone);
    const email = emailComparable(entry.email);
    if (!phone) issues.push({ role, field: "phone", code: "required" });
    else if (phone.length < 10 || phone.length > 13)
      issues.push({ role, field: "phone", code: "invalid_phone" });
    else if (phones.has(phoneComparable(entry.phone)))
      issues.push({ role, field: "phone", code: "same_as_seller" });
    if (!email) issues.push({ role, field: "email", code: "required" });
    else if (!EMAIL_RE.test(email) || email.length > 160)
      issues.push({ role, field: "email", code: "invalid_email" });
    else if (emails.has(email))
      issues.push({ role, field: "email", code: "same_as_seller" });
  }
  return issues;
}

/** Os contatos limpos para gravar (telefone como digitado, e-mail em minúsculas). */
export function cleanContacts(contacts: CustomerContacts): CustomerContacts {
  const out = {} as CustomerContacts;
  for (const role of CONTACT_ROLES)
    out[role] = {
      phone: contacts[role].phone.replace(/\s+/g, " ").trim().slice(0, 40),
      email: emailComparable(contacts[role].email),
    };
  return out;
}

/** Lê os contatos gravados (JSON do banco); nulo se faltar algum campo. */
export function readContacts(value: unknown): CustomerContacts | null {
  if (!value || typeof value !== "object") return null;
  const out = {} as CustomerContacts;
  for (const role of CONTACT_ROLES) {
    const entry = (value as Record<string, unknown>)[role];
    if (!entry || typeof entry !== "object") return null;
    const { phone, email } = entry as Record<string, unknown>;
    out[role] = {
      phone: typeof phone === "string" ? phone : "",
      email: typeof email === "string" ? email : "",
    };
  }
  return out;
}
