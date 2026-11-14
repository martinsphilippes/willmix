import "server-only";
import { can } from "@/lib/auth/function-access";
import { canOpen } from "@/lib/auth/screens";
import type { ArtIssue, Order, Requirement, Stage, User } from "@/lib/db";
import type { OrderPartKey } from "@/lib/order-parts";
import {
  DOWN_PAYMENT_KEY,
  LANE_KEYS,
  baseKeyOf,
  isAutoGateKey,
  itemIdOf,
  laneKey,
} from "@/lib/purchase-lanes";
import {
  ORDER_SIGN_SEND,
  ORDER_SIGNED_WELLMIX,
  ROLE_PARTY_FIELD,
  canCompleteLater,
  isPurchaseFlow,
} from "@/lib/workflow/stages";
import { canSubmitRequirement } from "@/lib/workflow/engine";
import {
  artMakerRoute,
  artValidatorRoute,
  holdersRoute,
  internalRoute,
  loadRoutingContext,
  reaches,
  type Route,
  type RoutingContext,
} from "./cert-art-routing";
import type { StepView } from "./import-flow";
import { requirementWaiting } from "./tasks";

/*
 * Linha do tempo "Etapas do pedido" do operador da Wellmix (pedido do dono,
 * 14/11/2026): só as tarefas a fazer que cabem ao login, tarefa a tarefa,
 * inclusive dentro das etapas e das partes compartilhadas. Usa as regras que
 * o pedido já tem: o encaminhamento das pendências e dos avisos
 * (cert-art-routing: despachante da certificação, agência, designer do
 * pedido, analista),
 * as ações das funções ("Validar a arte", "Assinar o contrato pela Wellmix")
 * e as travas das pendências (o item só conta quando já está liberado).
 *
 * Cada item da Wellmix vai para:
 * - arte e arte final com o selo: quem faz a arte (designer do pedido, a
 *   agência que faz a arte, a função Designer, o analista);
 * - validação da arte: o analista que pode validar arte (senão quem pode);
 * - assinatura da Wellmix: quem tem "Assinar o contrato pela Wellmix";
 * - NCM validado e ficha mestre completa: a função Cadastro;
 * - sinal ao fornecedor: quem abre o Financeiro;
 * - o resto (inclusive o que a Wellmix faz no lugar de um parceiro que o
 *   pedido ainda não tem): o analista do pedido; sem analista, a equipe.
 *
 * O item de um parceiro designado (fornecedor, OCP, agência, armador...) é só
 * dele e não entra. A tarefa só conta liberada: na etapa em andamento (ou no
 * dado que ainda dá para completar depois) e sem esperar outro item, como a
 * validação da arte, que só aparece depois de a arte ser enviada.
 *
 * O administrador continua vendo a linha do tempo inteira.
 */

/** Só o operador da Wellmix vê a linha do tempo com as tarefas dele. */
export const timelineMineOnly = (user: Pick<User, "role">) =>
  user.role === "operator";

export interface MyStageTasks {
  /** Itens da etapa que o login faz agora (abertos e liberados). */
  open: Requirement[];
  /** Itens da etapa do login já concluídos. */
  done: number;
}

export interface MyPartTasks {
  open: number;
  done: number;
  /** A tarefa aberta do login já foi começada (ex.: a ficha já tem dados). */
  started?: boolean;
  /**
   * As tarefas da parte são itens da etapa em que ela aparece (as
   * assinaturas do documento do pedido): já contam na etapa, não de novo.
   */
  mirror?: boolean;
}

export interface MyTimeline {
  stages: Map<string, MyStageTasks>;
  parts: Partial<Record<OrderPartKey, MyPartTasks>>;
}

const isWellmixItem = (r: Pick<Requirement, "role">) =>
  r.role === "operator" || r.role === "admin";

/**
 * Item de um parceiro que o pedido ainda não tem (ex.: o armador do
 * embarque): a Wellmix faz no lugar dele, como no quadro da etapa.
 */
const partnerMissing = (order: Order, r: Pick<Requirement, "role">) => {
  const field = ROLE_PARTY_FIELD[r.role];
  return !!field && !order[field];
};

/**
 * Para quem vai um item do pedido na linha do tempo da Wellmix (nulo: é só
 * de um parceiro designado, como a faca do fornecedor ou o selo da OCP).
 */
