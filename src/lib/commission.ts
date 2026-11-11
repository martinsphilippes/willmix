/*
 * Acordos comerciais e comissões (docs/COMMISSIONS.md): o cálculo, puro. O
 * simulador, a apuração e os testes usam esta mesma função: o que a
 * simulação mostra é o que a apuração grava.
 *
 * Dinheiro em centavos inteiros durante a conta; arredondamento "meio para
 * cima" em 2 casas, em cada linha da memória de cálculo.
 */

/** Fatos verificáveis do pedido (vêm dos dados reais; "manual" é a confirmação de uma pessoa autorizada). */
export const COMMISSION_EVENTS = [
  "order_created",
  "inspection_done",
  "shipped",
  "delivered",
  "closed",
  "invoiced",
  "received_first",
  "received_full",
  "manual",
] as const;
export type CommissionEvent = (typeof COMMISSION_EVENTS)[number];

export const COMPONENT_KINDS = ["percent", "fixed", "per_unit"] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

/**
 * Base do percentual. "items" = soma dos itens (quantidade × preço), calculada
 * item a item; as outras são do pedido inteiro. "received" = o que o cliente
 * já pagou (confirmado).
 */
export const COMMISSION_BASES = [
  "items",
  "order_sell",
  "order_fob",
  "received",
] as const;
export type CommissionBase = (typeof COMMISSION_BASES)[number];

export interface CommissionTier {
  /** Limite superior da faixa; nulo = sem limite (a última). */
  upTo: number | null;
  rate: number;
}

export interface CommissionComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  base: CommissionBase;
  /** Percentual (kind = percent, sem faixas). */
  rate: number | null;
  /** Valor fixo (fixed) ou por unidade (per_unit), na moeda do acordo. */
  amount: number | null;
  /** Linhas de produto em que vale (base "items" e per_unit); vazio = todas. */
  lineIds: string[];
  /** Faixas sobre a base (só percentual de base do pedido). */
  tiers: CommissionTier[] | null;
  /** progressive = cada faixa com a sua taxa; whole = a taxa da faixa atingida na base inteira. */
  tierMode: "progressive" | "whole";
  /** Soma às outras regras da mesma categoria (bônus); senão disputa com elas. */
  accumulate: boolean;
  /** Só vale depois deste fato (bônus por sucesso). */
  successEvent: CommissionEvent | null;
  floor: number | null;
  cap: number | null;
}

export interface AgreementScope {
  customerIds: string[];
  supplierIds: string[];
  lineIds: string[];
}

export interface AgreementDef {
  id: string;
  /** Mesmo valor em todas as versões do acordo. */
  rootId: string;
  version: number;
  name: string;
  /** Categoria de remuneração: a exceção individual substitui o padrão da mesma categoria. */
  category: string;
  priority: number;
  /** Empresa ou pessoa (cadastro) beneficiária; nulo = acordo padrão de um tipo. */
  beneficiaryPartyId: string | null;
  /** Tipo de parceiro beneficiário (o do pedido recebe); nulo no individual. */
  beneficiaryType: string | null;
  scope: AgreementScope;
  /** Vigência (datas ISO, inclusive); nulo = sem limite. */
  validFrom: string | null;
  validTo: string | null;
  /** Moeda dos valores fixos e da apuração. */
  currency: string;
  generateOn: CommissionEvent;
  /** Fato que libera o pagamento; "received" usa o recebido do cliente. */
  releaseOn: CommissionEvent | "received";
  /** Com "received": proporcional ao recebido, ou só com tudo recebido. */
  releaseMode: "proportional" | "full";
  dueDays: number;
  components: CommissionComponent[];
}

export interface OperationItem {
  id: string;
  name: string;
  lineId: string | null;
  quantity: number;
  /** Quantidade × preço do item; nulo = item sem preço. */
  amount: number | null;
}

