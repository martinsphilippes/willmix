/*
 * Acesso já resolvido do login desta requisição (telas e ações das funções,
 * com a configuração do administrador em Equipe → Funções e acessos).
 * `getCurrentUser` calcula uma vez e guarda aqui; `screensFor` e `can` leem
 * sem ir ao banco de novo. Sem nada guardado (testes, outros logins), vale o
 * padrão do código. Módulo sem dependências, para não criar ciclo de import.
 */

export interface ResolvedAccess {
  /** Telas que as funções do login liberam (sem o básico). */
  screens: string[];
  /** Ações que as funções do login liberam. */
  actions: string[];
  /**
   * Login externo (cliente, fornecedor, parceiros): as telas do perfil dele
   * na Gestão de telas (docs/PARTNER_ACCESS.md). Ausente = o padrão do papel.
   */
  external?: string[];
  /** Telas que o login abre mas não aparecem no menu. */
  menuHidden?: string[];
}

const byUser = new WeakMap<object, ResolvedAccess>();

export function attachAccess(user: object, access: ResolvedAccess) {
  byUser.set(user, access);
}

export function accessOf(user: object): ResolvedAccess | null {
  return byUser.get(user) ?? null;
}
