import { describe, expect, it } from "vitest";
import {
  partRowFor,
  requirementVisibleTo,
  stageOfRole,
} from "@/lib/order-view";

/*
 * Quem vê o quê na tela do pedido (fase 5g: sem etapas; o "liberado" é o
 * marco do item em andamento ou concluído). A Wellmix vê tudo; cliente e
 * fornecedor, o que já começou; o parceiro, o que é dele (e o despachante lê
 * o Embarque depois que ele começa), nunca os itens dos outros. A tabela
 * antiga "Etapas do pedido" (`stageVisibleTo`, `stageRowFor`) saiu na 5e/5g.
 */
const group = (key: string, status: string, responsibleRole = "operator") =>
  ({ id: `o|${key}`, key, status, responsibleRole }) as never;
const reqs = (...roles: string[]) => roles.map((role) => ({ role })) as never;
const user = (role: string) => ({ role }) as never;
const item = (role: string, step: string, key = "x") =>
  ({ id: key, key, role, step }) as never;
const states = (entries: Record<string, string>) =>
  new Map(Object.entries(entries)) as never;

describe("itens visíveis por papel", () => {
  it("Wellmix vê tudo; cliente e fornecedor veem o que já começou", () => {
    const shipping = item("shipping_line", "production/shipment", "vessel");
    for (const role of ["admin", "operator"])
      expect(
        requirementVisibleTo(
          user(role),
          shipping,
          group("SHIPPING", "pending"),
          reqs("shipping_line"),
          states({ shipment: "waiting" }),
        ),
      ).toBe(true);
    for (const role of ["customer", "supplier"]) {
      expect(
        requirementVisibleTo(
          user(role),
          shipping,
          group("SHIPPING", "pending"),
          reqs("shipping_line"),
          states({ shipment: "waiting" }),
        ),
      ).toBe(false);
      expect(
        requirementVisibleTo(
          user(role),
          shipping,
          group("SHIPPING", "active"),
          reqs("shipping_line"),
          states({ shipment: "active" }),
        ),
      ).toBe(true);
    }
  });

  it("parceiro: o item dele mesmo antes de começar; o despachante lê o Embarque já começado", () => {
    const broker = user("broker");
    const customs = item("broker", "delivery/cargo-presence", "release");
    expect(
      requirementVisibleTo(
        broker,
        customs,
        group("CUSTOMS", "pending"),
        reqs("broker"),
        states({ customs: "waiting" }),
      ),
    ).toBe(true);
    const vessel = item("shipping_line", "production/shipment", "vessel");
    expect(
      requirementVisibleTo(
        broker,
        vessel,
        group("SHIPPING", "pending", "shipping_line"),
        reqs("shipping_line"),
        states({ shipment: "waiting" }),
      ),
    ).toBe(false);
    expect(
      requirementVisibleTo(
        broker,
        vessel,
        group("SHIPPING", "active", "shipping_line"),
        reqs("shipping_line"),
        states({ shipment: "active" }),
      ),
    ).toBe(true);
    // Itens de outro parceiro, de marco que ele não lê: nunca.
    const plate = item("carrier", "delivery/logistics", "plate");
    expect(
      requirementVisibleTo(
        broker,
        plate,
        group("TRANSPORT", "active", "carrier"),
        reqs("carrier"),
        states({ "invoice-transport": "active" }),
      ),
    ).toBe(false);
    // Cancelado: nada para quem é de fora.
    expect(
      requirementVisibleTo(
        broker,
        customs,
        group("CUSTOMS", "cancelled"),
        reqs("broker"),
        states({ customs: "active" }),
      ),
    ).toBe(false);
  });

  it("o grupo é do parceiro quando ele responde por ele ou tem item nele", () => {
    expect(
      stageOfRole(
        group("TRANSPORT", "pending", "carrier"),
        reqs(),
        "carrier" as never,
      ),
    ).toBe(true);
    expect(
      stageOfRole(
        group("CUSTOMS", "pending"),
        reqs("broker"),
        "broker" as never,
      ),
    ).toBe(true);
    expect(
      stageOfRole(
        group("CUSTOMS", "pending"),
        reqs("broker"),
        "carrier" as never,
      ),
    ).toBe(false);
  });
});

describe("partes do pedido por login", () => {
  it("Wellmix e cliente veem todas", () => {
    for (const role of ["admin", "operator", "customer"])
      expect(partRowFor(user(role), "supplier_payment")).toBe(true);
  });

  it("fornecedor e parceiros: só as partes em que atuam", () => {
    const supplier = user("supplier");
    expect(partRowFor(supplier, "document")).toBe(true);
    expect(partRowFor(supplier, "sheet")).toBe(true);
    expect(partRowFor(supplier, "production")).toBe(true);
    expect(partRowFor(supplier, "supplier_payment")).toBe(false);
    expect(partRowFor(supplier, "import")).toBe(false);
    expect(partRowFor(supplier, "receiving")).toBe(false);
    const broker = user("broker");
    expect(partRowFor(broker, "import")).toBe(true);
    expect(partRowFor(broker, "production")).toBe(false);
    expect(partRowFor(user("ocp"), "certification")).toBe(true);
    expect(partRowFor(user("agency"), "artwork")).toBe(true);
  });
});
