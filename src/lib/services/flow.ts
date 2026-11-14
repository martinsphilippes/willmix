import { cache } from "react";
import type { User } from "@/lib/db/schema";
import { pendingTasksFor, type Task } from "./tasks";
import { tasksForFunctions } from "@/lib/task-owner";
import {
  countByStep,
  flowStepsOf,
  stepId,
  stepsOf,
  type FlowBlock,
  type FlowCount,
  type FlowStep,
} from "@/lib/flow";

/*
 * Pendências do login por passo do menu (docs/FLOW_MENU.md): as mesmas da
 * tela Pendências (com o filtro das funções do operador), lidas uma vez por
 * página (cache do React: o menu, o Overview e a tela do passo dividem a
 * mesma leitura). Só leitura; nada novo no banco.
 */
export const flowTasksFor = cache(async (user: User): Promise<Task[]> =>
  tasksForFunctions(user, await pendingTasksFor(user)),
);

/** Contadores do menu: `bloco/passo` → quantas esperam e quantas atrasaram. */
export async function flowCountsFor(
  user: User,
): Promise<Map<string, FlowCount>> {
  return countByStep(await flowTasksFor(user));
}

/** As pendências de um passo, das atrasadas às sem prazo (a ordem das Pendências). */
export async function flowCasesOf(user: User, step: FlowStep): Promise<Task[]> {
  const id = stepId(step);
  return (await flowTasksFor(user)).filter((t) =>
    flowStepsOf(t).some((x) => stepId(x) === id),
  );
}

export interface FlowStepSummary {
  step: FlowStep;
  count: number;
  overdue: number;
  /** Dias, em média, desde que as pendências chegaram ao passo (nulo: não se sabe). */
  avgDays: number | null;
  /** A mais antiga, em dias. */
  maxDays: number | null;
  tasks: Task[];
}

const DAY = 86_400_000;

/** Linha do tempo do bloco: cada passo com o que espera, o que atrasou e há quantos dias. */
export async function flowBlockSummary(
  user: User,
  block: FlowBlock,
  now = new Date(),
): Promise<FlowStepSummary[]> {
  const tasks = await flowTasksFor(user);
  return stepsOf(block)
    .filter((step) => !step.badgeOnly)
    .map((step) => {
      const id = stepId(step);
      const mine = tasks.filter((t) =>
        flowStepsOf(t).some((x) => stepId(x) === id),
      );
      const ages = mine
        .map((t) => (t.sinceAt ? Date.parse(t.sinceAt) : NaN))
        .filter((ms) => Number.isFinite(ms))
        .map((ms) => Math.max(0, Math.floor((now.getTime() - ms) / DAY)));
      return {
        step,
        count: mine.length,
        overdue: mine.filter((t) => t.overdue).length,
        avgDays: ages.length
          ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
          : null,
        maxDays: ages.length ? Math.max(...ages) : null,
        tasks: mine,
      };
    });
}
