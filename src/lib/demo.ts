import { dataMode } from "@/lib/env";

/**
 * Contas de demonstração ligadas? Sempre no modo memória (desenvolvimento e
 * testes); em produção só com NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=1. Vale para o
 * seletor "Demo" no topo, a lista na tela de login e o botão em Configurações.
 */
export function demoAccountsEnabled(): boolean {
  if (dataMode() === "memory") return true;
  // Banco de verdade em produção: desligado (decisão do dono, 11/11/2026). O
  // seletor faz um login real com a senha de demonstração, que ia na página
  // para qualquer usuário logado; não é simulação.
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1";
}