export function wellmixRequirementRoute(
  order: Order,
  r: Requirement,
  stageReqs: readonly Requirement[],
  ctx: RoutingContext,
): Route | null {
  const base = baseKeyOf(r.key);
  // A arte e a arte final com o selo: de quem faz a arte, seja a agência, o
  // designer do pedido (mesmo com a agência no pedido) ou a Wellmix.
  if (base === LANE_KEYS.art || base === LANE_KEYS.artFinal)
    return artMakerRoute(order, ctx);
  if (!isWellmixItem(r) && !partnerMissing(order, r)) return null;
  const analyst = internalRoute(order, ctx);
  if (base === LANE_KEYS.artReview) {
    const item = itemIdOf(r.key);
    const art = item
      ? stageReqs.find((x) => x.key === laneKey(LANE_KEYS.art, item))
      : undefined;
    return artValidatorRoute(order, ctx, art?.submittedByUserId ?? null);
  }
  if (r.key === ORDER_SIGNED_WELLMIX)
    return holdersRoute(ctx, (u) => can(u, "contract.sign", ctx.defs), analyst);
  if (base === LANE_KEYS.ncmValidated || base === LANE_KEYS.sheetComplete)
    return holdersRoute(
      ctx,
      (u) => (u.functions ?? []).includes("catalog"),
      analyst,
    );
  if (base === DOWN_PAYMENT_KEY)
    return holdersRoute(ctx, (u) => canOpen(u, "finance"), analyst);
  return analyst;
}

/**
 * Itens de uma etapa que são do login: os abertos que ele faz agora (a etapa
 * em andamento, ou o dado que ainda dá para completar depois, sem esperar
 * outro item) e os já concluídos que eram dele.
 */
export function myStageTasks(
  user: User,
  order: Order,
  stage: Pick<Stage, "id" | "key" | "status">,
  stageReqs: Requirement[],
  ctx: RoutingContext,
  sealApplied: boolean,
): MyStageTasks {
  const open: Requirement[] = [];
  let done = 0;
  const stageOpen = stageReqs.filter((r) => r.status !== "done");
  for (const r of stageReqs) {
    // Item do histórico do Sankhya em espera até o go-live: sem tarefa.
    if (r.held) continue;
    const route = wellmixRequirementRoute(order, r, stageReqs, ctx);
    const mine = !!route && reaches(user, route);
    if (r.status === "done") {
      if (mine || r.submittedByUserId === user.id) done++;
      continue;
    }
    if (!mine) continue;
    // O item que o sistema confere (NCM validado, ficha mestre, sinal) não se
    // marca à mão: quem recebe faz a parte dele na tela dona (o atalho do
    // item no quadro da etapa). O resto, só quem pode enviar ou aprovar.
    if (!isAutoGateKey(r.key) && !canSubmitRequirement(user, order, r))
      continue;
    const live =
      stage.status === "active" ||
      stage.status === "blocked" ||
      canCompleteLater(stage, r, order);
    if (!live) continue;
    if (
      requirementWaiting(
        r,
        { open: stageOpen, all: stageReqs },
        { sealApplied, purchase: isPurchaseFlow(order) },
      )
    )
      continue;
    open.push(r);
  }
  return { open, done };
}

/** Passos (certificação, embarque) concluídos por este login. */
const doneBy = (user: User, steps: readonly StepView[]) =>
  steps.filter(
    (v) =>
      v.done &&
      (v.step?.submittedByUserId === user.id ||
        v.step?.validatedByUserId === user.id),
  ).length;

export interface TimelineInput {
  order: Order;
  stages: Stage[];
  requirements: Requirement[];
  /** Passos da certificação e do embarque que o login vê (cartões do pedido). */
  certSteps: StepView[];
  importSteps: StepView[];
  /** Ficha de compra: campos que faltam (nulo: o pedido não tem a ficha). */
  sheetMissing: number | null;
  /** A ficha de compra já foi começada (salva ou com dados trazidos). */
  sheetStarted: boolean;
  /** Não conformidades da arte do pedido (cartão Artes). */
  artIssues: ArtIssue[];
  /** Pagamento ao fornecedor ainda em aberto (pedido não encerrado). */
  supplierPaymentOpen: boolean;
  /** Recebimento aberto (começado e não fechado). */
  receivingOpen: boolean;
}

