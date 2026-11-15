"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CompositionItem } from "@/lib/container-composition";
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
}

export interface RowLoad extends CompositionItem {
  containerCode: string | null;
  capacityCbm: number | null;
}

export interface RequestOrigin {
  country: string;
  lineId: string;
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
    }),
    [
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
