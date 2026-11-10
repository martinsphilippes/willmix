import { describe, expect, it } from "vitest";
import {
  isLoginName,
  LOGIN_DOMAIN,
  loginLabel,
  loginToEmail,
  suggestLoginName,
} from "@/lib/auth/login-id";

/*
 * Login por nome de usuário (sem e-mail), src/lib/auth/login-id.ts: o que a
 * pessoa digita vira o endereço da conta; e-mail continua valendo igual.
 */
describe("login por nome de usuário", () => {
  it("nome de usuário vira o endereço interno; e-mail fica como está", () => {
    expect(loginToEmail("  Fabrica.Nova ")).toBe(
      `fabrica.nova@${LOGIN_DOMAIN}`,
    );
    expect(loginToEmail("loja-e4_9558")).toBe(`loja-e4_9558@${LOGIN_DOMAIN}`);
    expect(loginToEmail("Li@Fabrica-Nova.CN")).toBe("li@fabrica-nova.cn");
  });

  it("recusa o que não é nem nome de usuário nem e-mail", () => {
    for (const bad of [
      "",
      "ab",
      "fábrica",
      "fabrica nova",
      ".fabrica",
      "a".repeat(41),
      "sem-dominio@",
      "@so-dominio.com",
      "dois@@arrobas.com",
      "espaco no@email.com",
      "工厂",
    ])
      expect(loginToEmail(bad), bad).toBeNull();
  });

  it("mostra o login como a pessoa digita", () => {
    const email = loginToEmail("fabrica.nova")!;
    expect(isLoginName(email)).toBe(true);
    expect(loginLabel(email)).toBe("fabrica.nova");
    expect(isLoginName("li@fabrica-nova.cn")).toBe(false);
    expect(loginLabel("li@fabrica-nova.cn")).toBe("li@fabrica-nova.cn");
    expect(loginLabel(null)).toBe("");
  });

  it("sugere o login pelo nome do fornecedor, sem repetir", () => {
    expect(suggestLoginName("Fábrica Nova Yiwu", null)).toBe(
      "fabrica.nova.yiwu",
    );
    // Nome só em chinês: usa o número da loja; sem loja, um nome genérico.
    expect(suggestLoginName("义乌工厂", "E4-9558")).toBe("loja.e4.9558");
    expect(suggestLoginName("义乌工厂", null)).toBe("fornecedor");
    // Já em uso (como nome de usuário): ganha número.
    const taken = [loginToEmail("fabrica.nova.yiwu")!, "outro@x.com"];
    expect(suggestLoginName("Fábrica Nova Yiwu", null, taken)).toBe(
      "fabrica.nova.yiwu2",
    );
    // Toda sugestão é um login válido.
    for (const name of ["A", "Shenzhen Supplier A Co., Ltd. (Export Division)"])
      expect(loginToEmail(suggestLoginName(name, null))).not.toBeNull();
  });
});
