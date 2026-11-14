import { describe, expect, it } from "vitest";
import { kindGate, requirementGate, tasksForFunctions } from "@/lib/task-owner";

/*
 * Pendências por função do operador (dono, 13/11/2026): o comprador não vê o
 * que é do designer, da diretoria, do fornecedor ou da certificação; o
 * administrador vê tudo.
 */

const task = (over: Record<string, unknown>) => ({
  kind: "requirement",
  title: "Pedido #1",
  detail: "",
  ...over,
});

const buyer = {
  id: "u-buyer",
  role: "operator" as const,
  functions: ["buyer"],
  screens: null,
};
const designer = { ...buyer, id: "u-designer", functions: ["designer"] };
const admin = {
  ...buyer,
  id: "u-admin",
  role: "admin" as const,
  functions: null,
};

describe("de quem é cada pendência", () => {
  it("itens da etapa: arte do designer, assinatura da diretoria, certificado do despachante", () => {
    expect(requirementGate("art", "PACKAGING")).toEqual({
      action: "art.design",
    });
    expect(requirementGate("art_final__x", "PREPARATION")).toEqual({
      action: "art.design",
    });
    expect(requirementGate("order_signed_wellmix", "PACKAGING")).toEqual({
      action: "contract.sign",
    });
    expect(requirementGate("certificate__x", "PREPARATION")).toEqual({
      admin: true,
    });
    expect(requirementGate("bl", "SHIPPING")).toEqual({ screen: "freight" });
    expect(requirementGate("erp_number", "ORDER_CREATED")).toEqual({
      action: "purchaseOrder.generate",
    });
  });

  it("certificação: só o administrador; o selo na arte, quem faz a arte", () => {
    expect(kindGate("cert_step", "cert_seal")).toEqual({ admin: true });
    expect(kindGate("cert_validate", "cert_memorial")).toEqual({ admin: true });
    expect(kindGate("cert_step", "cert_seal_art")).toEqual({
      action: "art.design",
    });
  });
});

describe("filtro do operador", () => {
  const items = [
    { key: "art", role: "operator" as const, label: "Arte" },
    { key: "art_approval", role: "supplier" as const, label: "Aprovar arte" },
    {
      key: "order_signed_wellmix",
      role: "operator" as const,
      label: "Assinar",
    },
    { key: "order_sign_send", role: "operator" as const, label: "Enviar" },
  ];
  const tasks = [
    task({
      stageKey: "PACKAGING",
      items,
      detail: "Arte, Aprovar arte, Assinar, Enviar",
    }),
    task({ kind: "cert_step", stepKey: "cert_seal" }),
    task({ kind: "new_request" }),
    task({ kind: "message_reply", ownerUserId: "u-designer" }),
  ];

  it("comprador: só os itens dele, com o detalhe refeito", () => {
    const shown = tasksForFunctions(buyer, tasks);
    expect(shown.map((t) => t.kind)).toEqual(["requirement", "new_request"]);
    expect(shown[0].detail).toBe("Enviar");
  });

  it("designer: a arte e a mensagem dele", () => {
    const shown = tasksForFunctions(designer, tasks);
    expect(shown.map((t) => t.kind)).toEqual(["requirement", "message_reply"]);
    expect(shown[0].detail).toBe("Arte");
  });

  it("administrador: tudo, como antes", () => {
    expect(tasksForFunctions(admin, tasks)).toHaveLength(tasks.length);
  });
});
