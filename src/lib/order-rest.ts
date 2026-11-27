/*
 * "Ver o restante do pedido" (dono, 27/11/2026): a tela do pedido mostra até
 * "Marcos do pedido"; o que vem abaixo (documentos, produção, recebimento,
 * financeiro, multas, embarque...) fica recolhido para levar cada um à tela
 * da sua área. Quem abre o restante de um pedido o mantém aberto nas voltas
 * das ações desse pedido; outro pedido abre recolhido.
 *
 * Fica fora do componente de tela: o servidor lê o cookie por este nome
 * (constante de módulo "use client" não chega ao servidor como texto).
 */
export const ORDER_REST_COOKIE = "orderRest";
