/*
 * Cards ou tabela na Estratégia de compra (dono, 23/11/2026). Fica fora do
 * componente de tela: o servidor lê o cookie por este nome (constante de
 * módulo "use client" não chega ao servidor como texto).
 */
export type StrategyView = "cards" | "table";
export const STRATEGY_VIEW_COOKIE = "strategyView";
