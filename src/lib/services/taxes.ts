import "server-only";

import {
  getStore,
  type Product,
  type TaxClassification,
  type TaxSource,
  type User,
} from "@/lib/db";
import { assertRole, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/**
 * Classificação fiscal (NCM) com validação humana.
 *
 * Fluxo: produto + material + características → candidatas (heurística por
 * palavra-chave, despachante, IA quando houver, manual) → validação por
 * usuário autorizado (Wellmix ou despachante). Só a classificação "validated"
 * é copiada para `products.ncm`; sugestão nunca é tratada como definitiva.
 */

interface NcmHint {
  keywords: string[];
  ncm: string;
  description: string;
}

/**
 * Tabela heurística (posições mais comuns nas importações da Wellmix). Sempre
 * confirmar com o despachante: é ponto de partida, nunca classificação final.
 * Palavras latinas casam como palavra inteira (aceitando plural), para
 * "fone" não casar dentro de "telefone"; termos em chinês casam por trecho.
 */
export const NCM_HINTS: NcmHint[] = [
  {
    keywords: ["vidro", "glass", "玻璃", "jarra", "copo", "taça"],
    ncm: "7013.37",
    description: "Objetos de vidro para serviço de mesa ou cozinha",
  },
  {
    keywords: ["cerâmica", "porcelana", "ceramic", "陶瓷", "caneca"],
    ncm: "6912.00",
    description: "Louça e artigos de uso doméstico de cerâmica",
  },
  {
    keywords: ["inox", "aço inoxidável", "stainless", "不锈钢"],
    ncm: "7323.93",
    description: "Artigos de uso doméstico de aço inoxidável",
  },
  {
    keywords: [
      "alumínio",
      "aluminium",
      "aluminum",
      "铝",
      "panela",
      "frigideira",
    ],
    ncm: "7615.10",
    description: "Artigos de uso doméstico de alumínio",
  },
  {
    keywords: ["térmica", "thermos", "保温", "garrafa térmica"],
    ncm: "9617.00",
    description: "Garrafas térmicas e recipientes isotérmicos",
  },
  {
    keywords: ["faca", "knife", "菜刀", "刀具"],
    ncm: "8211.91",
    description: "Facas de mesa e de cozinha",
  },
  {
    keywords: ["talher", "talheres", "garfo", "colher", "cutlery", "餐具"],
    ncm: "8215.99",
    description: "Colheres, garfos e demais talheres",
  },
  {
    keywords: ["plástico", "pvc", "polipropileno", "plastic", "塑料", "pote"],
    ncm: "3924.10",
    description: "Serviços de mesa e utensílios de cozinha de plástico",
  },
  {
    keywords: ["silicone", "硅胶"],
    ncm: "3924.10",
    description: "Utensílios de plástico/silicone para cozinha",
  },
  {
    keywords: ["bambu", "bamboo", "竹"],
    ncm: "4419.11",
    description: "Artigos de mesa ou cozinha de bambu",
  },
  {
    keywords: ["madeira", "wood", "木"],
    ncm: "4419.90",
    description: "Artigos de mesa ou cozinha de madeira",
  },
  {
    keywords: ["algodão", "tecido", "toalha", "cotton", "棉", "毛巾"],
    ncm: "6302.60",
    description: "Roupas de toucador ou cozinha de algodão",
  },
  {
    keywords: ["balança", "scale", "秤"],
    ncm: "8423.10",
    description: "Balanças de uso doméstico e pessoal",
  },
  {
    keywords: ["brinquedo", "boneca", "toy", "doll", "玩具", "娃娃"],
    ncm: "9503.00",
    description: "Brinquedos, bonecos e modelos reduzidos",
  },
  {
    keywords: ["inflável", "piscina", "boia", "inflatable", "充气", "游泳池"],
    ncm: "9506.99",
    description: "Artigos para esporte e recreação ao ar livre (infláveis)",
  },
  {
    keywords: ["bola", "ball", "足球", "篮球", "排球"],
    ncm: "9506.62",
    description: "Bolas infláveis para esporte",
  },
  {
    keywords: ["haltere", "dumbbell", "哑铃"],
    ncm: "9506.91",
    description: "Artigos e equipamentos para ginástica",
  },
  {
    keywords: ["bicicleta", "bike", "bicycle", "自行车"],
    ncm: "8712.00",
    description: "Bicicletas",
  },
  {
    keywords: ["patinete elétrico", "scooter elétrico", "电动滑板车"],
    ncm: "8711.60",
    description: "Veículos com motor elétrico (patinetes)",
  },
  {
    keywords: ["guarda-chuva", "sombrinha", "umbrella", "雨伞"],
    ncm: "6601.91",
    description: "Guarda-chuvas e sombrinhas",
  },
  {
    keywords: [
      "celular",
      "smartphone",
      "telefone celular",
      "telemóvel",
      "mobile phone",
      "cellphone",
      "iphone",
      "手机",
      "智能手机",
    ],
    ncm: "8517.13",
    description: "Telefones inteligentes (smartphones)",
  },
  {
    keywords: ["smartwatch", "relógio inteligente", "smart watch", "智能手表"],
    ncm: "8517.62",
    description: "Aparelhos para recepção e transmissão de dados (smartwatch)",
  },
  {
    keywords: ["tablet", "ipad", "平板"],
    ncm: "8471.30",
    description: "Computadores portáteis (tablets e notebooks)",
  },
  {
    keywords: ["notebook", "laptop", "笔记本电脑"],
    ncm: "8471.30",
    description: "Computadores portáteis (tablets e notebooks)",
  },
  {
    keywords: ["teclado", "keyboard", "mouse", "键盘", "鼠标"],
    ncm: "8471.60",
    description: "Unidades de entrada (teclados e mouses)",
  },
  {
    keywords: ["monitor", "显示器"],
    ncm: "8528.52",
    description: "Monitores para computador",
  },
  {
    keywords: ["televisor", "televisão", "smart tv", "电视"],
    ncm: "8528.72",
    description: "Aparelhos receptores de televisão",
  },
  {
    keywords: ["carregador", "charger", "fonte de alimentação", "充电器"],
    ncm: "8504.40",
    description: "Carregadores e fontes (conversores estáticos)",
  },
  {
    keywords: ["cabo usb", "cabo de dados", "usb cable", "数据线", "充电线"],
    ncm: "8544.42",
    description: "Cabos elétricos com conectores",
  },
  {
    keywords: [
      "power bank",
      "powerbank",
      "bateria externa",
      "carregador portátil",
      "充电宝",
    ],
    ncm: "8507.60",
    description: "Acumuladores de íon de lítio (baterias externas)",
  },
  {
    keywords: ["bateria de lítio", "lithium battery", "锂电池"],
    ncm: "8507.60",
    description: "Acumuladores de íon de lítio",
  },
  {
    keywords: ["capinha", "capa de celular", "phone case", "手机壳"],
    ncm: "3926.90",
    description: "Capas e acessórios de plástico",
  },
  {
    keywords: [
      "película",
      "protetor de tela",
      "vidro temperado",
      "screen protector",
      "钢化膜",
    ],
    ncm: "7007.19",
    description: "Vidro temperado (películas de proteção)",
  },
  {
    keywords: [
      "pendrive",
      "pen drive",
      "cartão de memória",
      "memory card",
      "U盘",
      "内存卡",
    ],
    ncm: "8523.51",
    description: "Dispositivos de armazenamento semicondutor",
  },
  {
    keywords: ["câmera", "camera", "webcam", "摄像头", "相机"],
    ncm: "8525.89",
    description: "Câmeras de vídeo e fotográficas digitais",
  },
  {
    keywords: ["drone", "无人机"],
    ncm: "8806.22",
    description: "Aeronaves não tripuladas (drones)",
  },
  {
    keywords: [
      "tomada",
      "adaptador de tomada",
      "extensão elétrica",
      "benjamim",
      "插座",
    ],
    ncm: "8536.69",
    description: "Tomadas e plugues elétricos",
  },
  {
    keywords: ["caixa de som", "speaker", "alto-falante", "音箱"],
    ncm: "8518.22",
    description: "Alto-falantes e caixas de som",
  },
  {
    keywords: [
      "fone",
      "fones",
      "fone de ouvido",
      "headphone",
      "headset",
      "earphone",
      "earbuds",
      "耳机",
    ],
    ncm: "8518.30",
    description: "Fones de ouvido",
  },
  {
    keywords: ["led", "lâmpada", "luminária", "lamp", "灯"],
    ncm: "9405.11",
    description: "Luminárias e aparelhos de iluminação",
  },
  {
    keywords: ["lanterna", "flashlight", "手电筒"],
    ncm: "8513.10",
    description: "Lanternas portáteis",
  },
  {
    keywords: ["ventilador", "fan", "风扇"],
    ncm: "8414.51",
    description: "Ventiladores domésticos",
  },
  {
    keywords: ["liquidificador", "blender", "搅拌机", "榨汁机"],
    ncm: "8509.40",
    description: "Liquidificadores e processadores de alimentos",
  },
  {
    keywords: ["air fryer", "fritadeira elétrica", "空气炸锅"],
    ncm: "8516.60",
    description: "Fornos e fritadeiras elétricas",
  },
  {
    keywords: ["cafeteira", "coffee maker", "咖啡机"],
    ncm: "8516.71",
    description: "Aparelhos para preparar café ou chá",
  },
  {
    keywords: ["chaleira elétrica", "kettle", "电热水壶"],
    ncm: "8516.10",
    description: "Aquecedores elétricos de água",
  },
  {
    keywords: ["aspirador", "vacuum cleaner", "吸尘器"],
    ncm: "8508.11",
    description: "Aspiradores de pó",
  },
  {
    keywords: ["ferro de passar", "电熨斗"],
    ncm: "8516.40",
    description: "Ferros elétricos de passar",
  },
  {
    keywords: ["secador de cabelo", "hair dryer", "吹风机"],
    ncm: "8516.31",
    description: "Secadores de cabelo",
  },
  {
    keywords: ["chapinha", "prancha de cabelo", "hair straightener", "直发器"],
    ncm: "8516.32",
    description: "Aparelhos para arrumar o cabelo",
  },
  {
    keywords: ["mochila", "bolsa", "backpack", "bag", "背包", "包"],
    ncm: "4202.92",
    description: "Bolsas, mochilas e artigos semelhantes",
  },
  {
    keywords: ["carteira", "wallet", "钱包"],
    ncm: "4202.31",
    description: "Carteiras e artigos de bolso",
  },
  {
    keywords: ["camiseta", "t-shirt", "tshirt", "T恤"],
    ncm: "6109.10",
    description: "Camisetas de malha de algodão",
  },
  {
    keywords: ["meia", "socks", "袜子"],
    ncm: "6115.95",
    description: "Meias de malha de algodão",
  },
  {
    keywords: ["boné", "chapéu", "cap", "hat", "帽子"],
    ncm: "6505.00",
    description: "Chapéus e bonés",
  },
  {
    keywords: ["tênis", "sneaker", "运动鞋"],
    ncm: "6404.11",
    description: "Calçados esportivos com parte superior têxtil",
  },
  {
    keywords: ["chinelo", "sandália", "slipper", "flip flop", "拖鞋"],
    ncm: "6402.20",
    description: "Calçados de borracha ou plástico (chinelos)",
  },
  {
    keywords: ["óculos de sol", "sunglasses", "太阳镜"],
    ncm: "9004.10",
    description: "Óculos de sol",
  },
  {
    keywords: ["relógio de pulso", "wristwatch", "腕表", "石英表"],
    ncm: "9102.11",
    description: "Relógios de pulso",
  },
  {
    keywords: ["bijuteria", "brinco", "colar", "pulseira", "jewelry", "首饰"],
    ncm: "7117.19",
    description: "Bijuterias de metal comum",
  },
  {
    keywords: ["maquiagem", "makeup", "化妆品"],
    ncm: "3304.99",
    description: "Produtos de beleza e maquiagem",
  },
  {
    keywords: ["batom", "lipstick", "口红"],
    ncm: "3304.10",
    description: "Produtos de maquiagem para os lábios",
  },
  {
    keywords: ["esmalte", "nail polish", "指甲油"],
    ncm: "3304.30",
    description: "Preparações para manicuros",
  },
  {
    keywords: ["perfume", "香水"],
    ncm: "3303.00",
    description: "Perfumes e águas-de-colônia",
  },
  {
    keywords: ["escova de dentes", "toothbrush", "牙刷"],
    ncm: "9603.21",
    description: "Escovas de dentes",
  },
  {
    keywords: ["escova de cabelo", "hairbrush", "梳子"],
    ncm: "9603.29",
    description: "Escovas de cabelo e de toucador",
  },
  {
    keywords: ["cadeira", "chair", "椅子"],
    ncm: "9401.79",
    description: "Assentos e cadeiras",
  },
  {
    keywords: ["mesa", "table", "桌子"],
    ncm: "9403.60",
    description: "Móveis de madeira (mesas)",
  },
  {
    keywords: ["travesseiro", "almofada", "pillow", "cushion", "枕头"],
    ncm: "9404.90",
    description: "Travesseiros e almofadas",
  },
  {
    keywords: ["tapete", "carpet", "rug", "地毯"],
    ncm: "5703.39",
    description: "Tapetes e revestimentos de piso",
  },
  {
    keywords: ["cortina", "curtain", "窗帘"],
    ncm: "6303.92",
    description: "Cortinas de fibras sintéticas",
  },
  {
    keywords: ["caderno", "agenda", "笔记本"],
    ncm: "4820.20",
    description: "Cadernos",
  },
  {
    keywords: ["caneta", "pen", "圆珠笔", "钢笔"],
    ncm: "9608.10",
    description: "Canetas esferográficas",
  },
  {
    keywords: ["lápis", "pencil", "铅笔"],
    ncm: "9609.10",
    description: "Lápis",
  },
  {
    keywords: ["caixa de papelão", "cardboard box", "纸箱"],
    ncm: "4819.10",
    description: "Caixas de papel ou cartão ondulado",
  },
  {
    keywords: ["sacola plástica", "plastic bag", "塑料袋"],
    ncm: "3923.21",
    description: "Sacos e sacolas de plástico",
  },
  {
    keywords: ["chave de fenda", "screwdriver", "螺丝刀"],
    ncm: "8205.40",
    description: "Chaves de fenda",
  },
  {
    keywords: ["alicate", "pliers", "钳子"],
    ncm: "8203.20",
    description: "Alicates",
  },
  {
    keywords: ["furadeira", "parafusadeira", "drill", "电钻"],
    ncm: "8467.21",
    description: "Furadeiras elétricas manuais",
  },
  {
    keywords: ["parafuso", "screw", "螺钉"],
    ncm: "7318.15",
    description: "Parafusos de ferro ou aço",
  },
  {
    keywords: ["amortecedor", "shock absorber", "减震器"],
    ncm: "8708.80",
    description: "Amortecedores e sistemas de suspensão para veículos",
  },
  {
    keywords: ["pastilha de freio", "brake pad", "刹车片"],
    ncm: "8708.30",
    description: "Freios e suas partes para veículos",
  },
  {
    keywords: ["farol", "headlight", "车灯"],
    ncm: "8512.20",
    description: "Aparelhos de iluminação para veículos",
  },
  {
    keywords: ["pneu", "tire", "tyre", "轮胎"],
    ncm: "4011.10",
    description: "Pneus novos para automóveis",
  },
  {
    keywords: ["coleira", "guia para cachorro", "dog leash", "狗绳"],
    ncm: "4201.00",
    description: "Artigos para animais (coleiras e guias)",
  },
];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Termo em chinês/japonês: sem espaços entre palavras, casa por trecho. */
const isCjk = (s: string) => /[\u3000-\u9fff]/.test(s);

/** A palavra-chave aparece no texto (palavra inteira, com plural opcional; CJK por trecho). */
export function keywordMatches(text: string, keyword: string): boolean {
  const k = fold(keyword);
  if (isCjk(k)) return text.includes(k);
  return new RegExp(`(^|[^a-z0-9])${escapeRe(k)}(s|es)?([^a-z0-9]|$)`).test(
    text,
  );
}

/** Candidatas por palavra-chave a partir de nome, material, categoria e especificação. Nunca definitivo. */
export function suggestNcm(
  product: Pick<Product, "name" | "material" | "category" | "specification">,
): Array<{ ncm: string; description: string; matched: string[] }> {
  const text = fold(
    [product.name, product.material, product.category, product.specification]
      .filter(Boolean)
      .join(" "),
  );
  const out: Array<{ ncm: string; description: string; matched: string[] }> =
    [];
  for (const hint of NCM_HINTS) {
    const matched = hint.keywords.filter((k) => keywordMatches(text, k));
    if (matched.length === 0) continue;
    const existing = out.find((o) => o.ncm === hint.ncm);
    if (existing) existing.matched.push(...matched);
    else out.push({ ncm: hint.ncm, description: hint.description, matched });
  }
  // Mais palavras casadas primeiro.
  return out.sort((a, b) => b.matched.length - a.matched.length);
}

export function listTaxClassifications(productId: string) {
  return getStore().list("tax_classifications", {
    filter: { productId },
    orderBy: "createdAt",
    direction: "desc",
  });
}

const canValidate = (user: User) => isWellmix(user) || user.role === "broker";

export async function addTaxCandidate(
  user: User,
  productId: string,
  input: {
    ncm: string;
    description?: string | null;
    taxes?: Record<string, number> | null;
    adminTreatment?: string | null;
    notes?: string | null;
    source: TaxSource;
    sourceRef?: string | null;
  },
): Promise<TaxClassification> {
  assertRole(user, ["admin", "operator", "broker"]);
  const ncm = input.ncm.replace(/[^\d.]/g, "");
  if (!/^\d{4}(\.\d{2}){0,2}$/.test(ncm) && !/^\d{8}$/.test(ncm))
    throw new Error("invalid_ncm");
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new Error("product_not_found");
  const row = await store.create("tax_classifications", {
    productId,
    ncm,
    description: input.description ?? null,
    taxes: input.taxes ?? null,
    adminTreatment: input.adminTreatment ?? null,
    notes: input.notes ?? null,
    source: input.source,
    sourceRef: input.sourceRef ?? null,
    status: "suggested",
    suggestedByUserId: user.id,
    validatedByUserId: null,
    validatedAt: null,
  });
  await audit(
    user,
    "tax.suggest",
    "product",
    productId,
    `NCM ${ncm} (${input.source})`,
  );
  return row;
}

/**
 * Gera candidatas que ainda não existem para o produto: primeiro a tabela de
 * palavras-chave; sem nenhuma palavra reconhecida, a IA (só no modo API, com
 * chave configurada; o modo mock nunca inventa NCM). Tudo entra como
 * "sugerida" e depende de validação humana.
 */
export async function suggestTaxCandidates(user: User, productId: string) {
  assertRole(user, ["admin", "operator", "broker"]);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new Error("product_not_found");
  const existing = await listTaxClassifications(productId);
  const created: TaxClassification[] = [];
  const heuristic = suggestNcm(product);
  for (const s of heuristic) {
    if (existing.some((e) => e.ncm === s.ncm)) continue;
    created.push(
      await addTaxCandidate(user, productId, {
        ncm: s.ncm,
        description: s.description,
        source: "heuristic",
        sourceRef: `palavras: ${[...new Set(s.matched)].join(", ")}`,
      }),
    );
  }
  if (heuristic.length === 0) {
    for (const s of await suggestNcmWithAi(product)) {
      if (existing.concat(created).some((e) => e.ncm === s.ncm)) continue;
      try {
        created.push(
          await addTaxCandidate(user, productId, {
            ncm: s.ncm,
            description: s.description,
            notes: s.reason,
            source: "ai",
            sourceRef: `IA · ${s.model}`,
          }),
        );
      } catch {
        // NCM mal formado vindo da IA: descartado (nunca vira candidata).
      }
    }
  }
  return created;
}

/** Candidatas sugeridas pela IA (modo API). Vazio sem chave, no modo mock ou em erro. */
async function suggestNcmWithAi(product: Product) {
  const [{ getSettings }, { getAiAdapter }, { buildPrompt }] =
    await Promise.all([
      import("@/lib/settings"),
      import("@/lib/integrations/ai"),
      import("@/lib/ai/prompts"),
    ]);
  const adapter = getAiAdapter(await getSettings());
  if (adapter.mode !== "api") return [];
  const line = await getStore().get("product_lines", product.lineId);
  try {
    const result = await adapter.complete(
      buildPrompt("ncm", { line, product }),
    );
    const list = Array.isArray(result?.json?.candidates)
      ? (result.json.candidates as unknown[])
      : [];
    return list
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c.ncm === "string")
      .slice(0, 3)
      .map((c) => ({
        ncm: String(c.ncm),
        description:
          typeof c.description === "string"
            ? c.description.slice(0, 500)
            : null,
        reason: typeof c.reason === "string" ? c.reason.slice(0, 1000) : null,
        model: adapter.model ?? "api",
      }));
  } catch {
    return [];
  }
}

