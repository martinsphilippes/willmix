import "server-only";

import { getStore, type Order, type Requirement, type Stage } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { evaluateStage } from "@/lib/workflow/engine";
import { ART_APPROVAL_LABEL, artRole } from "@/lib/workflow/stages";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Arte e embalagem: a agência (ou a Wellmix, sem agência) faz e envia a arte;
 * o fornecedor confere e aprova. Pedidos de antes da inversão têm os papéis
 * trocados (arte do fornecedor, aprovação da agência, às vezes sem aprovação);
 * aqui eles passam para o fluxo novo, sem mexer no que já foi enviado.
 */

const OPEN_STATUSES: Stage["status"][] = ["pending", "active", "blocked"];

interface PlanInput {
  /** Quem faz a arte hoje (agência do pedido ou Wellmix). */
  wantArtRole: Requirement["role"];
  hasAgency: boolean;
  /**
   * Designar/trocar a agência no pedido: a arte ainda não enviada vai para
   * quem faz a arte agora. Sem isso (passadas automáticas), só o formato
   * antigo muda: mudar a configuração não tira a arte de quem já a tem.
   */
  reassign: boolean;
}

/** O que precisa mudar nos itens da etapa (vazio = já está no fluxo novo). */
function planFor(requirements: Requirement[], input: PlanInput) {
  const art = requirements.find((r) => r.key === "art");
  const approvals = requirements.filter((r) => r.key === "art_approval");
  // Mais de uma aprovação (duas passadas ao mesmo tempo): fica a decidida ou
  // a primeira; as outras saem.
  const approval =
    approvals.find((r) => r.status === "done") ??
    [...approvals].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const extraApprovals = approvals.filter((r) => r !== approval);
  const artDone = art?.status === "done";
  const legacyArt =
    !!art &&
    (!["agency", "operator"].includes(art.role) ||
      (art.role === "agency" && !input.hasAgency));
  return {
    art,
    approval,
    extraApprovals,
    // Arte ainda não enviada vai para quem faz a arte agora.
    moveArt:
      !!art &&
      !artDone &&
      art.role !== input.wantArtRole &&
      (legacyArt || input.reassign),
    createApproval: !approval,
    moveApproval: !!approval && approval.role !== "supplier",
    // Aprovação "concluída" sem arte enviada não vale (aprovou nada).
    resetApproval:
      !!approval && approval.status === "done" && !!art && !artDone,
  };
}

const needsChange = (plan: ReturnType<typeof planFor>) =>
  plan.moveArt ||
  plan.createApproval ||
  plan.moveApproval ||
  plan.resetApproval ||
  plan.extraApprovals.length > 0;

async function planInput(order: Order, reassign: boolean): Promise<PlanInput> {
  const settings = await getSettings();
  return {
    wantArtRole: artRole(order, settings.agencyValidationEnabled),
    hasAgency: !!order.agencyId,
    reassign,
  };
}

