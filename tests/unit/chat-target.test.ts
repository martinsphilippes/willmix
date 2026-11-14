import { describe, expect, it } from "vitest";
import {
  chatTargetFromHref,
  keyboardOverlap,
  sameChatTarget,
} from "@/lib/chat-target";

/* Caixa flutuante do chat (dono, 14/11/2026): a mesma conversa só vem para
   frente; o teclado do celular empurra a caixa para cima. */
describe("caixa flutuante do chat", () => {
  it("a mesma solicitação e a mesma empresa são a mesma conversa", () => {
    const open = { requestId: "r1", partyId: "c1" };
    expect(sameChatTarget(open, { requestId: "r1", partyId: "c1" })).toBe(true);
    // Vazio e nulo valem o mesmo; o modo da caixa e o começo da mensagem não contam.
    expect(
      sameChatTarget(
        { requestId: "r1", partyId: "c1", orderId: null },
        { requestId: "r1", partyId: "c1", floating: true, draft: "Oi" },
      ),
    ).toBe(true);
    expect(sameChatTarget(open, { requestId: "r2", partyId: "c1" })).toBe(
      false,
    );
    expect(sameChatTarget(open, { requestId: "r1", partyId: "c2" })).toBe(
      false,
    );
    expect(sameChatTarget(open, { orderId: "r1", partyId: "c1" })).toBe(false);
    expect(sameChatTarget(null, { requestId: "r1" })).toBe(false);
  });

  it("teclado aberto: quanto ele cobre embaixo; sem teclado, zero", () => {
    // Celular de 844 px com teclado de 336 px.
    expect(keyboardOverlap(844, { height: 508, offsetTop: 0 })).toBe(336);
    // A área visível rolou junto (iOS): conta o que sobra embaixo.
    expect(keyboardOverlap(844, { height: 508, offsetTop: 120 })).toBe(216);
    // Sem teclado, ou só a barra do navegador mudando: nada.
    expect(keyboardOverlap(844, { height: 844, offsetTop: 0 })).toBe(0);
    expect(keyboardOverlap(844, { height: 790, offsetTop: 0 })).toBe(0);
  });

  it("o link da linha continua levando ao pedido ou à solicitação", () => {
    expect(chatTargetFromHref("/app/requests/abc?x=1")).toEqual({
      requestId: "abc",
    });
    expect(chatTargetFromHref("/app/orders/o1")).toEqual({ orderId: "o1" });
    expect(chatTargetFromHref("/app/messages")).toBeNull();
  });
});
