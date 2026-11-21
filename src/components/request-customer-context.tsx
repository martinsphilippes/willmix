"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CompositionItem } from "@/lib/container-composition";
import type { EconomicGroup } from "@/lib/economic-group";
import type { SearchOption } from "./search-picker";

/**
 * Cliente escolhido na Nova solicitação, para quem está ao lado do
 * formulário (o histórico de compras do cliente): o campo de cliente grava
 * aqui a escolha e a "Compra para estoque"; o histórico lê.
 */
interface RequestCustomerState {
  customer: SearchOption | null;
  stock: boolean;
  setCustomer: (customer: SearchOption | null) => void;
  setStock: (stock: boolean) => void;
  /**
   * País de origem e grupo do pedido (docs/ORDER_TERMS.md): a busca de
   * produto só oferece os deles. `originRequired`: a venda ao cliente pela
   * Wellmix pede os dois antes do produto (fora da compra para estoque).
   */
  origin: RequestOrigin | null;
  setOrigin: (origin: RequestOrigin | null) => void;
  originRequired: boolean;
  /**
   * Composição de containers (docs/ORDER_TERMS.md seção 8): as datas das
   * programações do pedido e a carga de cada linha de produto (peças por
   * programação, caixa master, CBM e o container escolhido nela).
   */
  planDates: string[];
  setPlanDates: (dates: string[]) => void;
  loads: Record<string, RowLoad>;
  setLoad: (key: string, load: RowLoad | null) => void;
  /**
   * Histórico de compras → pedido (dono, 15/11/2026; docs/ORDER_TERMS.md
   * seção 10): os produtos que já estão nas linhas (o histórico marca) e o
   * pedido de acrescentar um produto (as linhas atendem).
   */
  chosenProductIds: string[];
  setChosenProductIds: (ids: string[]) => void;
  /**
   * O produto da linha aberta no pedido (só uma fica aberta; dono,
   * 19/11/2026): a aba Análise do histórico de compras mostra a dele.
   */
  focusProduct: FocusProduct | null;
  setFocusProduct: (product: FocusProduct | null) => void;
  addRequest: AddRequest | null;
  requestAddProduct: (productId: string) => void;
  /**
   * Seletor de produtos (lupa; docs/ORDER_TERMS.md 11.5): vários de uma
   * vez, com a quantidade padrão escolhida no seletor, sem rolar a tela.
   */
  requestAddProducts: (productIds: string[], quantity: number | null) => void;
  /**
   * Trocar o país ou a família com produtos no pedido (dono, 15/11/2026):
   * depois do "sim" no aviso, as linhas de produto são limpas (contador).
   */
  clearSeq: number;
  requestClearProducts: () => void;
  /**
   * Seletor de produtos aberto (a lupa de qualquer linha abre o mesmo, que
   * fica fora das linhas: acrescentar troca a linha vazia sem fechá-lo).
   */
  browserOpen: boolean;
  setBrowserOpen: (open: boolean) => void;
  /**
   * Formato de venda, nível e quem chama o transportador (condições do
   * pedido): a previsão de preço manda o VIP e a rota (dono, 16/11/2026).
   */
  saleTerms: SaleTerms | null;
  setSaleTerms: (terms: SaleTerms | null) => void;
  /**
   * Valor total de cada produto (preço previsto × quantidade, R$; dono,
   * 16/11/2026): as condições do pedido somam no "Valor total".
   */
  rowTotals: Record<string, number>;
  setRowTotal: (key: string, total: number | null) => void;
  /**
   * Grupo econômico do cliente escolhido (docs/ECONOMIC_GROUPS.md): as
   * empresas e a distribuição padrão; nulo = pedido de um cliente só.
   * `groupLoading`: o cliente representa um grupo e as empresas ainda vêm.
   */
  group: EconomicGroup | null;
  groupLoading: boolean;
  setGroupShares: (shares: Record<string, number>) => void;
  /**
   * Distribuição entre as entregas do pedido (dono, 19/11/2026;
   * docs/ECONOMIC_GROUPS.md): o percentual de cada entrega, para o número
   * de entregas de agora (`planDates`). Nulo = partes iguais. Vem do padrão
   * do cliente e pode ser mudada no pedido.
   */
  roundPercents: number[] | null;
  setRoundPercents: (percents: number[] | null) => void;
  /** Há padrão gravado do cliente para o número de entregas de agora. */
  roundDefault: number[] | null;
  setRoundDefault: (percents: number[] | null) => void;
}

