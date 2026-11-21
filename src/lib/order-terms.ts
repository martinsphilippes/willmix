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

/**
 * VIP de cada nível do formato Wellmix (dono, 16/11/2026): o divisor
 * comercial que a cotação de encomenda V2 do Sankhya recebe em @VIP
 * (107 Pleno, 108 Mega, 109 Hiper, 117 Ultra, 113 Evo, 115 Super).
 */
export const WELLMIX_TIER_VIP: Record<WellmixTier, number> = {
  pleno: 1,
  mega: 2,
  hiper: 3,
  ultra: 5,
  evo: 1.42857143,
  super: 4,
};

/** VIP do formato WD (dono, 16/11/2026). */
export const WD_VIP = 5;

/** VIP da cotação V2 pelo formato de venda (e o nível, no Wellmix). */
export function saleVip(
  format: SaleFormat | null | undefined,
  tier: WellmixTier | null | undefined,
): number | null {
  if (format === "wd") return WD_VIP;
  if (format === "wellmix" && tier) return WELLMIX_TIER_VIP[tier];
  return null;
}

/**
 * Quem chama o transportador (dono, 16/11/2026): o Cliente (ele informa a
 * transportadora, ou as duas com re-despacho, na confirmação do pedido; a
 * entrega vai do porto ao cliente) ou a Wellmix (o vendedor escolhe a(s)
 * transportadora(s) na solicitação; a entrega passa pelo depósito).
 */
export const CARRIER_CALLERS = ["customer", "wellmix"] as const;
export type CarrierCaller = (typeof CARRIER_CALLERS)[number];

/** Rota da entrega na cotação V2 (@ROTA_ENTREGA) por quem chama. */
export const DELIVERY_ROUTE: Record<CarrierCaller, string> = {
  customer: "PORTO_CLIENTE",
  wellmix: "VIA_DEPOSITO",
};

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
  /** Quem chama = Cliente (16/11/2026): a transportadora informada por ele. */
  carrier?: RedispatchCarrier | null;
}

