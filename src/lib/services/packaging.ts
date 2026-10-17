import "server-only";

import { getStore, type Requirement, type Stage } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { evaluateStage } from "@/lib/workflow/engine";
import { ART_APPROVAL_LABEL, artRole } from "@/lib/workflow/stages";
import { audit } from "./audit";

/*
 * Arte e embalagem: a agência (ou a Wellmix, sem agência) faz e envia a arte;
 * o fornecedor confere e aprova. Pedidos de antes da inversão têm os papéis
 * trocados (arte do fornecedor, aprovação da agência, às vezes sem aprovação);
 * aqui eles passam para o fluxo novo, sem mexer no que já foi enviado.
 */

const OPEN_STATUSES: Stage["status"][] = ["pending", "active", "blocked"];

/** O que precisa mudar nos itens da etapa (vazio = já está no fluxo novo). */
function planFor(
  requirements: Requirement[],
  wantArtRole: Requirement["role"],
) {
  const art = requirements.find((r) => r.key === "art");
  const approval = requirements.find((r) => r.key === "art_approval");
  const artDone = art?.status === "done";
  return {
    art,
    approval,
    // Arte ainda não enviada vai para quem faz a arte agora.
    moveArt: !!art && !artDone && art.role !== wantArtRole,
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
  plan.resetApproval;

/** Ajusta uma etapa de arte e embalagem ao fluxo novo. Devolve se mudou algo. */
export async function normalizePackagingStage(
  stageId: string,
): Promise<boolean> {
  const store = getStore();
  const stage = await store.get("stages", stageId);
  if (!stage || stage.key !== "PACKAGING") return false;
  if (!OPEN_STATUSES.includes(stage.status)) return false;
  const [order, settings, requirements] = await Promise.all([
    store.get("orders", stage.orderId),
    getSettings(),
    store.list("requirements", { filter: { stageId } }),
  ]);
  if (!order || order.status === "CANCELLED") return false;
  const wantArtRole = artRole(order, settings.agencyValidationEnabled);
  const plan = planFor(requirements, wantArtRole);
  if (!needsChange(plan)) return false;

  if (plan.moveArt && plan.art)
    await store.update("requirements", plan.art.id, { role: wantArtRole });
  if (plan.createApproval)
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
    `Pedido #${order.number}: arte por ${wantArtRole === "agency" ? "agência" : "Wellmix"}, aprovação pelo fornecedor`,
  );
  // Percentual e responsável da etapa aberta acompanham os itens novos.
  if (stage.status === "active" || stage.status === "blocked")
    await evaluateStage(null, stageId);
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
    const [stages, settings] = await Promise.all([
      store.list("stages", {
        filter: orderId
          ? { orderId, key: "PACKAGING" }
          : { key: "PACKAGING", status: OPEN_STATUSES },
      }),
      getSettings(),
    ]);
    const open = stages.filter((s) => OPEN_STATUSES.includes(s.status));
    if (!open.length) {
      if (!orderId) quietSince = Date.now();
      return 0;
    }
    const [requirements, orders] = await Promise.all([
      store.list("requirements", {
        filter: {
          stageId: open.map((s) => s.id),
          key: ["art", "art_approval"],
        },
      }),
      store.list("orders", {
        filter: { id: [...new Set(open.map((s) => s.orderId))] },
      }),
    ]);
    let changed = 0;
    for (const stage of open) {
      const order = orders.find((o) => o.id === stage.orderId);
      if (!order || order.status === "CANCELLED") continue;
      const plan = planFor(
        requirements.filter((r) => r.stageId === stage.id),
        artRole(order, settings.agencyValidationEnabled),
      );
      if (!needsChange(plan)) continue;
      try {
        if (await normalizePackagingStage(stage.id)) changed++;
      } catch (error) {
        console.error("[packaging] etapa não ajustada", stage.id, error);
      }
    }
    if (!orderId) quietSince = changed === 0 ? Date.now() : 0;
    return changed;
  } catch (error) {
    console.error("[packaging] ajuste falhou", error);
    return 0;
  }
}
