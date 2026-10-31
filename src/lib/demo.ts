import { dataMode } from "@/lib/env";

/**
 * Contas de demonstração ligadas? Sempre no modo memória (desenvolvimento e
 * testes); em produção só com NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=1. Vale para o
 * seletor "Demo" no topo, a lista na tela de login e o botão em Configurações.
 */
export function demoAccountsEnabled(): boolean {
  return (
    dataMode() === "memory" ||
    process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1"
  );
}