/** Validação humana: uma única classificação validada por produto; a anterior volta a candidata. */
export async function validateTaxClassification(user: User, id: string) {
  if (!canValidate(user)) throw new Error("forbidden");
  const store = getStore();
  const row = await store.get("tax_classifications", id);
  if (!row) throw new Error("not_found");
  const siblings = await listTaxClassifications(row.productId);
  for (const s of siblings) {
    if (s.id !== id && s.status === "validated")
      await store.update("tax_classifications", s.id, {
        status: "suggested",
        notes: [s.notes, "Substituída por outra classificação validada."]
          .filter(Boolean)
          .join("\n"),
      });
  }
  const now = new Date().toISOString();
  const updated = await store.update("tax_classifications", id, {
    status: "validated",
    validatedByUserId: user.id,
    validatedAt: now,
  });
  await store.update("products", row.productId, { ncm: row.ncm });
  await audit(
    user,
    "tax.validate",
    "product",
    row.productId,
    `NCM ${row.ncm} validado`,
  );
  return updated;
}

export async function rejectTaxClassification(
  user: User,
  id: string,
  note?: string | null,
) {
  if (!canValidate(user)) throw new Error("forbidden");
  const store = getStore();
  const row = await store.get("tax_classifications", id);
  if (!row) throw new Error("not_found");
  const updated = await store.update("tax_classifications", id, {
    status: "rejected",
    notes: note ?? row.notes,
    validatedByUserId: user.id,
    validatedAt: new Date().toISOString(),
  });
  if (row.status === "validated") {
    const product = await store.get("products", row.productId);
    if (product?.ncm === row.ncm)
      await store.update("products", row.productId, { ncm: null });
  }
  await audit(
    user,
    "tax.reject",
    "product",
    row.productId,
    `NCM ${row.ncm} rejeitado`,
  );
  return updated;
}
