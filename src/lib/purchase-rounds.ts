import type {
  ColorPlan,
  Order,
  PurchaseRound,
  RequestSchedule,
} from "@/lib/db/schema";
import { colorsOfRound } from "@/lib/color-split";
import { addDaysIso, scheduleTotal } from "@/lib/workflow/request-schedule";

/*
 * Programação de compra (docs/PURCHASE_SCHEDULE.md): na escolha do grupo a
 * Wellmix diz em quantas rodadas compra, quantas peças em cada uma e o
 * intervalo entre elas. A solicitação ao fornecedor leva a programação; o
 * pedido de compra vira o pedido pai (o total e a negociação) e cada rodada
 * vira um pedido filho no dia combinado. Só a conta, sem banco.
 */

/** Rodadas de compra que a escolha do grupo aceita (a solicitação do cliente fica em 6). */
export const MAX_PURCHASE_ROUNDS = 12;

export interface ScheduleSummary {
  rounds: number;
  /** Peças por rodada, na ordem. */
  perRound: number[];
  /** Todas iguais: o número; diferentes: nulo. */
  sameQuantity: number | null;
  total: number;
  intervalDays: number;
  firstDate: string;
  lastDate: string;
}

/** O que o responsável pelo booking lê: rodadas, peças por rodada e total. */
export function scheduleSummary(
  schedule: RequestSchedule | null | undefined,
): ScheduleSummary | null {
  if (!schedule?.items.length) return null;
  const perRound = schedule.items.map((i) => i.quantity);
  return {
    rounds: perRound.length,
    perRound,
    sameQuantity: perRound.every((q) => q === perRound[0]) ? perRound[0] : null,
    total: scheduleTotal(schedule),
    intervalDays: schedule.intervalDays,
    firstDate: schedule.firstDate,
    lastDate: schedule.items[schedule.items.length - 1].expectedAt,
  };
}

/** Mesmas datas (1ª data, intervalo e número de rodadas). */
export function sameDates(a: RequestSchedule, b: RequestSchedule): boolean {
  return (
    a.firstDate === b.firstDate &&
    a.intervalDays === b.intervalDays &&
    a.items.length === b.items.length
  );
}

export type PurchaseRoundsError =
  "purchase_order_schedule_mixed" | "purchase_order_schedule_qty";

/**
 * Rodadas do pedido pai a partir dos produtos do pedido. Sem programação em
 * nenhum: nulo (pedido de sempre). Com programação, todos precisam ter a
 * mesma (datas iguais); cada rodada leva as peças de cada produto.
 */
export function buildPurchaseRounds(
  lines: Array<{
    productId: string;
    schedule: RequestSchedule | null;
    /** Variações de cor da solicitação: as peças de cada cor por rodada. */
    colorPlan?: ColorPlan | null;
  }>,
): { rounds: PurchaseRound[] | null } | { error: PurchaseRoundsError } {
  const scheduled = lines.filter((l) => l.schedule?.items.length);
  if (!scheduled.length) return { rounds: null };
  if (scheduled.length !== lines.length)
    return { error: "purchase_order_schedule_mixed" };
  const base = scheduled[0].schedule!;
  if (scheduled.some((l) => !sameDates(base, l.schedule!)))
    return { error: "purchase_order_schedule_mixed" };
  const rounds = base.items.map((round, i) => ({
    index: i + 1,
    expectedAt: addDaysIso(base.firstDate, base.intervalDays * i),
    items: scheduled.map((l) => {
      const colors = colorsOfRound(l.colorPlan, i);
      return {
        productId: l.productId,
        quantity: Math.round(l.schedule!.items[i].quantity),
        ...(colors ? { colors } : {}),
      };
    }),
    orderId: null,
    createdAt: null,
  }));
  if (
    rounds.some((r) =>
      r.items.some((it) => !Number.isFinite(it.quantity) || it.quantity <= 0),
    )
  )
    return { error: "purchase_order_schedule_qty" };
  return { rounds };
}

/** O pedido é pai de uma programação de compra. */
export const isRoundsParent = (order: Pick<Order, "purchaseRounds">): boolean =>
  !!order.purchaseRounds?.length;

/** Rodadas cujo dia chegou (AAAA-MM-DD ≤ hoje) e que ainda não viraram pedido. */
export function dueRounds(
  rounds: PurchaseRound[] | null | undefined,
  today: string,
): PurchaseRound[] {
  return (rounds ?? []).filter((r) => !r.orderId && r.expectedAt <= today);
}

