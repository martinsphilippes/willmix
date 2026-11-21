/*
 * Resultado de uma Server Action que fica na tela (docs/SUPPLIER_REQUESTS.md,
 * "Tela da negociação reorganizada"): com erro, a ação devolve o código em
 * vez de recarregar a página, e o que foi digitado continua nos campos;
 * dando certo, ela leva à tela de sempre (com o aviso de sucesso). Módulo sem
 * "use server" nem "use client": o tipo vale para os dois lados.
 */
export interface FormActionState {
  /** Código do erro (o mesmo do ?error= das outras telas); nulo: nada a mostrar. */
  error: string | null;
  /** Campos recusados pela validação, quando se sabe. */
  fields: string[];
  /** Momento do erro: cada recusa mostra o aviso de novo. */
  at: number;
}

export const FORM_ACTION_INITIAL: FormActionState = {
  error: null,
  fields: [],
  at: 0,
};
