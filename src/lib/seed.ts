import "server-only";

import {
  getStore,
  PARTY_EXTRA_DEFAULTS,
  PRODUCT_EXTRA_DEFAULTS,
  USER_EXTRA_DEFAULTS,
  LINE_EXTRA_DEFAULTS,
  type LinePrompts,
  type OperationMode,
  type RadarStatus,
  type Product,
  type Role,
  type User,
} from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_PREPARATION_REQUIREMENTS } from "@/lib/workflow/stages";
import { boxCbm } from "@/lib/logistics/cbm";

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
    email: "juridico@wellmix.com",
    name: "Júlia Jurídico",
    role: "legal",
    party: null,
    locale: "pt",
  },
];

/** Cria usuários, parceiros, linhas e produtos de demonstração. Idempotente. */
export async function seedDemo(): Promise<{ created: boolean; users: User[] }> {
  const store = getStore();
  const existing = await store.list("users", { limit: 1 });
  if (existing.length > 0) {
    return { created: false, users: await store.list("users") };
  }

  const parties: Array<{
    id: string;
    type: Role | "shipping_line";
    name: string;
    country: string;
    email: string;
    city?: string;
    contactName?: string;
    wechat?: string | null;
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
  ];
  for (const party of parties) {
    await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      id: party.id,
      type: party.type as never,
      name: party.name,
      country: party.country,
      email: party.email,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
      city: party.city ?? null,
      contactName: party.contactName ?? null,
      wechat: party.wechat ?? null,
      operationMode: party.operationMode ?? null,
      radar: party.radar ?? null,
    });
  }

  const passwordHash =
    store.mode === "memory" ? hashPassword(DEMO_PASSWORD) : null;
  const users: User[] = [];
  for (const u of DEMO_USERS) {
    if (store.mode === "appwrite") {
      // Autenticação fica no Appwrite Auth; a tabela users guarda papel e parceiro.
      const { createAdminClient } = await import("@/lib/appwrite/server");
      const { users: authUsers } = createAdminClient();
      await authUsers
        .create({
          userId: "unique()",
          email: u.email,
          password: DEMO_PASSWORD,
          name: u.name,
        })
        .catch(() => undefined);
    }
    users.push(
      await store.create("users", {
        ...USER_EXTRA_DEFAULTS,
        email: u.email,
        name: u.name,
        role: u.role,
        partyId: u.party,
        locale: u.locale,
        passwordHash,
        active: true,
      }),
    );
  }

  // Brinquedos e infláveis exigem Inmetro; utilidades (usada pelo E2E) não exige nada.
  const lines: Array<{
    id: string;
    name: string;
    requirements: typeof DEFAULT_PREPARATION_REQUIREMENTS;
    requiredCertifications?: string[];
    prompts?: LinePrompts;
  }> = [
    {
      id: "linha-utilidades",
      name: "Utilidades domésticas",
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      // Prompts por linha (Visão de Produto): base + linha + produto + contexto.
      prompts: {
        descriptionPrompt:
          "Utilidades domésticas para o varejo brasileiro: destaque uso, capacidade e material; nada de promessas técnicas.",
        marketingPrompt:
          "Tom prático e acolhedor, foco em praticidade no dia a dia da casa.",
        imagePrompt: "Ambiente de cozinha clara, produto em primeiro plano.",
        requiredAttributes: ["material", "cor", "dimensões"],
        validationRules: ["Não citar marcas de terceiros"],
      },
    },
    {
      id: "linha-brinquedos",
      name: "Brinquedos",
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      requiredCertifications: ["Inmetro"],
    },
    {
      id: "linha-inflaveis",
      name: "Infláveis",
      requirements: DEFAULT_PREPARATION_REQUIREMENTS,
      requiredCertifications: ["Inmetro"],
    },
  ];
  for (const line of lines) {
    await store.create("product_lines", {
      ...LINE_EXTRA_DEFAULTS,
      id: line.id,
      name: line.name,
      manualDocumentId: null,
      requirements: line.requirements,
      requiredCertifications: line.requiredCertifications ?? null,
      prompts: line.prompts ?? null,
      active: true,
    });
  }
  // A jarra fica sem ficha completa de propósito: o E2E usa esse produto e a
  // inspeção só compara atributos presentes no snapshot da compra.
  const products: Array<
    { id: string; lineId: string; name: string; sku: string } & Partial<Product>
  > = [
    {
      id: "prod-jarra",
      lineId: "linha-utilidades",
      name: "Jarra de vidro 1,5 L",
      sku: "UTL-001",
    },
    {
      id: "prod-panela",
      lineId: "linha-utilidades",
      name: "Jogo de panelas antiaderentes 5 pçs",
      sku: "UTL-002",
      supplierId: "fornecedor-a",
      supplierSku: "SZA-PAN5",
      category: "Cozinha",
      material: "Alumínio com revestimento antiaderente",
      color: "Preto",
      pantone: "Black 6 C",
      moq: 500,
      price: 9.5,
      currency: "USD",
      masterBoxQty: 4,
      innerBoxQty: 1,
      netWeightKg: 2.4,
      grossWeightKg: 2.9,
      lengthCm: 30,
      widthCm: 30,
      heightCm: 20,
      boxLengthCm: 62,
      boxWidthCm: 32,
      boxHeightCm: 42,
      source: "sourcing",
      priceTiers: [
        { minQty: 500, price: 9.5 },
        { minQty: 1000, price: 8.9 },
        { minQty: 2000, price: 8.2 },
      ],
    },
    {
      id: "prod-boneca",
      lineId: "linha-brinquedos",
      name: "Boneca articulada 30 cm",
      sku: "BRQ-001",
      supplierId: "fornecedor-b",
      supplierSku: "GZB-DOLL30",
      category: "Bonecas",
      material: "PVC atóxico",
      color: "Sortido",
      moq: 2000,
      price: 3.2,
      currency: "USD",
      masterBoxQty: 48,
      innerBoxQty: 6,
      netWeightKg: 0.28,
      grossWeightKg: 0.35,
      lengthCm: 12,
      widthCm: 8,
      heightCm: 32,
      boxLengthCm: 52,
      boxWidthCm: 34,
      boxHeightCm: 68,
      source: "import",
      priceTiers: [
        { minQty: 2000, price: 3.2 },
        { minQty: 5000, price: 2.95 },
      ],
    },
    {
      id: "prod-piscina",
      lineId: "linha-inflaveis",
      name: "Piscina inflável 2.000 L",
      sku: "INF-001",
      supplierId: "fornecedor-c",
      category: "Lazer",
      material: "PVC 0,4 mm",
      color: "Azul",
      moq: 300,
      price: 14.8,
      currency: "USD",
      masterBoxQty: 6,
      netWeightKg: 3.1,
      grossWeightKg: 3.6,
      boxLengthCm: 60,
      boxWidthCm: 40,
      boxHeightCm: 50,
      source: "manual",
    },
  ];
  for (const product of products) {
    const { id, lineId, name, sku, ...sheet } = product;
    await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      id,
      lineId,
      name,
      sku,
      specification: null,
      active: true,
      source: "manual",
      ...sheet,
      cbm: boxCbm(sheet),
    });
  }

  // A boneca tem Inmetro válido; a piscina (linha que exige) não tem: mostra o gate de conformidade.
  await store.create("certifications", {
    entity: "product",
    entityId: "prod-boneca",
    kind: "Inmetro",
    name: "Certificado de conformidade Inmetro",
    issuer: "OCP credenciado",
    number: "INMETRO-2026-0421",
    validUntil: new Date(Date.now() + 300 * 86400000).toISOString(),
    documentId: null,
    status: "valid",
    notes: null,
    createdByUserId: users[0].id,
    validatedByUserId: users[0].id,
    validatedAt: new Date().toISOString(),
  });

  // Sourcing de demonstração: uma visita e um produto encontrado ainda não promovido.
  const visit = await store.create("supplier_visits", {
    id: "visita-canton",
    supplierId: "fornecedor-c",
    supplierName: "Ningbo Supplier C",
    factoryName: "Fábrica de plásticos de Ningbo",
    city: "Guangzhou",
    address: null,
    location: "Feira de Cantão, pavilhão 3",
    visitedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    participants: "Ana Admin, Otávio Operador",
    notes: "Bom padrão de acabamento; negociar MOQ menor na próxima rodada.",
    nextVisitAt: new Date(Date.now() + 40 * 86400000).toISOString(),
    followUp: "Pedir amostra da boia infantil e proposta com MOQ 200.",
    status: "done",
    createdByUserId: users[0].id,
  });
  await store.create("sourcing_items", {
    id: "sourcing-boia",
    visitId: visit.id,
    supplierId: "fornecedor-c",
    supplierName: "Ningbo Supplier C",
    productId: null,
    lineId: "linha-inflaveis",
    category: "Lazer",
    name: "Boia infantil com cobertura solar",
    description: "Boia com assento e cobertura removível, 0-2 anos.",
    supplierSku: "NBC-FLT02",
    material: "PVC 0,3 mm",
    color: "Amarelo",
    pantone: "Yellow C",
    price: 4.1,
    currency: "USD",
    moq: 500,
    masterBoxQty: 24,
    innerBoxQty: 6,
    netWeightKg: 0.45,
    grossWeightKg: 0.55,
    widthCm: 70,
    heightCm: 25,
    lengthCm: 70,
    boxLengthCm: 55,
    boxWidthCm: 45,
    boxHeightCm: 40,
    cbm: boxCbm({ boxLengthCm: 55, boxWidthCm: 45, boxHeightCm: 40 }),
    conditions: "FOB Ningbo, 30% sinal, saldo contra BL",
    notes: "Amostra prometida em 15 dias.",
    foundAt: visit.visitedAt,
    city: "Guangzhou",
    location: "Feira de Cantão, pavilhão 3",
    status: "negotiating",
    primaryPhotoDocumentId: null,
    createdByUserId: users[0].id,
    requestId: null,
    priceTiers: null,
  });

  // Marketing studio: um kit em rascunho para o cliente, alimentado pela ficha da panela.
  await store.create("marketing_kits", {
    id: "kit-panela",
    productId: "prod-panela",
    customerId: "cliente-joao",
    name: "Kit de marketing · Jogo de panelas antiaderentes 5 pçs",
    price: 200,
    currency: "BRL",
    status: "draft",
    concept: null,
    slogan: null,
    description: null,
    campaign: null,
    colors: ["Preto"],
    pantone: "Black 6 C",
    previewDocumentIds: [],
    releasedDocumentIds: [],
    paymentId: null,
    offeredAt: null,
    purchasedAt: null,
    paidAt: null,
    releasedAt: null,
    notes: null,
    createdByUserId: users[0].id,
  });
  return { created: true, users };
}