/** Item de raia do pai (`chave__itemDoPai`) com o item do filho do mesmo produto. */
export function mapLaneKey(
  key: string,
  parentItems: Array<{ id: string; productId: string | null }>,
  childItems: Array<{ id: string; productId: string | null }>,
): string | null {
  const at = key.lastIndexOf("__");
  if (at < 0) return key;
  const parentItemId = key.slice(at + 2);
  const parent = parentItems.find((i) => i.id === parentItemId);
  if (!parent?.productId) return null;
  const child = childItems.find((i) => i.productId === parent.productId);
  return child ? `${key.slice(0, at)}__${child.id}` : null;
}

/*
 * "Gerar programação" na Seleção (regra do dono, 12/11/2026; a mesma da ficha
 * de compra): tudo sai da QUANTIDADE de produto. A Wellmix digita o total de
 * peças e o número de rodadas; o total vira caixas master inteiras do item
 * escolhido, divididas igualmente entre as rodadas (o resto vai para as
 * primeiras). Os containers de cada rodada são consequência da conta, ninguém
 * os digita: caixas da rodada ÷ caixas que cabem no container. Em cada rodada
 * há dois ajustes para fechar o container: aumentar até o próximo container
 * cheio ou diminuir até o de baixo. O container conta como cheio com 95% ou
 * mais de ocupação (margem de 5%), nunca acima da capacidade.
 */

/** Margem para o container contar como cheio: pode faltar até 5%. */
export const CONTAINER_FULL_MARGIN_PCT = 5;

export interface RoundsPlanInput {
  /** Peças desejadas no total. */
  total: number;
  /** Rodadas informadas (1 a `maxRounds`). */
  rounds: number;
  masterCartonQty: number | null | undefined;
  cbmPerCarton: number | null | undefined;
  containerCbm: number | null | undefined;
  maxRounds?: number;
}

export interface PlannedRound {
  pieces: number;
  cartons: number;
  cbm: number;
  /** Containers que a rodada ocupa (ex.: 1, 0,62). */
  containers: number;
}

export interface RoundsPlan {
  rounds: PlannedRound[];
  /** Peças somadas (total arredondado para caixas inteiras). */
  pieces: number;
  /** Peças a mais pelo arredondamento para caixas inteiras. */
  extraPieces: number;
  cartons: number;
  cbm: number;
  /** Containers que o total ocupa (ex.: 2,4). */
  containers: number;
  cartonsPerContainer: number;
  piecesPerContainer: number;
  /** Menos rodadas que as pedidas: não há uma caixa inteira para cada uma. */
  reduced: boolean;
}

export type RoundsPlanError = "total" | "rounds" | "carton" | "too_big";

const pos = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
/** Fração de container: 6 casas, para o que a tela mostra com 2 não arredondar duas vezes. */
const r6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/** Caixas master inteiras que cabem num container (0 = a caixa não cabe). */
export function cartonsPerContainer(
  cbmPerCarton: number,
  containerCbm: number,
): number {
  return Math.floor(containerCbm / cbmPerCarton + 1e-9);
}

/**
 * O gerador recebe o total em CAIXAS master (decisão do dono, 13/11/2026); a
 * programação continua em peças: caixas × peças por caixa master do item
 * escolhido. Nulo sem as peças por caixa (não há como converter) ou com um
 * número de caixas que não é inteiro e positivo.
 */
export function piecesFromCartons(
  cartons: number,
  masterCartonQty: number | null | undefined,
): number | null {
  if (!pos(masterCartonQty) || !pos(cartons) || !Number.isInteger(cartons))
    return null;
  return cartons * masterCartonQty;
}

/** Peças em caixas master inteiras (para cima, como o gerador arredonda). */
export function cartonsFromPieces(
  pieces: number,
  masterCartonQty: number | null | undefined,
): number | null {
  if (!pos(masterCartonQty) || !pos(pieces)) return null;
  return Math.ceil(pieces / masterCartonQty - 1e-9);
}

/** Número inteiro digitado: pontos, vírgulas e espaços são separador de milhar. */
export function parseCount(text: string): number {
  const t = String(text).replace(/[.,\s]/g, "");
  return t ? Number(t) : NaN;
}

/** O último campo de quantidade digitado no gerador e o que foi digitado. */
export interface TypedQuantity {
  unit: "cartons" | "pieces";
  text: string;
  /**
   * As peças que estavam na tela ao digitar as caixas: ficam no campo quando
   * o item não tem peças por caixa master (não há como converter).
   */
  pieces: string;
}