/** Condições do pedido gravadas em cada solicitação do lote (`requests.orderTerms`). */
export interface OrderTerms {
  operationType: OperationType;
  saleFormat: SaleFormat;
  /** Só com o formato Wellmix. */
  wellmixTier: WellmixTier | null;
  /**
   * Transportador escolhido pelo vendedor (quem chama = Wellmix); nulo
   * quando quem chama é o cliente (ele informa na confirmação) e nas antigas.
   */
  carrier: CarrierChoice | null;
  /**
   * Transportadora do re-despacho escolhida pelo vendedor (quem chama =
   * Wellmix, 16/11/2026; antes de 15/11/2026, a da 2ª rodada).
   */
  redispatch?: CarrierChoice | null;
  /**
   * Quem chama o transportador (16/11/2026). Ausente nas antigas: o
   * vendedor escolhia o transportador e o cliente informava o re-despacho.
   */
  carrierCaller?: CarrierCaller;
  /**
   * Valor do transporte digitado no pedido (R$, total; quem chama =
   * Wellmix; dono, 16/11/2026). Nulo = o frete padrão das Configurações.
   */
  deliveryFreightBrl?: number | null;
  /**
   * Forma de pagamento escolhida na Nova solicitação (dono, 16/11/2026):
   * cópia da forma de Configurações → Formas de pagamento do cliente no
   * momento da escolha. O pedido nasce com ela pré-escolhida (a escolha
   * valendo, com alçada e boletos, continua no pedido;
   * docs/CUSTOMER_PAYMENT.md). Ausente nas solicitações antigas.
   */
  paymentPlan?: RequestPaymentPlan | null;
  /** Re-despacho: Sim ou Não (o cliente informa a transportadora na confirmação). */
  redispatchRequired?: boolean;
  /** País de origem (chave normalizada, ver `countryKey`). Produto sem país não é vendido. */
  originCountry: string;
  /** Nome do país como a tela mostrou. */
  originCountryName: string;
  /**
   * Porto de origem (dono, 21/11/2026; docs/ORDER_TERMS.md 11.23): o código
   * do porto no Sankhya, "" = porto não informado. Ausente nas solicitações
   * de antes do País - Porto (qualquer porto).
   */
  originPort?: string;
  /** Nome do porto como a tela mostrou ("" = não informado). */
  originPortName?: string;
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
  /**
   * RCA do pedido (dono, 19/11/2026; docs/CUSTOMER_RCA.md seção 7): o
   * vendedor do Sankhya (CODVEND). `customer` = o do cadastro do cliente
   * (Sankhya ou portal); `locked` = o que fechou a última venda, padrão por
   * 30 dias; `chosen` = escolhido pelo vendedor (cliente sem RCA). Quando o
   * cliente confirma o pedido, o `chosen` vira o padrão do cliente.
   */
  rca?: { code: string; source: "customer" | "locked" | "chosen" } | null;
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

/** Mais contatos por área além do primeiro (dono, 17/11/2026): até 5 por área. */
export const MAX_EXTRA_CONTACTS = 5;

/**
 * O primeiro contato de cada área (como sempre) e, em `more`, os demais que o
 * vendedor acrescentou pelo "+" (dono, 17/11/2026). Aditivo: o JSON gravado
 * antes não tem `more`.
 */
export type CustomerContacts = Record<ContactRole, ContactEntry> & {
  more?: Partial<Record<ContactRole, ContactEntry[]>>;
};

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

export type ContactIssue = (
  | { role: ContactRole; field: "phone" | "email"; code: "required" }
  | { role: ContactRole; field: "phone"; code: "invalid_phone" }
  | { role: ContactRole; field: "email"; code: "invalid_email" }
  | { role: ContactRole; field: "phone" | "email"; code: "same_as_seller" }
) & {
  /** Posição do contato extra (0 = o segundo da área); ausente = o primeiro. */
  index?: number;
};

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
  /**
   * Opcional (Solicitante da equipe interna; dono, 18/11/2026): o contato
   * todo em branco fica de fora; o que foi preenchido continua conferido.
   */
  options: { optional?: boolean } = {},
): ContactIssue[] {
  const emails = new Set(
    sellers.map((s) => emailComparable(s.email)).filter(Boolean),
  );
  const phones = new Set(
    sellers.map((s) => phoneComparable(s.phone)).filter((p) => p.length >= 8),
  );
  const issues: ContactIssue[] = [];
  const check = (role: ContactRole, entry: ContactEntry, index?: number) => {
    if (options.optional && isBlankContact(entry)) return;
    const at = index === undefined ? {} : { index };
    const phone = phoneDigits(entry.phone);
    const email = emailComparable(entry.email);
    if (!phone) issues.push({ role, field: "phone", code: "required", ...at });
    else if (phone.length < 10 || phone.length > 13)
      issues.push({ role, field: "phone", code: "invalid_phone", ...at });
    else if (phones.has(phoneComparable(entry.phone)))
      issues.push({ role, field: "phone", code: "same_as_seller", ...at });
    if (!email) issues.push({ role, field: "email", code: "required", ...at });
    else if (!EMAIL_RE.test(email) || email.length > 160)
      issues.push({ role, field: "email", code: "invalid_email", ...at });
    else if (emails.has(email))
      issues.push({ role, field: "email", code: "same_as_seller", ...at });
  };
  for (const role of CONTACT_ROLES) {
    check(role, contacts[role]);
    (contacts.more?.[role] ?? []).forEach((entry, i) => check(role, entry, i));
  }
  return issues;
}

/** Contato sem telefone nem e-mail. */
export const isBlankContact = (entry: ContactEntry) =>
  !entry.phone.trim() && !entry.email.trim();

/** Nenhum contato preenchido (o primeiro de cada área e os extras). */
export const allContactsBlank = (contacts: CustomerContacts) =>
  CONTACT_ROLES.every(
    (role) =>
      isBlankContact(contacts[role]) &&
      (contacts.more?.[role] ?? []).every(isBlankContact),
  );

