import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Screen } from "@/lib/auth/screens";
import { baseKeyOf, itemIdOf } from "@/lib/purchase-lanes";
import type { StageKey, User } from "@/lib/db/schema";
import { isWellmix } from "@/lib/auth/permissions";

/*
 * Blocos e passos do menu lateral (dono, 14/11/2026; docs/FLOW_MENU.md),
 * na ordem do mapa do processo: Produto novo → Pedido → Produção → Entrega
 * → Vendas. Cada pendência do login cai em um passo só (`flowStepOf`), e o
 * menu mostra quantas esperam ação em cada passo; o Overview do bloco mostra
 * a linha do tempo dos passos com o que espera, o que atrasou e há quantos
 * dias. Regra pura: sem banco, sem tela.
 */

export const FLOW_BLOCKS = [
  "new-product",
  "order",
  "production",
  "delivery",
  "sales",
  "finance",
  "registry",
] as const;
export type FlowBlock = (typeof FLOW_BLOCKS)[number];

export interface FlowStep {
  block: FlowBlock;
  /** Chave do passo, única no bloco (vai no endereço /app/flow/<bloco>/<passo>). */
  key: string;
  /**
   * Tela que já existe para o passo (Book, Revisão, Containers…). Sem ela, o
   * passo tem a tela própria em /app/flow/<bloco>/<passo>.
   */
  href?: string;
  /** Tela que o login precisa abrir para ver o passo no menu. */
  screen: Screen;
  /** Passo que só conta pendências e já está em outro lugar do menu (Financeiro, Cadastros). */
  badgeOnly?: boolean;
}

const s = (
  block: FlowBlock,
  key: string,
  screen: Screen,
  href?: string,
  badgeOnly?: boolean,
): FlowStep => ({ block, key, screen, href, badgeOnly });

/** Os passos de cada bloco, na ordem do mapa. */
export const FLOW_STEPS: FlowStep[] = [
  // Produto novo (Book do mapa).
  s("new-product", "books", "booking", "/app/booking"),
  s("new-product", "selection", "booking", "/app/booking/selection"),
  s("new-product", "quotes", "quotes", "/app/supplier-requests/invites"),
  s("new-product", "negotiations", "quotes", "/app/supplier-requests"),
  // Pedido.
  // Pedidos: o passo em que o pedido é criado (dono, 14/11/2026), com tela
  // própria (a lista /app/orders continua pelo endereço e pelo link da tela).
  s("order", "orders", "orders"),
  s("order", "certification", "orders"),
  s("order", "art-material", "orders"),
  s("order", "art", "orders"),
  s("order", "review", "reviews", "/app/reviews"),
  s("order", "contract", "orders"),
  // Produção.
  s("production", "pre-production", "production"),
  s("production", "inspection", "production"),
  s("production", "sample", "production"),
  s("production", "production", "production"),
  s("production", "booking", "production"),
  s("production", "logistics", "production"),
  s("production", "loading", "production"),
  s("production", "cargo-docs", "production"),
  s("production", "shipment", "production"),
  // Entrega.
  s("delivery", "lpco", "containers"),
  s("delivery", "cargo-presence", "containers"),
  s("delivery", "channel", "containers"),
  s("delivery", "logistics", "containers"),
  s("delivery", "invoice", "containers"),
  s("delivery", "delivery", "containers"),
  s("delivery", "return", "containers"),
  s("delivery", "storage", "containers"),
  // Vendas (Estoque é a tela que já existe).
  s("sales", "stock", "products", "/app/inventory"),
  s("sales", "samples", "products"),
  s("sales", "offers", "products"),
  s("sales", "sale", "products"),
  // Só o contador, no item que já existe.
  s("finance", "finance", "finance", "/app/finance", true),
  s("registry", "products", "products", "/app/products", true),
];

/** Blocos com Overview e telas por passo (os outros são grupos comuns do menu). */
export const FLOW_OVERVIEW_BLOCKS: readonly FlowBlock[] = [
  "new-product",
  "order",
  "production",
  "delivery",
];

/** Endereço do Overview do bloco; o da Produção é a tela que já existia. */
export const overviewHref = (block: FlowBlock) =>
  block === "production" ? "/app/production" : `/app/flow/${block}`;

export const stepHref = (step: FlowStep) =>
  step.href ?? `/app/flow/${step.block}/${step.key}`;

export const stepsOf = (block: FlowBlock) =>
  FLOW_STEPS.filter((x) => x.block === block);

export function findStep(block: string, key: string): FlowStep | undefined {
  return FLOW_STEPS.find((x) => x.block === block && x.key === key);
}

