import type { Translate } from "@/i18n";
import type { ContainerCompositionLabels } from "./container-composition";
import type { OrderPlanLabels } from "./request-items";
import type { ScheduleLabels } from "./request-schedule";
import type { generateLabels } from "./generate-labels";

/*
 * Programações como entregas ao cliente, nas telas TS - Trading Sales e
 * Venda - Encomenda (dono, 16/11/2026; docs/REQUEST_SCREENS.md, seção 6):
 * cada programação é uma entrega prevista ao cliente e a data dela é a do
 * recebimento pelo cliente (não a de produção, embarque ou saída). Só os
 * textos mudam: estas funções trocam, por cima dos rótulos de sempre, os que
 * falam das programações. O conceito, os cálculos e os nomes técnicos ficam;
 * a Nova solicitação de Encomendas segue com os textos de antes.
 */

type GenerateLabels = ReturnType<typeof generateLabels>;

/** Bloco do pedido: quantidade de entregas, 1º recebimento, intervalo e datas. */
export function deliveryPlanLabels(
  t: Translate,
  base: OrderPlanLabels,
): OrderPlanLabels {
  return {
    ...base,
    title: t("deliverySchedule.plan.title"),
    hint: t("deliverySchedule.plan.hint"),
    count: t("deliverySchedule.plan.count"),
    countHint: t("deliverySchedule.plan.countHint"),
    single: t("deliverySchedule.plan.single"),
    interval: t("deliverySchedule.interval"),
    firstDate: t("deliverySchedule.firstDate"),
    n: t("deliverySchedule.n", { n: "{n}" }),
    receipt: t("deliverySchedule.receipt"),
    dates: t("deliverySchedule.plan.dates"),
    minDate: t("deliverySchedule.plan.minDate", {
      date: "{date}",
      launch: "{launch}",
    }),
    tooSoon: t("deliverySchedule.plan.tooSoon", { date: "{date}" }),
    datesHint: t("deliverySchedule.plan.datesHint"),
    edit: t("deliverySchedule.plan.edit", { n: "{n}" }),
    unpin: t("deliverySchedule.plan.unpin", { n: "{n}" }),
    issue: t("deliverySchedule.plan.issue", {
      n: "{n}",
      prev: "{prev}",
      date: "{date}",
    }),
  };
}

/** Cada produto: a quantidade dele em cada entrega, com o recebimento previsto. */
export function deliveryItemLabels(
  t: Translate,
  base: ScheduleLabels,
): ScheduleLabels {
  return {
    ...base,
    toggle: t("deliverySchedule.item.toggle"),
    ask: t("deliverySchedule.item.ask"),
    hint: t("deliverySchedule.item.hint"),
    interval: t("deliverySchedule.interval"),
    firstDate: t("deliverySchedule.firstDate"),
    n: t("deliverySchedule.n", { n: "{n}" }),
    // "Recebimento previsto: 16/03/2027" (antes, "Pedido em").
    expected: t("deliverySchedule.receipt"),
    add: t("deliverySchedule.item.add"),
    remove: t("deliverySchedule.item.remove", { n: "{n}" }),
    off: t("deliverySchedule.item.off"),
  };
}

/** Gerador pela quantidade: caixas e containers de cada entrega programada. */
export function deliveryGenerateLabels<T extends Partial<GenerateLabels>>(
  t: Translate,
  base: T,
): T {
  return {
    ...base,
    title: t("deliverySchedule.gen.title"),
    hint: t("deliverySchedule.gen.hint"),
    rounds: t("deliverySchedule.gen.rounds"),
    perRound: t("deliverySchedule.gen.perRound"),
    perRoundHint: t("deliverySchedule.gen.perRoundHint"),
    totalFieldHint: t("deliverySchedule.gen.totalFieldHint"),
    submit: t("deliverySchedule.gen.submit"),
    errorRounds: t("deliverySchedule.gen.errorRounds", { max: "{max}" }),
    result: t("deliverySchedule.gen.result", {
      rounds: "{rounds}",
      cartons: "{cartons}",
      pieces: "{pieces}",
      cbm: "{cbm}",
      containers: "{containers}",
      container: "{container}",
    }),
    short: t("deliverySchedule.gen.short", {
      missing: "{missing}",
      rounds: "{rounds}",
      cartons: "{cartons}",
    }),
    shortDown: t("deliverySchedule.gen.shortDown", { rounds: "{rounds}" }),
    shortDownOne: t("deliverySchedule.gen.shortDownOne"),
    shortKeep: t("deliverySchedule.gen.shortKeep", { rounds: "{rounds}" }),
    each: t("deliverySchedule.gen.each", {
      cartons: "{cartons}",
      cbm: "{cbm}",
      n: "{n}",
      pct: "{pct}",
      container: "{container}",
    }),
    eachMany: t("deliverySchedule.gen.eachMany", {
      cartons: "{cartons}",
      cbm: "{cbm}",
      n: "{n}",
      pct: "{pct}",
      container: "{container}",
    }),
    list: t("deliverySchedule.gen.list", { list: "{list}" }),
    noPieces: t("deliverySchedule.gen.noPieces"),
    noCarton: t("deliverySchedule.gen.noCarton"),
    noData: t("deliverySchedule.gen.noData"),
    ...(base.res
      ? {
          res: {
            ...base.res,
            title: t("deliverySchedule.res.title"),
            perRound: t("deliverySchedule.res.perRound"),
            rounds: t("deliverySchedule.gen.rounds"),
          },
        }
      : {}),
  };
}

/** Composição de containers: a coluna de cada programação com o recebimento previsto. */
export function deliveryCompositionLabels(
  t: Translate,
  base: ContainerCompositionLabels,
): ContainerCompositionLabels {
  return {
    ...base,
    hint: t("deliverySchedule.composition.hint"),
    roundN: t("deliverySchedule.n", { n: "{n}" }),
    roundDate: t("deliverySchedule.composition.roundDate", { date: "{date}" }),
  };
}