/**
 * "Total de caixas" e "Quantidade (peças)" são o mesmo número em duas
 * unidades (pedido do dono, 13/11/2026): o que se digita num aparece no
 * outro, pelas peças por caixa master do item escolhido. 10 caixas de 48 são
 * 480 peças; 500 peças são 11 caixas (inteiras, para cima).
 *
 * Sem nada digitado, os dois acompanham a quantidade de base (`base`: a
 * gravada ou a soma das rodadas). Com as peças em branco vale a quantidade
 * da planilha ao gravar, e é ela que as caixas mostram.
 */
export function quantityFields(input: {
  typed: TypedQuantity | null;
  /** Quantidade de base, em peças (texto do campo). */
  base: string;
  masterCartonQty: number | null | undefined;
  sheetQty: number | null | undefined;
}): { cartons: string; pieces: string } {
  const { typed, masterCartonQty } = input;
  const pieces =
    typed === null
      ? input.base
      : typed.unit === "pieces"
        ? typed.text
        : pos(masterCartonQty)
          ? String(
              piecesFromCartons(parseCount(typed.text), masterCartonQty) ?? "",
            )
          : typed.pieces;
  if (typed?.unit === "cartons") return { cartons: typed.text, pieces };
  const now = pieces.trim() ? parseCount(pieces) : (input.sheetQty ?? NaN);
  return {
    cartons: String(cartonsFromPieces(now, masterCartonQty) ?? ""),
    pieces,
  };
}

/**
 * O que acontece com a programação da tela quando o item marcado em
 * "Escolher" muda (pedido do dono, 13/11/2026). As rodadas são do item com
 * cuja caixa foram feitas:
 *
 * - `drop`: trocar de item (ou desmarcar) desfaz a programação ainda não
 *   gravada do item anterior;
 * - `restore`: voltar ao item da escolha gravada traz de volta a programação
 *   gravada com ele (nada foi apagado), a não ser que o usuário a tenha
 *   desligado em "Sem programação" com esse item marcado;
 * - `keep`: sem programação na tela, nada muda.
 */
export function scheduleOnItemChange(input: {
  /** A programação está ligada na tela. */
  on: boolean;
  /** O item marcado agora (nulo: nenhum). */
  next: string | null;
  /** O item da escolha gravada, quando ela tem programação gravada. */
  savedItem: string | null;
  /** A programação gravada ainda pode voltar (o usuário não a desligou). */
  savedKept: boolean;
}): "keep" | "drop" | "restore" {
  if (input.next !== null && input.next === input.savedItem && input.savedKept)
    return "restore";
  return input.on ? "drop" : "keep";
}

export function planPurchaseRounds(
  input: RoundsPlanInput,
): { plan: RoundsPlan } | { error: RoundsPlanError } {
  const max = Math.max(1, Math.floor(input.maxRounds ?? MAX_PURCHASE_ROUNDS));
  const { masterCartonQty: perCarton, cbmPerCarton, containerCbm } = input;
  if (!pos(input.total) || input.total > 100_000_000) return { error: "total" };
  const asked = Math.floor(input.rounds);
  if (!Number.isFinite(asked) || asked < 1 || asked > max)
    return { error: "rounds" };
  if (!pos(perCarton) || !pos(cbmPerCarton) || !pos(containerCbm))
    return { error: "carton" };
  const perContainer = cartonsPerContainer(cbmPerCarton, containerCbm);
  if (perContainer < 1) return { error: "too_big" };
  const cartons = Math.ceil(input.total / perCarton - 1e-9);
  // Caixa é inteira: com menos caixas que rodadas, ficam as rodadas que dá.
  const count = Math.min(asked, cartons);
  const base = Math.floor(cartons / count);
  const rest = cartons - base * count;
  const rounds: PlannedRound[] = Array.from({ length: count }, (_, i) => {
    const c = base + (i < rest ? 1 : 0);
    return {
      pieces: c * perCarton,
      cartons: c,
      cbm: r4(c * cbmPerCarton),
      containers: r6(c / perContainer),
    };
  });
  return {
    plan: {
      rounds,
      pieces: cartons * perCarton,
      extraPieces: cartons * perCarton - Math.round(input.total),
      cartons,
      cbm: r4(cartons * cbmPerCarton),
      containers: r6(cartons / perContainer),
      cartonsPerContainer: perContainer,
      piecesPerContainer: perContainer * perCarton,
      reduced: count < asked,
    },
  };
}