/** Os contatos limpos para gravar (telefone como digitado, e-mail em minúsculas). */
export function cleanContacts(contacts: CustomerContacts): CustomerContacts {
  const out = {} as CustomerContacts;
  const clean = (entry: ContactEntry): ContactEntry => ({
    phone: entry.phone.replace(/\s+/g, " ").trim().slice(0, 40),
    email: emailComparable(entry.email),
  });
  const more: Partial<Record<ContactRole, ContactEntry[]>> = {};
  for (const role of CONTACT_ROLES) {
    out[role] = clean(contacts[role]);
    const extra = (contacts.more?.[role] ?? [])
      .slice(0, MAX_EXTRA_CONTACTS)
      .map(clean);
    if (extra.length) more[role] = extra;
  }
  if (Object.keys(more).length) out.more = more;
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
  const rawMore = (value as Record<string, unknown>).more;
  if (rawMore && typeof rawMore === "object") {
    const more: Partial<Record<ContactRole, ContactEntry[]>> = {};
    for (const role of CONTACT_ROLES) {
      const list = (rawMore as Record<string, unknown>)[role];
      if (!Array.isArray(list)) continue;
      const entries = list
        .filter(
          (e): e is Record<string, unknown> => !!e && typeof e === "object",
        )
        .slice(0, MAX_EXTRA_CONTACTS)
        .map((e) => ({
          phone: typeof e.phone === "string" ? e.phone : "",
          email: typeof e.email === "string" ? e.email : "",
        }));
      if (entries.length) more[role] = entries;
    }
    if (Object.keys(more).length) out.more = more;
  }
  return out;
}

/**
 * Os contatos do bloco "Cliente" a partir dos campos: o primeiro de cada área
 * em `contact.<área>.<campo>` e os demais em `contact.<área>.<n>.<campo>`
 * (n = 1, 2…, na ordem do número).
 */
export function contactsFromEntries(
  get: (key: string) => string,
  keys: Iterable<string>,
): CustomerContacts {
  const out = {} as CustomerContacts;
  const more: Partial<Record<ContactRole, ContactEntry[]>> = {};
  const all = [...keys];
  for (const role of CONTACT_ROLES) {
    out[role] = {
      phone: get(`contact.${role}.phone`),
      email: get(`contact.${role}.email`),
    };
    const re = new RegExp(`^contact\\.${role}\\.(\\d{1,3})\\.(phone|email)$`);
    const ids = [
      ...new Set(
        all.map((k) => re.exec(k)?.[1]).filter((v): v is string => !!v),
      ),
    ].sort((a, b) => Number(a) - Number(b));
    const extra = ids
      .map((n) => ({
        phone: get(`contact.${role}.${n}.phone`),
        email: get(`contact.${role}.${n}.email`),
      }))
      .filter((e) => e.phone.trim() || e.email.trim())
      .slice(0, MAX_EXTRA_CONTACTS);
    if (extra.length) more[role] = extra;
  }
  if (Object.keys(more).length) out.more = more;
  return out;
}

/**
 * Previsão de venda gravada no envio (`requests.priceForecast`; dono,
 * 18/11/2026, totais de Encomendas): a mesma cotação V2 do Sankhya que a
 * Nova solicitação mostra no "Valor total", recalculada pelo servidor (o
 * número do navegador não é aceito). Natureza: venda ao cliente, em R$.
 */
export interface RequestPriceForecast {
  /** Preço por peça ao cliente final (com frete; WD com frete no formato WD). */
  unitPrice: number;
  /** Peças da conta (o total da solicitação). */
  pieces: number;
  /** Preço × peças. */
  total: number;
  currency: "BRL";
  /** Coluna da cotação V2: com frete (referência) ou WD com frete. */
  basis: "with_freight" | "wd_with_freight";
  saleFormat: SaleFormat | null;
  wellmixTier: WellmixTier | null;
  carrierCaller: CarrierCaller | null;
  /** Frete de entrega enviado (R$, total: o digitado ou o padrão). */
  deliveryFreightBrl: number | null;
  /** Situação da cotação (STATUS_COTACAO: PRONTA, FRETE_PENDENTE…). */
  status: string | null;
  /** Quando foi calculada (ISO). */
  at: string;
}

/** Forma de pagamento na solicitação (cópia; dono, 16/11/2026). */
export interface RequestPaymentPlan {
  planId: string;
  name: string;
  installments: Array<{
    percent: number;
    event: "order" | "shipment" | "cargo_presence" | "delivery";
    days: number;
  }>;
  monthlyInterestPercent: number | null;
  requiresApproval: boolean;
}
