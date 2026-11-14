"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
}

const RequestCustomerContext = createContext<RequestCustomerState | null>(null);

/**
 * Também é o contêiner da tela (a grade da Nova solicitação, `className`):
 * o formulário e o histórico ficam dentro dele sem mais um nível na página.
 */
export function RequestCustomerProvider({
  initial,
  initialStock,
  className,
  children,
}: {
  initial: SearchOption | null;
  initialStock: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [customer, setCustomer] = useState(initial);
  const [stock, setStock] = useState(initialStock);
  const value = useMemo(
    () => ({ customer, stock, setCustomer, setStock }),
    [customer, stock],
  );
  return (
    <RequestCustomerContext.Provider value={value}>
      <div className={className}>{children}</div>
    </RequestCustomerContext.Provider>
  );
}

/** Nulo fora do provedor (o campo de cliente funciona sozinho também). */
export const useRequestCustomer = () => useContext(RequestCustomerContext);