/** As tarefas do login no pedido, por etapa e por parte do pedido. */
export async function myOrderTimeline(
  user: User,
  input: TimelineInput,
): Promise<MyTimeline> {
  const { order, stages, requirements } = input;
  // Pedido do histórico do Sankhya em espera até o go-live: sem tarefa, como
  // nas pendências (tasks.ts usa `held: null`).
  if (order.held) return { stages: new Map(), parts: {} };
  const ctx = await loadRoutingContext();
  const sealApplied = input.certSteps.some(
    (v) =>
      v.template.key === "cert_seal_art" &&
      (v.step?.status === "submitted" || v.step?.status === "validated"),
  );
  const byStage = new Map<string, MyStageTasks>();
  for (const stage of stages) {
    const reqs = requirements.filter((r) => r.stageId === stage.id);
    byStage.set(
      stage.id,
      stage.held
        ? { open: [], done: 0 }
        : myStageTasks(user, order, stage, reqs, ctx, sealApplied),
    );
  }
  const analyst = internalRoute(order, ctx);
  const mineAsAnalyst = reaches(user, analyst);
  const parts: MyTimeline["parts"] = {};

  // Certificação e embarque/desembaraço: as mesmas pendências do login. Do
  // embarque, o que a Wellmix faz (ou faz no lugar de um parceiro que falta)
  // é do analista; o numerário, do financeiro.
  const { importTasks, stepTemplate } = await import("./import-flow");
  const steps = await importTasks(user, [order]);
  const certOpen = steps.filter(
    (p) => p.kind === "cert_step" || p.kind === "cert_validate",
  ).length;
  const importOpen = steps.filter((p) => {
    if (p.kind !== "import_step" && p.kind !== "import_validate") return false;
    const tpl = stepTemplate(p.key);
    const role = p.kind === "import_validate" ? tpl.validator : tpl.actor;
    return role === "finance" || mineAsAnalyst;
  }).length;
  parts.certification = {
    open: certOpen,
    done: doneBy(user, input.certSteps),
  };
  parts.import = { open: importOpen, done: doneBy(user, input.importSteps) };

  // Artes: corrigir a não conformidade (quem faz a arte) e conferir (quem
  // apontou ou quem valida a arte).
  const { artIssueTasks } = await import("./artwork");
  parts.artwork = {
    open: (await artIssueTasks(user, { orderId: order.id })).length,
    done: input.artIssues.filter(
      (i) =>
        i.status === "accepted" &&
        (i.fixedByUserId === user.id || i.acceptedByUserId === user.id),
    ).length,
  };

  // Documento do pedido: enviar para assinatura e a assinatura da Wellmix,
  // os mesmos itens da etapa em que estão.
  const signKeys = [ORDER_SIGN_SEND, ORDER_SIGNED_WELLMIX];
  let docOpen = 0;
  let docDone = 0;
  for (const mine of byStage.values()) {
    docOpen += mine.open.filter((r) => signKeys.includes(r.key)).length;
  }
  for (const r of requirements)
    if (
      signKeys.includes(r.key) &&
      r.status === "done" &&
      r.submittedByUserId === user.id
    )
      docDone++;
  parts.document = { open: docOpen, done: docDone, mirror: true };

  // Ficha de compra: o lado da Wellmix é do analista enquanto falta campo.
  parts.sheet = {
    open: input.sheetMissing && mineAsAnalyst ? 1 : 0,
    done: 0,
    started: input.sheetStarted,
  };
  // Produção: o follow e a reinspeção da Wellmix são do analista.
  const { productionTasks } = await import("./production");
  parts.production = {
    open: mineAsAnalyst ? (await productionTasks(user, [order])).length : 0,
    done: 0,
  };
  // Pagamento ao fornecedor: quem abre o Financeiro.
  parts.supplier_payment = {
    open: input.supplierPaymentOpen && canOpen(user, "finance") ? 1 : 0,
    done: 0,
  };
  // Recebimento: o analista e quem acompanha o recebimento.
  parts.receiving = {
    open:
      input.receivingOpen &&
      (mineAsAnalyst || can(user, "receiving.follow", ctx.defs))
        ? 1
        : 0,
    done: 0,
  };
  return { stages: byStage, parts };
}

export interface MyStageRow {
  /** Itens da etapa que o login faz agora (os detalhes da etapa). */
  open: Requirement[];
  /** Subetapas (partes do pedido) desta etapa com tarefa do login. */
  parts: OrderPartKey[];
  /** Situação, andamento e contagem do login na etapa (itens e subetapas). */
  progress: ReturnType<typeof myProgress>;
}

/**
 * A linha de uma etapa na linha do tempo do login: só quando há tarefa dele
 * a fazer dentro dela (nos itens da etapa ou numa subetapa); nula quando ele
 * já concluiu a última, mesmo com outros responsáveis ainda pendentes. A
 * contagem soma só as tarefas dele ali, as feitas e as que faltam.
 */
export function myStageRow(
  mine: MyTimeline,
  stage: Pick<Stage, "id" | "status">,
  partKeys: readonly OrderPartKey[],
): MyStageRow | null {
  const own = mine.stages.get(stage.id);
  const parts = partKeys.filter((k) => (mine.parts[k]?.open ?? 0) > 0);
  const openItems = own?.open ?? [];
  if (!openItems.length && !parts.length) return null;
  let open = openItems.length;
  let done = own?.done ?? 0;
  for (const k of partKeys) {
    const part = mine.parts[k];
    if (!part || part.mirror) continue;
    open += part.open;
    done += part.done;
  }
  return {
    open: openItems,
    parts,
    progress: myProgress(
      { open, done, started: parts.some((k) => mine.parts[k]?.started) },
      stage.status === "blocked" && openItems.length > 0,
    ),
  };
}

/** Situação, andamento e contagem do login numa etapa ou parte. */
export function myProgress(
  mine: { open: number; done: number; started?: boolean },
  blocked = false,
): {
  status: "pending" | "active" | "blocked";
  percent: number;
  done: number;
  total: number;
} {
  const total = mine.open + mine.done;
  return {
    status: blocked
      ? "blocked"
      : mine.done > 0 || (mine.open > 0 && mine.started)
        ? "active"
        : "pending",
    percent: total ? Math.round((mine.done / total) * 100) : 0,
    done: mine.done,
    total,
  };
}
