import { flowStepOfImportKey, flowStepsOf, stepId } from "@/lib/flow";

/*
 * Caminho do fornecedor e da Trading ("Etapas que chegam até você" em Minhas
 * pendências; dono, 10/11/2026 e 16/11/2026): tudo que chega na mão dele, do
 * Book à Invoice, na ordem do mapa do processo (docs/MAPA_PROCESSO.md). Na
 * Invoice o serviço da Trading termina: depois dela (BL, embarque,
 * desembaraço, transporte e entrega) nada depende dele. É o filtro "Etapa"
 * da tela (o grupo da pendência vira `supplier.<etapa>`). Regra pura: sem
 * banco, sem tela.
 *
 * Depois do Die Cut, cada pendência cai na etapa pelo passo do menu dela
 * (`flowStepsOf` e `flowStepOfImportKey`, os mesmos do menu lateral e dos
 * marcos do pedido):
 * - Ficha de compra (P9, P14), Aprovar a arte (P7), Assinar o pedido (P11 e
 *   o aceite do pedido de amostras, P17);
 * - Confirmar sinal (P12): o recebimento do pagamento da Wellmix, na conta
 *   corrente;
 * - Inspeção (R3, R4?): fotos, peso, vídeo, conformidade e o SKU reprovado;
 * - Amostra (R12 a R14): retirada, envios e a devolução da amostra da China;
 * - Transportadora (R17 a R20): na compra EXW a transportadora e os custos
 *   de origem; o container vazio na fábrica;
 * - Carregamento (R7, R21, R25, R26): carregamento, check list de carga,
 *   packing list, lacre e o container no porto;
 * - Invoice (R22, R22?): a invoice e a conferência com o packing list.
 */
export const SUPPLIER_STEPS = [
  "booking",
  "request",
  "sampling",
  "dieline",
  "sheet",
  "art",
  "sign",
  "deposit",
  "inspection",
  "sample",
  "carrier",
  "loading",
  "invoice",
] as const;
export type SupplierStep = (typeof SUPPLIER_STEPS)[number];

export const supplierGroup = (step: SupplierStep) => `supplier.${step}`;

/** A etapa do fornecedor de um grupo `supplier.<etapa>`; nulo nos demais. */
export function supplierStepOfGroup(group: string): SupplierStep | null {
  const step = group.startsWith("supplier.") ? group.slice(9) : "";
  return (SUPPLIER_STEPS as readonly string[]).includes(step)
    ? (step as SupplierStep)
    : null;
}

/**
 * Etapa antiga "Embarque" (`supplier.shipping`, até 16/11/2026): o link
 * guardado mostra as pendências das etapas que a substituíram.
 */
const LEGACY_GROUPS: Readonly<Record<string, readonly SupplierStep[]>> = {
  "supplier.shipping": ["sample", "carrier", "loading", "invoice"],
};

/** Etapas que um grupo antigo do fornecedor abrange; nulo nos demais. */
export const legacySupplierSteps = (
  group: string,
): readonly SupplierStep[] | null => LEGACY_GROUPS[group] ?? null;

/** Passo do menu (`bloco/passo`) → etapa do fornecedor. */
const STEP_OF_FLOW: Readonly<Record<string, SupplierStep>> = {
  "order/orders": "sheet",
  "registry/products": "sheet",
  "order/art-material": "dieline",
  "order/art": "art",
  "order/contract": "sign",
  "finance/finance": "deposit",
  "production/pre-production": "inspection",
  "production/inspection": "inspection",
  "production/production": "inspection",
  "production/sample": "sample",
  "production/booking": "carrier",
  "production/logistics": "carrier",
  "production/loading": "loading",
  // Documentos do embarque: a invoice (o check list e o packing list, abaixo).
  "production/cargo-docs": "invoice",
  // Container lacrado de volta ao porto (R26), o fim do carregamento.
  "production/shipment": "loading",
};

/**
 * Check list de carga e packing list (R7, R21): fecham o carregamento; os
 * outros documentos do embarque ficam na Invoice.
 */
const LOADING_DOCS: ReadonlySet<string> = new Set([
  "shipping_load",
  "shipping_packing_list",
]);

/**
 * Etapa do fornecedor de um passo do embarque, da origem, das amostras ou dos
 * documentos do embarque (`shipping_<documento>`). Nulo fora do caminho dele
 * (certificação e o recebimento no Brasil).
 */
export function supplierStepOfImportKey(key: string): SupplierStep | null {
  if (LOADING_DOCS.has(key)) return "loading";
  const step = flowStepOfImportKey(key);
  return step ? (STEP_OF_FLOW[stepId(step)] ?? null) : null;
}

/**
 * Etapa do fornecedor de um item do pedido: pelo passo do menu do item (o
 * gravado, o da chave ou, sem eles, o da etapa em que nasceu). Nulo fora do
 * caminho dele.
 */
export function supplierStepOfItem(
  stageKey: string,
  item: { key: string; step?: string | null },
): SupplierStep | null {
  for (const step of flowStepsOf({
    kind: "requirement",
    stageKey,
    items: [item],
  })) {
    const found = STEP_OF_FLOW[stepId(step)];
    if (found) return found;
  }
  return null;
}
