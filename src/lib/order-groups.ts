import type { Order, Requirement, Role, StageKey } from "@/lib/db/schema";
import { STAGE_KEYS } from "@/lib/db/schema";
import {
  isOffFlowItem,
  legacyGroupOfItem,
  milestoneOfStoredItem,
  type MilestoneKey,
  type MilestoneState,
} from "@/lib/milestones";

/*
 * Fase 5g (docs/MILESTONES.md): sem etapas gravadas. Algumas telas ainda
 * dividem os itens do pedido como as etapas antigas dividiam (a linha do
 * tempo do operador, as partes do pedido, a ajuda de cada grupo): esses
 * grupos saem só dos itens, pelo marco e pela chave de cada um
 * (`legacyGroupOfItem`), com a situação tirada dos marcos. Nada lê a tabela
 * `stages`. Regra pura.
 */

export type ItemGroupStatus =
  "pending" | "active" | "blocked" | "done" | "cancelled";

/** Grupo de itens do pedido (no lugar da etapa antiga). */
export interface ItemGroup {
  /** `pedido|CHAVE`: estável, só para agrupar na tela. */
  id: string;
  orderId: string;
  key: StageKey;
  status: ItemGroupStatus;
  /** Papel do próximo item obrigatório aberto (sem ele, o do primeiro item). */
  responsibleRole: Role;
  /** Início mais antigo dos marcos dos itens (linhas de `order_milestones`). */
  startedAt: string | null;
  /** Prazo mais próximo dos marcos abertos dos itens. */
  dueAt: string | null;
}

/** Chave do grupo do item (a etapa antiga equivalente). */
export const itemGroupKey = (
  r: Pick<Requirement, "key"> & {
    step?: string | null;
    milestoneKey?: string | null;
  },
  order: Pick<Order, "flow">,
): StageKey => legacyGroupOfItem(r, order) ?? "ORDER_CREATED";

/** Id do grupo do item no pedido. */
export const itemGroupId = (
  r: Pick<Requirement, "key" | "orderId"> & {
    step?: string | null;
    milestoneKey?: string | null;
  },
  order: Pick<Order, "id" | "flow">,
): string => `${order.id}|${itemGroupKey(r, order)}`;

/**
 * Os grupos do pedido que têm item, na ordem antiga, com a situação pelos
 * marcos: travado com um marco travado dos itens; em andamento com um marco
 * em andamento; concluído com os obrigatórios feitos (ou o pedido
 * encerrado); senão, ainda não começou. Pedido cancelado: cancelado (o que
 * estava feito continua feito).
 */
export function itemGroupsOf(
  order: Pick<Order, "id" | "flow" | "status">,
  requirements: readonly Requirement[],
  states: ReadonlyMap<MilestoneKey, MilestoneState>,
  rows: readonly {
    key: string;
    status?: string | null;
    startedAt?: string | null;
    dueAt?: string | null;
  }[] = [],
): ItemGroup[] {
  const rowOf = new Map(rows.map((r) => [r.key, r]));
  const out: ItemGroup[] = [];
  // Grupos sem item (ex.: "Pedido criado" do pedido de compra): ficam na
  // lista, como as etapas ficavam, porque as partes do pedido aparecem
  // debaixo deles; concluídos quando um grupo seguinte já começou.
  const empty: number[] = [];
  for (const key of STAGE_KEYS) {
    if (key === "CLOSED") continue;
    const mine = requirements.filter(
      (r) => r.orderId === order.id && itemGroupKey(r, order) === key,
    );
    if (!mine.length) {
      empty.push(out.length);
      out.push({
        id: `${order.id}|${key}`,
        orderId: order.id,
        key,
        status:
          order.status === "CLOSED"
            ? "done"
            : order.status === "CANCELLED"
              ? "cancelled"
              : "pending",
        responsibleRole: "operator",
        startedAt: null,
        dueAt: null,
      });
      continue;
    }
    const required = mine.filter((r) => r.required && !isOffFlowItem(r));
    const milestones = new Set(
      mine
        .map((r) => milestoneOfStoredItem(r))
        .filter((k): k is MilestoneKey => !!k),
    );
    const list = [...milestones];
    const allDone = required.every((r) => r.status === "done");
    const anyRow = (s: string) => list.some((k) => rowOf.get(k)?.status === s);
    const status: ItemGroupStatus =
      order.status === "CANCELLED"
        ? allDone
          ? "done"
          : "cancelled"
        : order.status === "CLOSED" || (allDone && required.length > 0)
          ? "done"
          : anyRow("blocked")
            ? "blocked"
            : list.some((k) => {
                  const s = states.get(k);
                  return s === "active" || s === "done";
                })
              ? "active"
              : allDone
                ? "done"
                : "pending";
    const next = required.find((r) => r.status !== "done");
    const dates = (pick: (k: MilestoneKey) => string | null | undefined) =>
      list
        .map(pick)
        .filter((d): d is string => !!d)
        .sort()[0] ?? null;
    out.push({
      id: `${order.id}|${key}`,
      orderId: order.id,
      key,
      status,
      responsibleRole: (next ?? mine[0]).role,
      startedAt: dates((k) => rowOf.get(k)?.startedAt),
      dueAt: dates((k) =>
        rowOf.get(k)?.status === "done" ? null : rowOf.get(k)?.dueAt,
      ),
    });
  }
  for (const i of empty)
    if (
      out[i].status === "pending" &&
      out.slice(i + 1).some((g) => g.status !== "pending")
    )
      out[i] = { ...out[i], status: "done" };
  return out;
}
