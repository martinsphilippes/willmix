import { describe, expect, it } from "vitest";
import { stageVisibleTo, stageOfRole } from "@/lib/order-view";

/*
 * Quem vê qual etapa na tela do pedido: a Wellmix tudo; cliente e fornecedor
 * o andamento; o parceiro só a etapa dele (e o despachante lê o Embarque),
 * nunca as etapas (e os valores) dos outros.
 */
const stage = (key: string, status: string, responsibleRole = "operator") =>
  ({ key, status, responsibleRole }) as never;
const reqs = (...roles: string[]) => roles.map((role) => ({ role })) as never;
const user = (role: string) => ({ role }) as never;

describe("etapas visíveis por papel", () => {
  it("Wellmix vê tudo (menos a etapa final); cliente e fornecedor veem o que já começou", () => {
    expect(
      stageVisibleTo(
        user("admin"),
        stage("CUSTOMS", "pending"),
        reqs("broker"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(user("operator"), stage("CLOSED", "done"), reqs()),
    ).toBe(false);
    expect(
      stageVisibleTo(
        user("customer"),
        stage("CUSTOMS", "done"),
        reqs("broker"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(
        user("customer"),
        stage("CUSTOMS", "pending"),
        reqs("broker"),
      ),
    ).toBe(false);
    expect(
      stageVisibleTo(
        user("supplier"),
        stage("TRANSPORT", "active"),
        reqs("carrier"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(
        user("supplier"),
        stage("TRANSPORT", "cancelled"),
        reqs("carrier"),
      ),
    ).toBe(false);
  });

  it("transportador: só o Transporte (mesmo antes de começar); nada do desembaraço nem do embarque", () => {
    const carrier = user("carrier");
    expect(
      stageVisibleTo(
        carrier,
        stage("TRANSPORT", "pending", "carrier"),
        reqs("carrier"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(
        carrier,
        stage("TRANSPORT", "active"),
        reqs("carrier", "carrier"),
      ),
    ).toBe(true);
    // Transportador designado depois: os itens já viraram dele, o responsável da etapa ainda não.
    expect(
      stageVisibleTo(
        carrier,
        stage("TRANSPORT", "active", "operator"),
        reqs("carrier"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(
        carrier,
        stage("CUSTOMS", "done", "broker"),
        reqs("broker"),
      ),
    ).toBe(false);
    expect(
      stageVisibleTo(carrier, stage("SHIPPING", "done"), reqs("shipping_line")),
    ).toBe(false);
    expect(
      stageVisibleTo(carrier, stage("INSPECTION", "done"), reqs("supplier")),
    ).toBe(false);
    // Sem transportador no pedido (itens do operador): não é dele.
    expect(
      stageVisibleTo(
        carrier,
        stage("TRANSPORT", "active", "operator"),
        reqs("operator"),
      ),
    ).toBe(false);
  });

  it("despachante: o Desembaraço e o Embarque já começado; companhia e agência: só a própria etapa", () => {
    const broker = user("broker");
    expect(
      stageVisibleTo(
        broker,
        stage("CUSTOMS", "active", "broker"),
        reqs("broker"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(broker, stage("SHIPPING", "done"), reqs("shipping_line")),
    ).toBe(true);
    expect(
      stageVisibleTo(
        broker,
        stage("SHIPPING", "pending"),
        reqs("shipping_line"),
      ),
    ).toBe(false);
    expect(
      stageVisibleTo(broker, stage("TRANSPORT", "done"), reqs("carrier")),
    ).toBe(false);
    expect(
      stageVisibleTo(
        user("shipping_line"),
        stage("CUSTOMS", "done"),
        reqs("broker"),
      ),
    ).toBe(false);
    expect(
      stageVisibleTo(
        user("shipping_line"),
        stage("SHIPPING", "done", "shipping_line"),
        reqs("shipping_line"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(
        user("agency"),
        stage("PACKAGING", "active"),
        reqs("agency", "supplier"),
      ),
    ).toBe(true);
    expect(
      stageVisibleTo(user("agency"), stage("CUSTOMS", "done"), reqs("broker")),
    ).toBe(false);
    expect(
      stageOfRole(
        stage("PACKAGING", "active", "agency"),
        reqs("supplier"),
        "agency",
      ),
    ).toBe(true);
  });
});