export const isFlowBlock = (v: string): v is FlowBlock =>
  (FLOW_BLOCKS as readonly string[]).includes(v);

export const blockLabelKey = (block: FlowBlock) =>
  `flow.block.${block}` as DictionaryKey;
export const stepLabelKey = (step: Pick<FlowStep, "block" | "key">) =>
  `flow.step.${step.block}.${step.key}` as DictionaryKey;
export const stepHelpKey = (step: Pick<FlowStep, "block" | "key">) =>
  `flow.help.${step.block}.${step.key}` as DictionaryKey;

/** O que a classificação precisa da pendência. */
export interface FlowTaskLike {
  kind: string;
  stageKey?: StageKey | string | null;
  stepKey?: string | null;
  items?: { key: string }[];
}

type Ref = `${FlowBlock}/${string}`;

/** Item de etapa do pedido (requisito) → passo, pela chave sem o item. */
const REQUIREMENT_STEP: Record<string, Ref> = {
  // Criação do pedido e programação.
  order_confirmed: "order/orders",
  erp_number: "order/orders",
  // Material de arte: faca (die cut) e foto em alta, com MOQ e prazo (P4).
  die_cut: "order/art-material",
  hd_photo: "order/art-material",
  moq_confirmed: "order/art-material",
  lead_time_confirmed: "order/art-material",
  // Arte, validação e arte final (P5, P5?, P7).
  art: "order/art",
  art_review: "order/art",
  art_final: "order/art",
  art_approval: "order/art",
  // Certificação com o OCP (P15).
  certificate: "order/certification",
  // Cadastro e fiscal: NCM e ficha mestre (P9, P14).
  ncm_validated: "registry/products",
  sheet_complete: "registry/products",
  purchase_sheet: "registry/products",
  sheet_validated: "registry/products",
  product_registered: "registry/products",
  // Contrato, contratos de amostras e assinatura (P10, P17, P11).
  sample_order: "order/contract",
  sample_order_supplier: "order/contract",
  order_sign_send: "order/contract",
  order_signed_wellmix: "order/contract",
  order_signed_supplier: "order/contract",
  // Sinal ao fornecedor (P12).
  down_payment: "finance/finance",
  // Inspeção: fotos, peso, vídeo, conformidade e aprovação dos SKUs (R3, R4?).
  photo_unpacked: "production/inspection",
  photo_packed: "production/inspection",
  photo_scale: "production/inspection",
  weight_measured: "production/inspection",
  production_video: "production/inspection",
  supplier_conformity: "production/inspection",
  sku_approved: "production/inspection",
  // Embarque (R27).
  ship_date: "production/shipment",
  vessel: "production/shipment",
  shipped: "production/shipment",
  // Despacho e liberação (E7).
  process_number: "delivery/cargo-presence",
  customs_docs: "delivery/cargo-presence",
  estimated_costs: "delivery/cargo-presence",
  actual_costs: "delivery/cargo-presence",
  release: "delivery/cargo-presence",
  // Transporte e entrega (E13–E18).
  plate: "delivery/logistics",
  status_update: "delivery/delivery",
  delivered: "delivery/delivery",
  receipt_confirmed: "delivery/delivery",
};

/** Etapa do pedido → passo, quando o item não diz (ex.: medidas da ficha). */
const STAGE_STEP: Partial<Record<string, Ref>> = {
  ORDER_CREATED: "order/orders",
  PREPARATION: "order/orders",
  PACKAGING: "order/art",
  SUPPLIER_PAYMENT: "finance/finance",
  INSPECTION: "production/inspection",
  SHIPPING: "production/shipment",
  CUSTOMS: "delivery/cargo-presence",
  TRANSPORT: "delivery/logistics",
  DELIVERED: "delivery/delivery",
};

/** Passo do embarque e da importação (import-flow, shipping-docs) → passo. */
function importStep(stepKey: string): Ref | null {
  if (stepKey === "assign" || stepKey.startsWith("cert_"))
    return "order/certification";
  if (stepKey.startsWith("samples_")) return "production/sample";
  if (stepKey.startsWith("shipping_")) return "production/cargo-docs";
  switch (stepKey) {
    case "booking":
      return "production/booking";
    // Compra EXW: transportadora e custos de origem (R17, R18).
    case "origin_carrier":
    case "origin_carrier_eta":
    case "origin_costs":
    case "container_at_factory":
    case "container_empty":
      return "production/logistics";
    case "container_loaded":
    case "container_sealed":
      return "production/loading";
    case "draft_bl":
    case "invoice_packing":
    case "invoice_signed":
    case "bl":
      return "production/cargo-docs";
    case "container_at_port":
    case "container_tracking":
      return "production/shipment";
    case "channel":
      return "delivery/channel";
    case "danfe":
      return "delivery/invoice";
    case "lpco":
      return "delivery/lpco";
    case "cargo_presence":
    case "numerario":
    case "numerario_paid":
    case "di":
    case "ce_mercante":
    case "ci":
      return "delivery/cargo-presence";
    default:
      return null;
  }
}

