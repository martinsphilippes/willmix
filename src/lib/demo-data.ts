import type {
  OperationMode,
  PaymentTermInstallment,
  RadarStatus,
  Role,
} from "./db/schema";

/*
 * Contas de demonstração (logins e empresas), separadas da carga inicial para
 * que o mesmo cadastro sirva ao portal (src/lib/seed.ts) e ao script que cria
 * as contas direto no Appwrite pelo GitHub (scripts/appwrite-demo-accounts.ts).
 * Só dados: nada aqui lê banco nem depende do Next.
 */

/** Senha única de demonstração. Só existe no modo memória. */
export const DEMO_PASSWORD = "wellmix123";

export const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: Role;
  party: string | null;
  locale: "pt" | "en" | "zh";
}> = [
  {
    email: "admin@wellmix.com",
    name: "Ana Admin",
    role: "admin",
    party: null,
    locale: "pt",
  },
  {
    email: "operador@wellmix.com",
    name: "Otávio Operador",
    role: "operator",
    party: null,
    locale: "pt",
  },
  {
    email: "joao@lojista.com",
    name: "João Cliente",
    role: "customer",
    party: "cliente-joao",
    locale: "pt",
  },
  {
    email: "supplier.a@china.com",
    name: "Li Wei",
    role: "supplier",
    party: "fornecedor-a",
    locale: "zh",
  },
  {
    email: "supplier.b@china.com",
    name: "Chen Yu",
    role: "supplier",
    party: "fornecedor-b",
    locale: "en",
  },
  {
    email: "supplier.c@china.com",
    name: "Wang Fang",
    role: "supplier",
    party: "fornecedor-c",
    locale: "zh",
  },
  {
    email: "agencia@design.com",
    name: "Agência Criativa",
    role: "agency",
    party: "agencia",
    locale: "pt",
  },
  {
    email: "despachante@comex.com",
    name: "Diego Despachante",
    role: "broker",
    party: "despachante",
    locale: "pt",
  },
  {
    email: "armador@maritima.com",
    name: "Marítima SA",
    role: "shipping_line",
    party: "armador",
    locale: "en",
  },
  {
    email: "transportadora@rodo.com",
    name: "Trans Rodo",
    role: "carrier",
    party: "transportador",
    locale: "pt",
  },
  {
    email: "comex@assessoria.com",
    name: "Carla Comex",
    role: "comex",
    party: "comex",
    locale: "pt",
  },
  {
    email: "agente@cargo.com",
    name: "Lucas Logística",
    role: "logistics",
    party: "agente-carga",
    locale: "pt",
  },
  {
    email: "ocp@certifica.com",
    name: "Olga OCP",
    role: "ocp",
    party: "ocp",
    locale: "pt",
  },
  {
    email: "juridico@wellmix.com",
    name: "Júlia Jurídico",
    role: "legal",
    party: null,
    locale: "pt",
  },
];

export const DEMO_PARTIES: Array<{
  id: string;
  type: Role | "shipping_line";
  name: string;
  country: string;
  email: string;
  city?: string;
  contactName?: string;
  wechat?: string | null;
  phone?: string;
  storeNumber?: string;
  paymentTerms?: PaymentTermInstallment[];
  operationMode?: OperationMode;
  radar?: RadarStatus;
}> = [
  {
    id: "cliente-joao",
    type: "customer",
    name: "Loja do João Ltda",
    country: "BR",
    email: "joao@lojista.com",
    // Opera via estrutura/trade da Wellmix (não tem RADAR): nenhum gate dispara.
    operationMode: "via_trade",
    radar: "none",
  },
  {
    id: "fornecedor-a",
    type: "supplier",
    name: "Shenzhen Supplier A",
    country: "CN",
    email: "supplier.a@china.com",
    city: "Shenzhen",
    contactName: "Li Wei",
    wechat: "liwei_sz",
    phone: "+86 755 1234 5678",
    storeNumber: "A 154678",
    // Condição de pagamento: 30% no pedido + 70% 90 dias após a entrega.
    paymentTerms: [
      { percent: 30, base: "order_created", days: 0 },
      { percent: 70, base: "delivered", days: 90 },
    ],
  },
  {
    id: "fornecedor-b",
    type: "supplier",
    name: "Guangzhou Supplier B",
    country: "CN",
    email: "supplier.b@china.com",
    city: "Guangzhou",
    contactName: "Chen Yu",
    wechat: null,
  },
  {
    id: "fornecedor-c",
    type: "supplier",
    name: "Ningbo Supplier C",
    country: "CN",
    email: "supplier.c@china.com",
    city: "Ningbo",
    contactName: "Wang Fang",
    wechat: "wangfang_nb",
    paymentTerms: [{ percent: 100, base: "delivered", days: 60 }],
  },
  {
    id: "agencia",
    type: "agency",
    name: "Agência Criativa",
    country: "BR",
    email: "agencia@design.com",
  },
  {
    id: "despachante",
    type: "broker",
    name: "Comex Despachos",
    country: "BR",
    email: "despachante@comex.com",
  },
  {
    id: "armador",
    type: "shipping_line",
    name: "Marítima SA",
    country: "BR",
    email: "armador@maritima.com",
  },
  {
    id: "transportador",
    type: "carrier",
    name: "Trans Rodo",
    country: "BR",
    email: "transportadora@rodo.com",
  },
  {
    id: "comex",
    type: "comex",
    name: "Assessoria Comex",
    country: "BR",
    email: "comex@assessoria.com",
  },
  {
    id: "agente-carga",
    type: "logistics",
    name: "Cargo Agentes de Carga",
    country: "BR",
    email: "agente@cargo.com",
  },
  {
    id: "ocp",
    type: "ocp",
    name: "Certifica OCP",
    country: "BR",
    email: "ocp@certifica.com",
  },
];

export type DemoParty = (typeof DEMO_PARTIES)[number];
export type DemoUser = (typeof DEMO_USERS)[number];

/** Campos da empresa de demonstração como o portal grava (sem os padrões extras do esquema). */
export function demoPartyFields(party: DemoParty) {
  return {
    id: party.id,
    type: party.type,
    name: party.name,
    country: party.country,
    email: party.email,
    phone: party.phone ?? null,
    taxId: null,
    notes: null,
    active: true,
    city: party.city ?? null,
    ...(party.storeNumber ? { storeNumber: party.storeNumber } : {}),
    ...(party.paymentTerms ? { paymentTerms: party.paymentTerms } : {}),
    contactName: party.contactName ?? null,
    wechat: party.wechat ?? null,
    operationMode: party.operationMode ?? null,
    radar: party.radar ?? null,
  };
}

/** Campos do login de demonstração (a senha fica no Appwrite Auth ou, no modo memória, em passwordHash). */
export function demoUserFields(u: DemoUser) {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    partyId: u.party,
    locale: u.locale,
    active: true,
  };
}
