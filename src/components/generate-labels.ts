import type { Translate } from "@/i18n";
import type { GenerateLabels } from "@/components/selection-quantity";

/*
 * Textos do card "Gerar programação pela quantidade" (Seleção de itens e
 * Nova solicitação usam o mesmo card, docs/PURCHASE_SCHEDULE.md). `selectItem`
 * muda por tela: a Seleção pede o item da tabela; a solicitação, o produto do
 * campo acima.
 */
export function generateLabels(
  t: Translate,
  selectItem: string = t("purchaseRounds.gen.selectItem"),
): GenerateLabels {
  return {
    title: t("purchaseRounds.gen.title"),
    hint: t("purchaseRounds.gen.hint"),
    total: t("purchaseRounds.gen.total"),
    rounds: t("purchaseRounds.gen.rounds"),
    container: t("purchaseRounds.gen.container"),
    perRound: t("purchaseRounds.gen.perRound"),
    perRoundHint: t("purchaseRounds.gen.perRoundHint"),
    totalField: t("purchaseRounds.gen.totalField"),
    totalFieldHint: t("purchaseRounds.gen.totalFieldHint"),
    perRoundRange: t("purchaseRounds.gen.perRoundRange", {
      min: "{min}",
      max: "{max}",
    }),
    submit: t("purchaseRounds.gen.submit"),
    calc: t("purchaseRounds.gen.calc"),
    item: t("purchaseRounds.gen.item", {
      pcs: "{pcs}",
      cbm: "{cbm}",
      cartons: "{cartons}",
      pieces: "{pieces}",
      container: "{container}",
    }),
    selectItem,
    noCarton: t("purchaseRounds.gen.noCarton"),
    noPieces: t("purchaseRounds.gen.noPieces"),
    tooBig: t("purchaseRounds.gen.tooBig", {
      cbm: "{cbm}",
      container: "{container}",
      cap: "{cap}",
    }),
    errorTotal: t("purchaseRounds.gen.errorTotal"),
    errorRounds: t("purchaseRounds.gen.errorRounds", {
      max: "{max}",
    }),
    result: t("purchaseRounds.gen.result", {
      rounds: "{rounds}",
      cartons: "{cartons}",
      pieces: "{pieces}",
      cbm: "{cbm}",
      containers: "{containers}",
      container: "{container}",
    }),
    extra: t("purchaseRounds.gen.extra", { extra: "{extra}" }),
    reduced: t("purchaseRounds.gen.reduced", {
      cartons: "{cartons}",
      rounds: "{rounds}",
    }),
    each: t("purchaseRounds.gen.each", {
      cartons: "{cartons}",
      cbm: "{cbm}",
      n: "{n}",
      pct: "{pct}",
      container: "{container}",
    }),
    eachMany: t("purchaseRounds.gen.eachMany", {
      cartons: "{cartons}",
      cbm: "{cbm}",
      n: "{n}",
      pct: "{pct}",
      container: "{container}",
    }),
    list: t("purchaseRounds.gen.list", { list: "{list}" }),
    listItem: t("purchaseRounds.gen.listItem", {
      i: "{i}",
      n: "{n}",
      pct: "{pct}",
    }),
    listItemMany: t("purchaseRounds.gen.listItemMany", {
      i: "{i}",
      n: "{n}",
      pct: "{pct}",
    }),
    totalContainers: t("purchaseRounds.gen.totalContainers", {
      n: "{n}",
      container: "{container}",
    }),
    load: t("purchaseRounds.gen.load", {
      cartons: "{cartons}",
      cbm: "{cbm}",
      containers: "{containers}",
      container: "{container}",
    }),
    cardPartial: t("purchaseRounds.gen.cardPartial", {
      n: "{n}",
      pct: "{pct}",
    }),
    cardPartialMany: t("purchaseRounds.gen.cardPartialMany", {
      n: "{n}",
      pct: "{pct}",
    }),
    cardFull: t("purchaseRounds.gen.cardFull", { n: "{n}" }),
    cardFullMany: t("purchaseRounds.gen.cardFullMany", {
      n: "{n}",
    }),
    cardFullMargin: t("purchaseRounds.gen.cardFullMargin", {
      n: "{n}",
      pct: "{pct}",
    }),
    cardFullMarginMany: t("purchaseRounds.gen.cardFullMarginMany", {
      n: "{n}",
      pct: "{pct}",
    }),
    up: t("purchaseRounds.gen.up", { pieces: "{pieces}" }),
    upTo: t("purchaseRounds.gen.upTo", { n: "{n}" }),
    upToMany: t("purchaseRounds.gen.upToMany", { n: "{n}" }),
    down: t("purchaseRounds.gen.down", { pieces: "{pieces}" }),
    downTo: t("purchaseRounds.gen.downTo", { n: "{n}" }),
    downToMany: t("purchaseRounds.gen.downToMany", { n: "{n}" }),
    downOff: t("purchaseRounds.gen.downOff"),
    downOffWhy: t("purchaseRounds.gen.downOffWhy"),
    downOffMin: t("purchaseRounds.gen.downOffMin"),
  };
}