/** Ajusta uma etapa de arte e embalagem ao fluxo novo. Devolve se mudou algo. */
export async function normalizePackagingStage(
  stageId: string,
  opts: { reassign?: boolean } = {},
): Promise<boolean> {
  const store = getStore();
  const stage = await store.get("stages", stageId);
  if (!stage || stage.key !== "PACKAGING") return false;
  if (!OPEN_STATUSES.includes(stage.status)) return false;
  const [order, requirements] = await Promise.all([
    store.get("orders", stage.orderId),
    store.list("requirements", { filter: { stageId } }),
  ]);
  if (!order || order.status === "CANCELLED") return false;
  const input = await planInput(order, !!opts.reassign);
  const plan = planFor(requirements, input);
  if (!needsChange(plan)) return false;

  if (plan.moveArt && plan.art)
    await store.update("requirements", plan.art.id, {
      role: input.wantArtRole,
    });
  for (const extra of plan.extraApprovals)
    await store.remove("requirements", extra.id);
  if (plan.createApproval) {
    await store.create("requirements", {
      orderId: order.id,
      stageId,
      key: "art_approval",
      label: ART_APPROVAL_LABEL,
      type: "approval",
      required: true,
      role: "supplier",
      status: "pending",
      value: null,
      documentId: null,
      submittedByUserId: null,
      submittedAt: null,
      note: null,
    });
    // Outra passada pode ter criado ao mesmo tempo: fica uma só.
    const created = await store.list("requirements", {
      filter: { stageId, key: "art_approval" },
    });
    const keep =
      created.find((r) => r.status === "done") ??
      [...created].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    for (const extra of created)
      if (extra !== keep && extra.status !== "done")
        await store.remove("requirements", extra.id);
  }
  if (plan.approval && (plan.moveApproval || plan.resetApproval))
    await store.update("requirements", plan.approval.id, {
      role: "supplier",
      label: ART_APPROVAL_LABEL,
      ...(plan.resetApproval
        ? {
            status: "pending" as const,
            value: null,
            note: null,
            submittedByUserId: null,
            submittedAt: null,
          }
        : {}),
    });
  await audit(
    null,
    "stage.packaging_flow",
    "stage",
    stageId,
    `Pedido #${order.number}: arte por ${input.wantArtRole === "agency" ? "agência" : "Wellmix"}, aprovação pelo fornecedor`,
  );
  const open = stage.status === "active" || stage.status === "blocked";
  // A arte mudou de dono com a etapa aberta: o novo dono é avisado.
  if (plan.moveArt && open)
    await notify(
      input.wantArtRole === "agency" && order.agencyId
        ? { role: "agency", partyId: order.agencyId }
        : { role: ["admin", "operator"] },
      {
        kind: "action",
        link: `/app/orders/${order.id}`,
        text: (t) => ({
          subject: t("notif.stage.subject", {
            n: order.number,
            stage: t("stage.PACKAGING"),
          }),
          body: t("notif.stage.body", { items: t("notif.packaging.item") }),
        }),
      },
    );
  // Percentual e responsável da etapa aberta acompanham os itens novos.
  if (open) await evaluateStage(null, stageId);
  return true;
}

/** Última passada geral sem nada a ajustar (nesta instância do servidor). */
let quietSince = 0;
const QUIET_MS = 10 * 60_000;

/**
 * Pedidos de antes da inversão passam para o fluxo novo: um pedido (página do
 * pedido) ou todos os abertos (Pendências, job diário com `force`). Nunca
 * derruba a tela: falha vai para o log.
 */
export async function normalizePackaging(
  orderId?: string,
  opts: { force?: boolean } = {},
): Promise<number> {
  if (!orderId && !opts.force && Date.now() - quietSince < QUIET_MS) return 0;
  try {
    const store = getStore();
    const stages = await store.list("stages", {
      filter: orderId
        ? { orderId, key: "PACKAGING" }
        : { key: "PACKAGING", status: OPEN_STATUSES },
    });
    const open = stages.filter((s) => OPEN_STATUSES.includes(s.status));
    if (!open.length) {
      if (!orderId) quietSince = Date.now();
      return 0;
    }
    const [requirements, orders, settings] = await Promise.all([
      store.list("requirements", {
        filter: {
          stageId: open.map((s) => s.id),
          key: ["art", "art_approval"],
        },
      }),
      store.list("orders", {
        filter: { id: [...new Set(open.map((s) => s.orderId))] },
      }),
      getSettings(),
    ]);
    let changed = 0;
    let failed = false;
    for (const stage of open) {
      const order = orders.find((o) => o.id === stage.orderId);
      if (!order || order.status === "CANCELLED") continue;
      const plan = planFor(
        requirements.filter((r) => r.stageId === stage.id),
        {
          wantArtRole: artRole(order, settings.agencyValidationEnabled),
          hasAgency: !!order.agencyId,
          reassign: false,
        },
      );
      if (!needsChange(plan)) continue;
      try {
        if (await normalizePackagingStage(stage.id)) changed++;
      } catch (error) {
        failed = true;
        console.error("[packaging] etapa não ajustada", stage.id, error);
      }
    }
    if (!orderId) quietSince = changed === 0 && !failed ? Date.now() : 0;
    return changed;
  } catch (error) {
    console.error("[packaging] ajuste falhou", error);
    return 0;
  }
}