/** O produto da linha aberta no pedido. */
export interface FocusProduct {
  productId: string;
  name: string;
  /** A linha no formulário (campos `p<n>.`): "Usar a recomendação" escreve nela. */
  rowIndex?: number;
}

export interface SaleTerms {
  saleFormat: "wd" | "wellmix" | null;
  wellmixTier: "pleno" | "mega" | "hiper" | "ultra" | "evo" | "super" | null;
  carrierCaller: "customer" | "wellmix" | null;
  /** Valor do transporte digitado no pedido (R$, total); nulo = o padrão. */
  deliveryFreightBrl?: number | null;
}

export interface AddRequest {
  productIds: string[];
  /**
   * Quantidade padrão em caixas master (dono, 16/11/2026: era em peças);
   * nula = a de sempre (o pedido mínimo). Com ela, as linhas entram
   * recolhidas em "Produtos no pedido".
   */
  quantity: number | null;
  /** Rola até a linha nova (o clique no histórico). */
  scroll: boolean;
  seq: number;
}

export interface RowLoad extends CompositionItem {
  containerCode: string | null;
  capacityCbm: number | null;
}

export interface RequestOrigin {
  country: string;
  /** Família de produto (chave "sk:…" ou "ln:…"; docs/ORDER_TERMS.md). */
  family: string;
}

const RequestCustomerContext = createContext<RequestCustomerState | null>(null);

/**
 * Também é o contêiner da tela (a grade da Nova solicitação, `className`):
 * o formulário e o histórico ficam dentro dele sem mais um nível na página.
 */