/** O pedido como a comissão o vê. */
export interface Operation {
  orderId: string;
  /** Data de referência para escolher a versão do acordo (ISO). */
  refDate: string;
  currency: string;
  customerId: string | null;
  supplierId: string | null;
  items: OperationItem[];
  sellTotal: number | null;
  fobTotal: number | null;
  /** Recebido do cliente, confirmado, na moeda do pedido; nulo = não se sabe. */
  received: number | null;
  events: CommissionEvent[];
  /** Parceiro de cada tipo ligado ao pedido ("carrier" → id). */
  partiesByType: Record<string, string | null>;
  cancelled: boolean;
}

export interface MemoryLine {
  agreementId: string;
  agreementName: string;
  version: number;
  componentId: string;
  componentName: string;
  kind: ComponentKind;
  itemId: string | null;
  itemName: string | null;
  base: number | null;
  rate: number | null;
  /** Valor da linha, em moeda (2 casas). */
  value: number;
  note: string | null;
}

export interface ReplacedRule {
  agreementName: string;
  componentName: string;
  itemName: string | null;
  byAgreementName: string;
  reason: "individual" | "priority" | "specific";
}

export interface ComputedEntry {
  beneficiaryPartyId: string;
  agreementId: string;
  rootId: string;
  version: number;
  agreementName: string;
  category: string;
  currency: string;
  amount: number;
  /** Parte já liberada para pagamento. */
  released: number;
  releaseFraction: number;
  dueDays: number;
  lines: MemoryLine[];
  /** O que falta para calcular (base indisponível, moeda diferente). Nunca troca uma base por outra. */
  pending: string[];
}

export interface CommissionResult {
  entries: ComputedEntry[];
  replaced: ReplacedRule[];
  /** Regras exclusivas de mesma precedência no mesmo item ou base. */
  conflicts: Array<{ a: string; b: string; where: string }>;
  /** Acordos que valem, mas esperam o fato que gera a comissão. */
  waiting: Array<{ agreementName: string; event: CommissionEvent }>;
}

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const money = (c: number) => Math.round(c) / 100;
/** Percentual de um valor em centavos, meio para cima. */
const pct = (baseCents: number, rate: number) =>
  Math.round((baseCents * rate) / 100 + Number.EPSILON);

/** A versão do acordo vale na data? */
export function agreementValidAt(a: AgreementDef, date: string): boolean {
  const day = date.slice(0, 10);
  return (
    (!a.validFrom || a.validFrom.slice(0, 10) <= day) &&
    (!a.validTo || a.validTo.slice(0, 10) >= day)
  );
}

const inScope = (a: AgreementDef, op: Operation) =>
  (!a.scope.customerIds.length ||
    (!!op.customerId && a.scope.customerIds.includes(op.customerId))) &&
  (!a.scope.supplierIds.length ||
    (!!op.supplierId && a.scope.supplierIds.includes(op.supplierId)));

/**
 * Quem recebe por este acordo neste pedido. Padrão de um tipo: o parceiro
 * desse tipo ligado ao pedido. Individual: a empresa do acordo, se ela está
 * ligada ao pedido ou se o acordo diz de que clientes ou fornecedores vale
 * (sem isso um acordo individual pagaria em todo pedido).
 */
export function beneficiaryOf(a: AgreementDef, op: Operation): string | null {
  if (!inScope(a, op)) return null;
  if (a.beneficiaryPartyId) {
    const linked =
      Object.values(op.partiesByType).includes(a.beneficiaryPartyId) ||
      op.customerId === a.beneficiaryPartyId ||
      op.supplierId === a.beneficiaryPartyId;
    const scoped =
      a.scope.customerIds.length > 0 || a.scope.supplierIds.length > 0;
    return linked || scoped ? a.beneficiaryPartyId : null;
  }
  return a.beneficiaryType
    ? (op.partiesByType[a.beneficiaryType] ?? null)
    : null;
}

const isItemLevel = (c: CommissionComponent) =>
  c.kind === "per_unit" || (c.kind === "percent" && c.base === "items");

const itemMatches = (
  a: AgreementDef,
  c: CommissionComponent,
  item: OperationItem,
) =>
  (!c.lineIds.length || (!!item.lineId && c.lineIds.includes(item.lineId))) &&
  (!a.scope.lineIds.length ||
    (!!item.lineId && a.scope.lineIds.includes(item.lineId)));

