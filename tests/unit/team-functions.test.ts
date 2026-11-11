import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Funções e acessos gravados na tabela settings (Equipe → Funções e acessos). */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const tf = await import("@/lib/services/team-functions");
const { can } = await import("@/lib/auth/function-access");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.role === "operator")!;
});

describe("funções gravadas", () => {
  it("cria, configura, renomeia, desativa e volta ao padrão", async () => {
    const created = await tf.createFunction(admin, "Logística");
    expect(created.key).toBe("fn_logistica");
    await expect(tf.createFunction(admin, "logística")).rejects.toThrow(
      "duplicate",
    );
    await tf.setFunctionScreens(admin, created.key, ["freight", "containers"]);
    await tf.setFunctionActions(admin, created.key, ["receiving.follow"]);
    let defs = await tf.loadFunctionDefs();
    let def = defs.find((d) => d.key === created.key)!;
    expect(def.screens).toEqual(["freight", "containers"]);
    expect(
      can({ role: "operator", functions: [def.key] }, "receiving.follow", defs),
    ).toBe(true);

    await tf.renameFunction(admin, "buyer", "Compras");
    await tf.setFunctionActions(admin, "buyer", []);
    defs = await tf.loadFunctionDefs();
    expect(defs.find((d) => d.key === "buyer")!.name).toBe("Compras");
    expect(
      can({ role: "operator", functions: ["buyer"] }, "receiving.follow", defs),
    ).toBe(false);

    await tf.resetFunction(admin, "buyer");
    defs = await tf.loadFunctionDefs();
    def = defs.find((d) => d.key === "buyer")!;
    expect(def.name).toBeNull();
    expect(def.actions).toContain("receiving.follow");
    // A criada continua lá depois de voltar a de fábrica ao padrão.
    expect(defs.some((d) => d.key === created.key)).toBe(true);

    await tf.setFunctionArchived(admin, created.key, true);
    defs = await tf.loadFunctionDefs();
    expect(defs.find((d) => d.key === created.key)!.archived).toBe(true);
    await expect(tf.setFunctionArchived(admin, "buyer", true)).rejects.toThrow(
      "builtin",
    );
  });

  it("só o administrador mexe nas funções", async () => {
    await expect(tf.createFunction(operator, "Outra")).rejects.toThrow();
    await expect(
      tf.setFunctionScreens(operator, "buyer", []),
    ).rejects.toThrow();
  });
});