/** Um ajuste da rodada para fechar o container. */
export interface RoundStep {
  /** Containers cheios da rodada depois do ajuste. */
  containers: number;
  /** Peças a acrescentar (aumentar) ou a tirar (diminuir); sempre positivo. */
  pieces: number;
  /** Peças da rodada depois do ajuste. */
  target: number;
}

export interface RoundLoad {
  cartons: number;
  cbm: number;
  /** Containers que a rodada ocupa (0,72; 2,4). Nulo sem container ou com a caixa maior que ele. */
  containers: number | null;
  /** Containers que a rodada precisa (para cima). */
  needed: number | null;
  /** Ocupação do último container da rodada (0 a 100; 0 = menos de 1%). */
  lastPct: number | null;
  /** Só containers cheios: o último com 95% ou mais (margem de 5%). */
  full: boolean;
  /** Aumentar até o próximo container cheio. */
  up: RoundStep | null;
  /** Diminuir até o container cheio de baixo (nunca zera a rodada). */
  down: RoundStep | null;
}

/** Teto de peças de um ajuste (o mesmo do total do gerador). */
const MAX_ROUND_PIECES = 100_000_000;

/**
 * Caixas, CBM e ocupação de uma rodada com N peças, e os dois ajustes para
 * fechar o container. Caixas são inteiras; a ocupação é medida em caixas que
 * cabem no container (o container com todas as caixas que cabem está 100%).
 */
export function roundLoad(
  pieces: number,
  masterCartonQty: number | null | undefined,
  cbmPerCarton: number | null | undefined,
  containerCbm: number | null | undefined,
): RoundLoad | null {
  if (!pos(pieces) || !pos(masterCartonQty) || !pos(cbmPerCarton)) return null;
  const cartons = Math.ceil(pieces / masterCartonQty - 1e-9);
  const perContainer = pos(containerCbm)
    ? cartonsPerContainer(cbmPerCarton, containerCbm)
    : 0;
  const cbm = r4(cartons * cbmPerCarton);
  if (perContainer < 1)
    return {
      cartons,
      cbm,
      containers: null,
      needed: null,
      lastPct: null,
      full: false,
      up: null,
      down: null,
    };
  const needed = Math.ceil(cartons / perContainer - 1e-9);
  // Caixas no último container (1 a perContainer).
  const inLast = cartons - (needed - 1) * perContainer;
  const exact = inLast === perContainer;
  // Conta em inteiros: "cheio" e o percentual mostrado nunca discordam.
  const pct = Math.floor((inLast * 100) / perContainer);
  const current = Math.round(pieces);
  const step = (containers: number): RoundStep | null => {
    const target = containers * perContainer * masterCartonQty;
    return containers >= 1 && target !== current && target <= MAX_ROUND_PIECES
      ? { containers, pieces: Math.abs(target - current), target }
      : null;
  };
  return {
    cartons,
    cbm,
    containers: r6(cartons / perContainer),
    needed,
    lastPct: exact ? 100 : pct,
    full: exact || pct >= 100 - CONTAINER_FULL_MARGIN_PCT,
    up: step(exact ? needed + 1 : needed),
    down: step(needed - 1),
  };
}

/**
 * "Containers por rodada" (informativo): entre as rodadas, o menor e o maior
 * número de containers que cada uma precisa (`needed`, inteiro) e ocupa
 * (`min`/`max`, fração). Nulo sem rodada com peças ou sem a caixa master, o
 * CBM e o container.
 */
export function containersPerRound(
  quantities: readonly number[],
  masterCartonQty: number | null | undefined,
  cbmPerCarton: number | null | undefined,
  containerCbm: number | null | undefined,
): {
  min: number;
  max: number;
  needed: { min: number; max: number; total: number };
} | null {
  const loads = quantities
    .map((q) => roundLoad(q, masterCartonQty, cbmPerCarton, containerCbm))
    .filter(
      (l): l is RoundLoad & { containers: number; needed: number } =>
        !!l && l.containers !== null && l.needed !== null,
    );
  if (!loads.length) return null;
  const used = loads.map((l) => l.containers);
  const needed = loads.map((l) => l.needed);
  return {
    min: Math.min(...used),
    max: Math.max(...used),
    needed: {
      min: Math.min(...needed),
      max: Math.max(...needed),
      total: needed.reduce((a, n) => a + n, 0),
    },
  };
}