/** Faixas: progressivo (cada pedaço com a sua taxa) ou a taxa da faixa atingida na base inteira. */
export function tierValue(
  baseCents: number,
  tiers: CommissionTier[],
  mode: "progressive" | "whole",
): { valueCents: number; rate: number | null } {
  const sorted = [...tiers].sort(
    (x, y) => (x.upTo ?? Infinity) - (y.upTo ?? Infinity),
  );
  if (mode === "whole") {
    const hit =
      sorted.find((t) => t.upTo === null || baseCents <= cents(t.upTo)) ??
      sorted[sorted.length - 1];
    return { valueCents: pct(baseCents, hit.rate), rate: hit.rate };
  }
  let done = 0;
  let total = 0;
  for (const t of sorted) {
    const top =
      t.upTo === null ? baseCents : Math.min(baseCents, cents(t.upTo));
    if (top > done) {
      total += pct(top - done, t.rate);
      done = top;
    }
    if (done >= baseCents) break;
  }
  return { valueCents: total, rate: null };
}

interface Candidate {
  a: AgreementDef;
  c: CommissionComponent;
}

/** Precedência: individual ganha do padrão do tipo; depois a prioridade; depois a regra com linha ganha da geral. */
const rank = (x: Candidate): [number, number, number] => [
  x.a.beneficiaryPartyId ? 1 : 0,
  x.a.priority,
  x.c.lineIds.length ? 1 : 0,
];
const compareRank = (x: Candidate, y: Candidate) => {
  const [a, b] = [rank(x), rank(y)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
};
const reasonOf = (winner: Candidate, loser: Candidate) => {
  const [w, l] = [rank(winner), rank(loser)];
  return w[0] !== l[0] ? "individual" : w[1] !== l[1] ? "priority" : "specific";
};

/**
 * Calcula as comissões de um pedido pelos acordos dados (as versões ativas).
 * Não grava nada.
 */
export function computeCommissions(
  agreements: AgreementDef[],
  op: Operation,
): CommissionResult {
  const result: CommissionResult = {
    entries: [],
    replaced: [],
    conflicts: [],
    waiting: [],
  };
  if (op.cancelled) return result;
  const events = new Set<string>(op.events);
  // Por beneficiário: os acordos que valem para ele neste pedido.
  const byBeneficiary = new Map<string, AgreementDef[]>();
  for (const a of agreements) {
    if (!agreementValidAt(a, op.refDate)) continue;
    const who = beneficiaryOf(a, op);
    if (!who) continue;
    if (!events.has(a.generateOn)) {
      result.waiting.push({ agreementName: a.name, event: a.generateOn });
      continue;
    }
    byBeneficiary.set(who, [...(byBeneficiary.get(who) ?? []), a]);
  }

  for (const [who, list] of byBeneficiary) {
    const lines = new Map<string, MemoryLine[]>();
    const pending = new Map<string, Set<string>>();
    const push = (a: AgreementDef, line: MemoryLine) =>
      lines.set(a.id, [...(lines.get(a.id) ?? []), line]);
    const wait = (a: AgreementDef, what: string) =>
      pending.set(a.id, new Set([...(pending.get(a.id) ?? []), what]));
    const line = (
      x: Candidate,
      item: OperationItem | null,
      base: number | null,
      rate: number | null,
      valueCents: number,
      note: string | null = null,
    ): MemoryLine => ({
      agreementId: x.a.id,
      agreementName: x.a.name,
      version: x.a.version,
      componentId: x.c.id,
      componentName: x.c.name,
      kind: x.c.kind,
      itemId: item?.id ?? null,
      itemName: item?.name ?? null,
      base,
      rate,
      value: money(valueCents),
      note,
    });
    const usable = (x: Candidate) =>
      !x.c.successEvent || events.has(x.c.successEvent);
    const currencyOk = (x: Candidate) => {
      if (x.a.currency === op.currency) return true;
      wait(x.a, `currency:${x.a.currency}`);
      return false;
    };
    /** Entre regras exclusivas, a de maior precedência; empate entre acordos é conflito. */
    const pick = (
      cands: Candidate[],
      where: string,
      item: OperationItem | null,
    ) => {
      const sorted = [...cands].sort(compareRank);
      const [winner, ...rest] = sorted;
      if (!winner) return null;
      for (const loser of rest) {
        if (
          compareRank(winner, loser) === 0 &&
          loser.a.rootId !== winner.a.rootId
        )
          result.conflicts.push({ a: winner.a.name, b: loser.a.name, where });
        else if (
          loser.a.rootId !== winner.a.rootId ||
          loser.c.id !== winner.c.id
        )
          result.replaced.push({
            agreementName: loser.a.name,
            componentName: loser.c.name,
            itemName: item?.name ?? null,
            byAgreementName: winner.a.name,
            reason: reasonOf(winner, loser),
          });
      }
      return winner;
    };

    const categories = new Set(list.map((a) => a.category));
    for (const category of categories) {
      const cands: Candidate[] = list
        .filter((a) => a.category === category)
        .flatMap((a) => a.components.map((c) => ({ a, c })))
        .filter(usable);

      // Regras por item: cada item tem a sua (taxas diferentes por linha).
      const itemValue = (x: Candidate, item: OperationItem) => {
        if (x.c.kind === "per_unit") {
          if (!currencyOk(x)) return null;
          const v = Math.round(item.quantity * cents(x.c.amount ?? 0));
          return line(x, item, item.quantity, null, v);
        }
        if (item.amount === null) {
          wait(x.a, "item_price");
          return null;
        }
        return line(
          x,
          item,
          item.amount,
          x.c.rate,
          pct(cents(item.amount), x.c.rate ?? 0),
        );
      };
      for (const item of op.items) {
        const matching = cands.filter(
          (x) => isItemLevel(x.c) && itemMatches(x.a, x.c, item),
        );
        const exclusive = pick(
          matching.filter((x) => !x.c.accumulate),
          item.name,
          item,
        );
        for (const x of [
          ...(exclusive ? [exclusive] : []),
          ...matching.filter((x) => x.c.accumulate),
        ]) {
          const l = itemValue(x, item);
          if (l) push(x.a, l);
        }
      }

      // Regras do pedido inteiro: fixo, bônus, percentual sobre venda, custo ou recebido.
      const orderValue = (x: Candidate) => {
        if (x.c.kind === "fixed") {
          if (!currencyOk(x)) return null;
          return line(x, null, null, null, cents(x.c.amount ?? 0));
        }
        const base =
          x.c.base === "order_sell"
            ? op.sellTotal
            : x.c.base === "order_fob"
              ? op.fobTotal
              : op.received;
        if (base === null) {
          wait(x.a, `base:${x.c.base}`);
          return null;
        }
        if (x.c.tiers?.length) {
          const t = tierValue(cents(base), x.c.tiers, x.c.tierMode);
          return line(
            x,
            null,
            base,
            t.rate,
            t.valueCents,
            `tier:${x.c.tierMode}`,
          );
        }
        return line(x, null, base, x.c.rate, pct(cents(base), x.c.rate ?? 0));
      };
      const orderLevel = cands.filter((x) => !isItemLevel(x.c));
      const exclusives = orderLevel.filter((x) => !x.c.accumulate);
      // A disputa é entre acordos: valem as regras exclusivas do acordo que ganha.
      const winner = pick(exclusives, "order", null);
      for (const x of [
        ...exclusives.filter((y) => winner && y.a.id === winner.a.id),
        ...orderLevel.filter((y) => y.c.accumulate),
      ]) {
        const l = orderValue(x);
        if (l) push(x.a, l);
      }
    }

    for (const a of list) {
      const own = lines.get(a.id) ?? [];
      const waits = [...(pending.get(a.id) ?? [])];
      if (!own.length && !waits.length) continue;
      // Piso e teto por componente (sobre a soma das linhas dele).
      const adjusted: MemoryLine[] = [...own];
      for (const c of a.components) {
        const sum = own
          .filter((l) => l.componentId === c.id)
          .reduce((s, l) => s + cents(l.value), 0);
        if (!own.some((l) => l.componentId === c.id)) continue;
        const target = Math.min(
          c.cap === null ? Infinity : cents(c.cap),
          Math.max(c.floor === null ? -Infinity : cents(c.floor), sum),
        );
        if (target !== sum)
          adjusted.push({
            agreementId: a.id,
            agreementName: a.name,
            version: a.version,
            componentId: c.id,
            componentName: c.name,
            kind: c.kind,
            itemId: null,
            itemName: null,
            base: null,
            rate: null,
            value: money(target - sum),
            note: target > sum ? "floor" : "cap",
          });
      }
      const total = adjusted.reduce((s, l) => s + cents(l.value), 0);
      // Liberação: o fato combinado, ou o recebido do cliente.
      let fraction = 0;
      if (a.releaseOn === "received") {
        const ratio =
          op.received !== null && op.sellTotal
            ? Math.min(1, op.received / op.sellTotal)
            : 0;
        fraction =
          a.releaseMode === "proportional" ? ratio : ratio >= 1 ? 1 : 0;
        if (op.received === null || !op.sellTotal) waits.push("base:received");
      } else if (events.has(a.releaseOn)) fraction = 1;
      result.entries.push({
        beneficiaryPartyId: who,
        agreementId: a.id,
        rootId: a.rootId,
        version: a.version,
        agreementName: a.name,
        category: a.category,
        currency: op.currency,
        amount: money(total),
        released: money(Math.round(total * fraction)),
        releaseFraction: fraction,
        dueDays: a.dueDays,
        lines: adjusted,
        pending: [...new Set(waits)],
      });
    }
  }
  return result;
}

/**
 * Conflitos de publicação: outro acordo ativo, da mesma categoria, mesmo
 * beneficiário e mesma prioridade, com vigência que se cruza e regra
 * exclusiva sobre a mesma coisa (mesma linha, ou o pedido). Bloqueia a ativação.
 */
export function publicationConflicts(
  candidate: AgreementDef,
  active: AgreementDef[],
): AgreementDef[] {
  const overlaps = (a: AgreementDef, b: AgreementDef) =>
    (a.validFrom ?? "") <= (b.validTo ?? "9999") &&
    (b.validFrom ?? "") <= (a.validTo ?? "9999");
  const shares = (xs: string[], ys: string[]) =>
    !xs.length || !ys.length || xs.some((x) => ys.includes(x));
  const clash = (a: AgreementDef, b: AgreementDef) =>
    a.components.some((ca) =>
      b.components.some(
        (cb) =>
          !ca.accumulate &&
          !cb.accumulate &&
          isItemLevel(ca) === isItemLevel(cb) &&
          (!isItemLevel(ca) ||
            ca.lineIds.length > 0 === cb.lineIds.length > 0) &&
          shares(ca.lineIds, cb.lineIds),
      ),
    );
  return active.filter(
    (other) =>
      other.rootId !== candidate.rootId &&
      other.category === candidate.category &&
      other.priority === candidate.priority &&
      other.beneficiaryPartyId === candidate.beneficiaryPartyId &&
      other.beneficiaryType === candidate.beneficiaryType &&
      overlaps(candidate, other) &&
      shares(candidate.scope.customerIds, other.scope.customerIds) &&
      shares(candidate.scope.supplierIds, other.scope.supplierIds) &&
      clash(candidate, other),
  );
}

/** Situações de um lançamento. */
export const ENTRY_STATUSES = [
  "estimated",
  "eligible",
  "approved",
  "partially_paid",
  "paid",
  "reversed",
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** Situação pelo que já foi pago, depois de aprovado. */
export function paidStatus(amount: number, paid: number): EntryStatus {
  if (cents(paid) <= 0) return "approved";
  return cents(paid) >= cents(amount) ? "paid" : "partially_paid";
}