export function RequestCustomerProvider({
  initial,
  initialStock,
  originTerms = false,
  className,
  children,
}: {
  initial: SearchOption | null;
  initialStock: boolean;
  /** A tela tem as condições do pedido (Wellmix, nova solicitação). */
  originTerms?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [customer, setCustomer] = useState(initial);
  const [stock, setStock] = useState(initialStock);
  const [origin, setOrigin] = useState<RequestOrigin | null>(null);
  const originRequired = originTerms && !stock;
  const [planDates, setPlanDatesState] = useState<string[]>([]);
  const [loads, setLoads] = useState<Record<string, RowLoad>>({});
  const [chosenProductIds, setChosenState] = useState<string[]>([]);
  const setChosenProductIds = useCallback((ids: string[]) => {
    setChosenState((prev) => (prev.join("|") === ids.join("|") ? prev : ids));
  }, []);
  const [focusProduct, setFocusState] = useState<FocusProduct | null>(null);
  const setFocusProduct = useCallback((next: FocusProduct | null) => {
    setFocusState((prev) =>
      prev?.productId === next?.productId &&
      prev?.name === next?.name &&
      prev?.rowIndex === next?.rowIndex
        ? prev
        : next,
    );
  }, []);
  const [addRequest, setAddRequest] = useState<AddRequest | null>(null);
  const [clearSeq, setClearSeq] = useState(0);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [saleTerms, setSaleTermsState] = useState<SaleTerms | null>(null);
  const [rowTotals, setRowTotals] = useState<Record<string, number>>({});
  // Grupo econômico do cliente (só nas telas com as condições do pedido).
  const [groupState, setGroupState] = useState<{
    for: string;
    value: EconomicGroup | null;
  } | null>(null);
  const customerId = !stock && originTerms ? (customer?.id ?? null) : null;
  useEffect(() => {
    if (!customerId) return;
    let off = false;
    fetch(`/api/customers/group?customer=${encodeURIComponent(customerId)}`)
      .then((r) => (r.ok ? r.json() : { group: null }))
      .then((b: { group?: EconomicGroup | null }) => {
        if (!off) setGroupState({ for: customerId, value: b.group ?? null });
      })
      .catch(() => {
        if (!off) setGroupState({ for: customerId, value: null });
      });
    return () => {
      off = true;
    };
  }, [customerId]);
  const group =
    customerId && groupState?.for === customerId ? groupState.value : null;
  const groupLoading =
    !!customerId &&
    groupState?.for !== customerId &&
    (customer?.groupSize ?? 1) > 0;
  // Distribuição entre entregas: a do pedido (mudada aqui) ou o padrão do
  // cliente para o número de entregas de agora.
  const rounds = planDates.length;
  const roundKey = customerId && rounds >= 2 ? `${customerId}:${rounds}` : "";
  const [roundState, setRoundState] = useState<{
    for: string;
    percents: number[] | null;
    defaults: number[] | null;
  } | null>(null);
  useEffect(() => {
    if (!roundKey) return;
    let off = false;
    const [cid, n] = roundKey.split(":");
    fetch(
      `/api/customers/round-shares?customer=${encodeURIComponent(cid)}&rounds=${n}`,
    )
      .then((r) => (r.ok ? r.json() : { percents: null }))
      .then((b: { percents?: number[] | null }) => {
        if (off) return;
        const p = b.percents ?? null;
        setRoundState((prev) =>
          prev?.for === roundKey
            ? prev
            : { for: roundKey, percents: p, defaults: p },
        );
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [roundKey]);
  const ownRound = roundKey && roundState?.for === roundKey ? roundState : null;
  const roundPercents =
    ownRound?.percents && ownRound.percents.length === rounds
      ? ownRound.percents
      : null;
  const roundDefault = ownRound?.defaults ?? null;
  const setRoundPercents = useCallback(
    (percents: number[] | null) =>
      setRoundState((prev) => ({
        for: roundKey,
        percents,
        defaults: prev?.for === roundKey ? prev.defaults : null,
      })),
    [roundKey],
  );
  const setRoundDefault = useCallback(
    (defaults: number[] | null) =>
      setRoundState((prev) => ({
        for: roundKey,
        percents: prev?.for === roundKey ? prev.percents : defaults,
        defaults,
      })),
    [roundKey],
  );
  const setGroupShares = useCallback((shares: Record<string, number>) => {
    setGroupState((prev) =>
      prev?.value ? { ...prev, value: { ...prev.value, shares } } : prev,
    );
  }, []);
  const setRowTotal = useCallback((key: string, total: number | null) => {
    setRowTotals((prev) => {
      if (total === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev[key] === total ? prev : { ...prev, [key]: total };
    });
  }, []);
  const setSaleTerms = useCallback((next: SaleTerms | null) => {
    setSaleTermsState((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    );
  }, []);
  const requestClearProducts = useCallback(() => setClearSeq((n) => n + 1), []);
  const requestAddProduct = useCallback((productId: string) => {
    setAddRequest((prev) => ({
      productIds: [productId],
      quantity: null,
      scroll: true,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);
  const requestAddProducts = useCallback(
    (productIds: string[], quantity: number | null) => {
      if (!productIds.length) return;
      setAddRequest((prev) => ({
        productIds,
        quantity,
        scroll: false,
        seq: (prev?.seq ?? 0) + 1,
      }));
    },
    [],
  );
  const setPlanDates = useCallback((dates: string[]) => {
    setPlanDatesState((prev) =>
      prev.join("|") === dates.join("|") ? prev : dates,
    );
  }, []);
  const setLoad = useCallback((key: string, load: RowLoad | null) => {
    setLoads((prev) => {
      if (!load) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (JSON.stringify(prev[key]) === JSON.stringify(load)) return prev;
      return { ...prev, [key]: load };
    });
  }, []);
  const value = useMemo(
    () => ({
      customer,
      stock,
      setCustomer,
      setStock,
      origin: originRequired ? origin : null,
      setOrigin,
      originRequired,
      planDates,
      setPlanDates,
      loads,
      setLoad,
      chosenProductIds,
      setChosenProductIds,
      focusProduct,
      setFocusProduct,
      addRequest,
      requestAddProduct,
      requestAddProducts,
      clearSeq,
      requestClearProducts,
      browserOpen,
      setBrowserOpen,
      saleTerms,
      setSaleTerms,
      rowTotals,
      setRowTotal,
      group,
      groupLoading,
      setGroupShares,
      roundPercents,
      setRoundPercents,
      roundDefault,
      setRoundDefault,
    }),
    [
      roundPercents,
      setRoundPercents,
      roundDefault,
      setRoundDefault,
      group,
      groupLoading,
      setGroupShares,
      rowTotals,
      setRowTotal,
      saleTerms,
      setSaleTerms,
      browserOpen,
      requestAddProducts,
      clearSeq,
      requestClearProducts,
      chosenProductIds,
      setChosenProductIds,
      focusProduct,
      setFocusProduct,
      addRequest,
      requestAddProduct,
      customer,
      stock,
      origin,
      originRequired,
      planDates,
      setPlanDates,
      loads,
      setLoad,
    ],
  );
  return (
    <RequestCustomerContext.Provider value={value}>
      <div className={className}>{children}</div>
    </RequestCustomerContext.Provider>
  );
}

/** Nulo fora do provedor (o campo de cliente funciona sozinho também). */
export const useRequestCustomer = () => useContext(RequestCustomerContext);
