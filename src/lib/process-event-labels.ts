import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { blockLabelKey } from "@/lib/flow";
import {
  MILESTONE_KEYS,
  milestoneTitle,
  type MilestoneKey,
} from "@/lib/milestones";
import {
  PROCESS_EVENT_GROUPS,
  type ProcessEventGroup,
  type ProcessEventKey,
} from "@/lib/process-rules";

/*
 * Rótulos do editor de regras de processo (Configurações → Sankhya →
 * Processos; docs/PROCESSES.md). Puro: a tela e os testes usam os mesmos.
 */

/**
 * Rótulo do evento a partir das traduções que o portal já tem. Marco (fase
 * 4d): "N. Marco — começa/conclui"; etapa antiga: com "(etapa antiga)".
 */
export function eventLabel(t: Translate, event: ProcessEventKey) {
  const [kind, key, moment] = event.split(":");
  if (kind === "request")
    return `${t("processes.kind.request")}: ${t(`reqStatusLabel.${key}` as DictionaryKey)}`;
  if (
    kind === "milestone" &&
    (MILESTONE_KEYS as readonly string[]).includes(key)
  )
    return `${milestoneTitle(t, key as MilestoneKey)} — ${t(`processes.milestone.${moment}` as DictionaryKey)}`;
  if (kind === "stage")
    return `${t(`stage.${key}` as DictionaryKey)}: ${t(`processes.moment.${moment}` as DictionaryKey)} ${t("processes.legacyStage")}`;
  if (kind === "sync")
    return `${t("processes.sync")}: ${t(`processes.sync.entity.${key}` as DictionaryKey)}`;
  return t(`processes.event.${key}` as DictionaryKey);
}

/** Título e explicação do grupo de eventos no editor de regras. */
export function groupLabel(t: Translate, group: ProcessEventGroup) {
  if (group.kind === "milestone" && group.block)
    return {
      title: t("processes.group.milestone", {
        block: t(blockLabelKey(group.block)),
      }),
      // A explicação só no primeiro bloco (Pedido), para não repetir.
      hint:
        group.block ===
        PROCESS_EVENT_GROUPS.find((g) => g.kind === "milestone")?.block
          ? t("processes.group.milestoneHint")
          : null,
    };
  if (group.kind === "stage")
    return {
      title: t("processes.group.stage"),
      hint: t("processes.group.stageHint"),
    };
  return {
    title: t(`processes.group.${group.kind}` as DictionaryKey),
    hint: null,
  };
}

/** Grupo que começa em cada evento (a linha de título vem antes dele). */
const GROUP_AT = new Map(
  PROCESS_EVENT_GROUPS.filter((g) => g.events.length).map((g) => [
    g.events[0],
    g,
  ]),
);

/** O grupo cujo título vem antes deste evento (só o primeiro de cada grupo). */
export const groupAtEvent = (event: ProcessEventKey) => GROUP_AT.get(event);