/** Tipo da pendência → passo (as que não vêm de item de etapa). */
const KIND_STEP: Partial<Record<string, Ref>> = {
  booking_invite: "new-product/quotes",
  sourcing_demand: "new-product/books",
  supplier_request: "new-product/negotiations",
  sampling: "new-product/negotiations",
  sampling_validate: "new-product/negotiations",
  purchase_schedule: "order/orders",
  review: "order/review",
  art_fix: "order/art",
  art_review: "order/art",
  cert_step: "order/certification",
  cert_validate: "order/certification",
  production_follow: "production/production",
  sku_inspection: "production/inspection",
  sku_fix: "production/inspection",
  real_media: "production/sample",
  freight_quote: "production/logistics",
  confirm_receipt: "delivery/delivery",
  supplier_payment: "finance/finance",
  invoice_due: "finance/finance",
  ncm_classify: "registry/products",
  new_request: "sales/sale",
  after_sales: "sales/sale",
  // Recebimento no CD (casos do menu, fora das Pendências; docs/FLOW_MENU.md).
  receiving_storage: "delivery/storage",
  // Pré-produção: sinal pago e a produção sem ETD (casos do menu).
  preproduction_plan: "production/pre-production",
  // Vendas: amostra no Brasil e produto com a venda ativada, a oferecer.
  sales_sample: "sales/samples",
  sales_product: "sales/offers",
  receiving_return: "delivery/return",
};

const toStep = (ref: Ref | null | undefined): FlowStep | null => {
  if (!ref) return null;
  const [block, key] = ref.split("/");
  return findStep(block, key) ?? null;
};

/**
 * Passos de uma pendência: em geral um só; a pendência de etapa que junta
 * itens de passos diferentes (ex.: arte e certificado do mesmo pedido) conta
 * uma vez em cada passo dos itens. Mensagem a responder não entra (fica no
 * topo, em Mensagens).
 */
export function flowStepsOf(task: FlowTaskLike): FlowStep[] {
  if (task.kind === "message_reply") return [];
  if (task.kind === "requirement") {
    const steps = new Map<string, FlowStep>();
    for (const item of task.items ?? []) {
      const step =
        toStep(REQUIREMENT_STEP[baseKeyOf(item.key)]) ??
        toStep(STAGE_STEP[task.stageKey ?? ""]);
      if (step) steps.set(`${step.block}/${step.key}`, step);
    }
    if (steps.size) return [...steps.values()];
    const byStage = toStep(STAGE_STEP[task.stageKey ?? ""]);
    return byStage ? [byStage] : [];
  }
  if (
    (task.kind === "import_step" || task.kind === "import_validate") &&
    task.stepKey
  ) {
    const step = toStep(importStep(task.stepKey));
    if (step) return [step];
  }
  if (task.kind === "cert_step" || task.kind === "cert_validate")
    return [toStep("order/certification")!];
  const byKind = toStep(KIND_STEP[task.kind]);
  if (byKind) return [byKind];
  const byStage = toStep(STAGE_STEP[task.stageKey ?? ""]);
  return byStage ? [byStage] : [];
}

/** Contagem de um passo: quantas esperam ação e quantas já passaram do prazo. */
export interface FlowCount {
  count: number;
  overdue: number;
}

export const stepId = (step: Pick<FlowStep, "block" | "key">) =>
  `${step.block}/${step.key}`;

/**
 * Passos com uma linha por produto (dono, 14/11/2026): na Certificação cada
 * produto do pedido tem o seu certificado e, na Arte, a sua arte, validação
 * e arte final; a pendência de etapa que junta vários produtos vira uma
 * linha para cada um, com o "Resolver" do produto. Os outros passos seguem
 * com uma linha por pendência.
 */
const PER_PRODUCT_STEPS: ReadonlySet<string> = new Set([
  "order/certification",
  "order/art",
]);

export const isPerProductStep = (step: Pick<FlowStep, "block" | "key">) =>
  PER_PRODUCT_STEPS.has(stepId(step));

