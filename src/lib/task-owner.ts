import { can, type ActionKey } from "@/lib/auth/function-access";
import { canOpen, type Screen } from "@/lib/auth/screens";
import type { Role, StageKey, User } from "@/lib/db/schema";
import {
  DOWN_PAYMENT_KEY,
  LANE_KEYS,
  SAMPLE_ORDER_KEY,
  baseKeyOf,
} from "@/lib/purchase-lanes";

/*
 * De quem é cada pendência da Wellmix (dono, 13/11/2026): o operador vê em
 * Pendências só o que as funções dele fazem (Equipe → Funções e acessos);
 * o administrador vê tudo, como antes. Cada pendência aponta para uma ação
 * (ex.: fazer a arte = "art.design", padrão Designer) ou uma tela (ex.:
 * frete e desembaraço = "freight", padrão Comprador e Planejamento). O que é
 * de fornecedor e parceiros (assinatura do fornecedor, certificação do
 * despachante) não entra na lista do operador.
 */

export type TaskGate =
  | { action: ActionKey }
  | { screen: Screen }
  /** Só o administrador (financeiro, certificação sem despachante). */
  | { admin: true };

/** Item de etapa dentro da pendência (para o filtro do operador). */
export interface TaskItem {
  key: string;
  role: Role;
  label: string;
}

const COMPRAS: TaskGate = { action: "purchaseOrder.generate" };
const LOGISTICA: TaskGate = { screen: "freight" };
const ADMIN: TaskGate = { admin: true };

/** Etapas do embarque à entrega: frete, desembaraço e transporte. */
const LOGISTICS_STAGES: readonly StageKey[] = [
  "SHIPPING",
  "CUSTOMS",
  "TRANSPORT",
  "DELIVERED",
];

/** Item de etapa feito pela Wellmix: a ação ou tela que o faz. */
export function requirementGate(
  key: string,
  stageKey: StageKey | null | undefined,
): TaskGate {
  const base = baseKeyOf(key);
  switch (base) {
    case LANE_KEYS.art:
    case LANE_KEYS.artFinal:
      return { action: "art.design" };
    case LANE_KEYS.artReview:
    case "art_approval":
      return { action: "art.validate" };
    case "order_signed_wellmix":
      return { action: "contract.sign" };
    // Certificado do produto: é do despachante (sem ele, do administrador).
    case LANE_KEYS.certificate:
      return ADMIN;
    case DOWN_PAYMENT_KEY:
      return ADMIN;
    case SAMPLE_ORDER_KEY:
      return { action: "sampling.validate" };
    case LANE_KEYS.ncmValidated:
    case LANE_KEYS.sheetComplete:
      return { screen: "lines" };
  }
  if (stageKey && LOGISTICS_STAGES.includes(stageKey)) return LOGISTICA;
  // Documento, confirmação, número no ERP e os itens da linha: compras.
  return COMPRAS;
}

/** Pendência pelo tipo (e o passo, no embarque e na certificação). */
export function kindGate(
  kind: string,
  stepKey?: string | null,
): TaskGate | null {
  switch (kind) {
    case "new_request":
      return { screen: "requests" };
    case "review":
      return { screen: "reviews" };
    case "sourcing_demand":
      return { screen: "sourcing" };
    case "sampling":
    case "sampling_validate":
      return { action: "sampling.validate" };
    case "supplier_request":
      return { action: "supplierRequest.decide" };
    case "production_follow":
    case "sku_inspection":
      return COMPRAS;
    case "supplier_payment":
    case "purchase_schedule":
      return ADMIN;
    case "import_step":
    case "import_validate":
      return stepKey === "numerario" || stepKey === "numerario_paid"
        ? { action: "numerario.manage" }
        : LOGISTICA;
    case "cert_step":
      // Aplicar o selo na arte (sem agência): quem faz a arte.
      if (stepKey === "cert_seal_art") return { action: "art.design" };
      // Designar o despachante do pedido (parceiros do pedido): compras.
      if (stepKey === "assign") return COMPRAS;
      return ADMIN;
    case "cert_validate":
      if (stepKey === "cert_seal_art") return { action: "art.validate" };
      return ADMIN;
  }
  return null;
}

type Who = Pick<User, "role"> & Partial<Pick<User, "functions" | "screens">>;

export function passesGate(user: Who, gate: TaskGate): boolean {
  if (user.role === "admin") return true;
  if ("admin" in gate) return false;
  if ("action" in gate) return can(user, gate.action);
  return canOpen(user, gate.screen);
}

interface Filterable {
  kind: string;
  detail: string;
  stageKey?: StageKey;
  stepKey?: string | null;
  items?: TaskItem[];
  ownerUserId?: string | null;
}

/**
 * Pendências do operador da Wellmix: só as das funções dele. Pendência de
 * etapa com vários itens fica só com os itens dele (o detalhe é refeito).
 * Administrador e logins de fora: a lista como veio.
 */
export function tasksForFunctions<T extends Filterable>(
  user: Who & Pick<User, "id">,
  tasks: T[],
): T[] {
  if (user.role !== "operator") return tasks;
  const out: T[] = [];
  for (const task of tasks) {
    if (task.kind === "requirement") {
      const items = task.items;
      if (!items?.length) {
        if (passesGate(user, requirementGate("", task.stageKey)))
          out.push(task);
        continue;
      }
      const mine = items.filter(
        (i) =>
          i.role === "operator" &&
          passesGate(user, requirementGate(i.key, task.stageKey)),
      );
      if (!mine.length) continue;
      out.push(
        mine.length === items.length
          ? task
          : {
              ...task,
              items: mine,
              detail: mine.map((i) => i.label).join(", "),
            },
      );
      continue;
    }
    // Mensagem: de quem cuida da conversa (ou de todos, sem analista).
    if (task.kind === "message_reply") {
      if (!task.ownerUserId || task.ownerUserId === user.id) out.push(task);
      continue;
    }
    const gate = kindGate(task.kind, task.stepKey);
    if (!gate || passesGate(user, gate)) out.push(task);
  }
  return out;
}