/**
 * A pendência como linhas do passo: nos passos por produto, uma por produto
 * (cada uma só com os itens daquele produto no passo); nos outros, ela mesma.
 * Itens do pedido inteiro (sem produto na chave) ficam juntos numa linha.
 */
export function splitByProduct<T extends FlowTaskLike>(
  step: Pick<FlowStep, "block" | "key">,
  task: T,
): T[] {
  if (!isPerProductStep(step) || task.kind !== "requirement") return [task];
  const groups = new Map<string, { key: string }[]>();
  for (const item of itemsInStep(step, task)) {
    const product = itemIdOf(item.key) ?? "";
    groups.set(product, [...(groups.get(product) ?? []), item]);
  }
  if (groups.size <= 1) return [task];
  return [...groups.values()].map((items) => ({ ...task, items }) as T);
}

/** As linhas de um passo: as pendências que caem nele, já por produto onde vale. */
export function casesInStep<T extends FlowTaskLike>(
  step: Pick<FlowStep, "block" | "key">,
  tasks: T[],
): T[] {
  const id = stepId(step);
  return tasks
    .filter((task) => flowStepsOf(task).some((x) => stepId(x) === id))
    .flatMap((task) => splitByProduct(step, task));
}

/**
 * O produto da linha no passo (o item do pedido): quando todos os itens dela
 * no passo são do mesmo produto. Nulo nos passos de uma linha por pendência.
 */
export function productOfCase(
  step: Pick<FlowStep, "block" | "key">,
  task: FlowTaskLike,
): string | null {
  if (!isPerProductStep(step) || task.kind !== "requirement") return null;
  const ids = new Set(
    itemsInStep(step, task).map((item) => itemIdOf(item.key)),
  );
  const [only] = ids;
  return ids.size === 1 && only ? only : null;
}

/**
 * Contagem por passo (`bloco/passo`): a mesma das linhas da tela do passo
 * (nos passos por produto, uma por produto).
 */
export function countByStep(
  tasks: (FlowTaskLike & { overdue: boolean })[],
): Map<string, FlowCount> {
  const out = new Map<string, FlowCount>();
  for (const task of tasks)
    for (const step of flowStepsOf(task)) {
      const id = stepId(step);
      const n = splitByProduct(step, task).length;
      const c = out.get(id) ?? { count: 0, overdue: 0 };
      c.count += n;
      if (task.overdue) c.overdue += n;
      out.set(id, c);
    }
  return out;
}

/**
 * Onde se resolve o caso: a tela focada do pedido quando ela existe (Die Cut,
 * documento do pedido, amostras); senão, o atalho da própria pendência.
 */
export function caseHref(
  step: Pick<FlowStep, "block" | "key">,
  task: {
    link: string;
    orderId?: string | null;
    kind: string;
    stageKey?: StageKey | string | null;
    items?: { key: string }[];
  },
): string {
  const order = task.orderId;
  if (order && task.kind === "requirement") {
    if (step.block === "order" && step.key === "art-material")
      return task.link.includes("/die-cut")
        ? task.link
        : `/app/orders/${order}/die-cut`;
    if (step.block === "order" && step.key === "contract")
      return `/app/orders/${order}/purchase-order`;
  }
  if (
    order &&
    task.kind === "import_step" &&
    step.block === "production" &&
    step.key === "sample" &&
    !task.link.includes("/samples")
  )
    return `/app/orders/${order}/samples`;
  // Telas focadas do pedido que já existem (Die Cut, documento do pedido,
  // documentos do embarque, amostras, fotos reais, ficha): o atalho direto.
  if (/\/app\/orders\/[^/]+\/[a-z-]+/.test(task.link)) return task.link;
  // O resto: o pedido na tela do passo (dono, 14/11/2026: a visão é do
  // passo e das necessidades dele, não do pedido inteiro). Nos passos por
  // produto, já no produto da linha; o passo da certificação (memorial,
  // laudo, registro, selo) abre no quadro dele, pela mesma âncora.
  if (order)
    return (
      orderInStepHref(step, order, productOfCase(step, task)) +
      (stepId(step) === "order/certification"
        ? (/#certification-[a-z_-]{1,60}$/.exec(task.link)?.[0] ?? "")
        : "")
    );
  return task.link;
}

/**
 * O pedido aberto na tela do passo: tudo do passo para esse pedido; com o
 * produto (item do pedido), só o que o passo tem para ele.
 */
export const orderInStepHref = (
  step: Pick<FlowStep, "block" | "key">,
  orderId: string,
  itemId?: string | null,
) =>
  `/app/flow/${step.block}/${step.key}/${encodeURIComponent(orderId)}${
    itemId ? `?item=${encodeURIComponent(itemId)}` : ""
  }`;

/**
 * Passos em que a tela do passo é só a lista (dono, 14/11/2026): os cartões
 * por pedido embaixo da tabela repetiam as linhas. O trabalho (anexar foto
 * ou arquivo, validar) fica no detalhe do pedido no passo, aberto pelo
 * "Resolver" da linha.
 */
const LIST_ONLY_STEPS: ReadonlySet<string> = new Set([
  "order/certification",
  "order/art",
]);

export const isListOnlyStep = (step: Pick<FlowStep, "block" | "key">) =>
  LIST_ONLY_STEPS.has(stepId(step));

/**
 * A tela do passo é só a lista para este login? Certificação e Arte, para
 * todos; os outros passos, para a Wellmix (administradores e operadores, dono
 * 14/11/2026: "no acesso dos ADMs e gestores"), com o trabalho no pedido no
 * passo, aberto pelo "Resolver". Os parceiros seguem com os cartões nos
 * outros passos.
 */
export const listOnlyFor = (
  user: Pick<User, "role">,
  step: Pick<FlowStep, "block" | "key">,
) => isListOnlyStep(step) || isWellmix(user);

/** Itens da pendência de etapa que caem neste passo (o resto aparece no passo deles). */
export function itemsInStep<T extends { key: string }>(
  step: Pick<FlowStep, "block" | "key">,
  task: Omit<FlowTaskLike, "items"> & { items?: T[] },
): T[] {
  const id = stepId(step);
  const items: T[] = task.items ?? [];
  return items.filter((item) =>
    flowStepsOf({ ...task, items: [item] }).some((x) => stepId(x) === id),
  );
}

/** Passo do menu de um passo do embarque, da importação ou da certificação. */
export function flowStepOfImportKey(key: string): FlowStep | null {
  return toStep(importStep(key));
}

/*
 * Passos de cada parceiro no menu (dono, 14/11/2026; docs/FLOW_MENU.md):
 * onde o papel faz, valida ou acompanha algo no mapa, tirado de quem faz
 * cada passo do embarque e da certificação (IMPORT_STEPS: actor, validator,
 * visibleTo) e do responsável de cada etapa do pedido (STAGE_TEMPLATES).
 * O cliente e o jurídico não têm passos (seguem com a tela de hoje).
 */
export const PARTNER_FLOW_STEPS: Readonly<Record<string, readonly string[]>> = {
  // Ficha e medidas, Die Cut, assinatura, inspeção, amostras, container na
  // origem, documentos do embarque (invoice assinada) e embarque.
  supplier: [
    "order/orders",
    "order/art-material",
    "order/contract",
    "production/inspection",
    "production/sample",
    "production/logistics",
    "production/loading",
    "production/cargo-docs",
    "production/shipment",
  ],
  // Arte, arte final e a arte com o selo.
  agency: ["order/art", "order/certification"],
  // Memorial, laudo, registro e selo.
  ocp: ["order/certification"],
  // Desembaraço (responsável da etapa) e o BL.
  broker: ["production/cargo-docs", "delivery/cargo-presence"],
  // Registro da certificação, documentos, origem, presença, canal e NF.
  comex: [
    "order/certification",
    "production/logistics",
    "production/loading",
    "production/cargo-docs",
    "production/shipment",
    "delivery/lpco",
    "delivery/cargo-presence",
    "delivery/channel",
    "delivery/invoice",
  ],
  // Booking, draft BL e BL; acompanha a origem, a chegada e o canal.
  logistics: [
    "production/booking",
    "production/logistics",
    "production/loading",
    "production/cargo-docs",
    "production/shipment",
    "delivery/cargo-presence",
    "delivery/channel",
    "delivery/invoice",
  ],
  // Etapa de embarque (data, ETA, navio, BL).
  shipping_line: ["production/shipment"],
  // Transporte e entrega.
  carrier: ["delivery/logistics", "delivery/delivery"],
  // Recebe as amostras e devolve (R14/R15).
  marketing_agency: ["production/sample"],
};

/** Passos do parceiro, na ordem do mapa (vazio para quem não tem). */
export function partnerStepsOf(role: string): FlowStep[] {
  const ids = PARTNER_FLOW_STEPS[role] ?? [];
  return FLOW_STEPS.filter((s) => ids.includes(stepId(s)));
}
