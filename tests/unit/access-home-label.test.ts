import { describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import { screenName } from "@/app/app/parties/access/_components/shared";
import type { ProfileAccess } from "@/lib/partner-access";
import type { Screen } from "@/lib/auth/screens";

/*
 * Acessos externos (dono, 15/11/2026): a tela de entrada (/app) tem o nome
 * da Wellmix (Control Tower), mas o login externo nunca vê o Control Tower.
 * No perfil externo a linha diz o que o login vê ali, como o menu dele: as
 * Pendências (se o perfil abre Pendências), só "Início" (se não abre) e, no
 * cliente, a vitrine ou as solicitações. As outras telas não mudam.
 */
const t = translator("pt");
const access = (screens: Screen[]): ProfileAccess =>
  ({ screens, menuHidden: [] }) as unknown as ProfileAccess;

describe("nome da tela de entrada no gerenciador de acessos externos", () => {
  it("parceiro com Pendências: Início (Pendências do login)", () => {
    for (const key of ["type:trading", "type:factory", "role:supplier"])
      expect(
        screenName(t, "home", { key, access: access(["home", "tasks"]) }),
      ).toBe("Início (Pendências do login)");
  });

  it("parceiro sem Pendências: Início", () => {
    expect(
      screenName(t, "home", { key: "type:trading", access: access(["home"]) }),
    ).toBe("Início");
  });

  it("cliente: Início (vitrine ou solicitações)", () => {
    expect(
      screenName(t, "home", {
        key: "role:customer",
        access: access(["home", "tasks"]),
      }),
    ).toBe("Início (vitrine ou solicitações)");
  });

  it("sem perfil (a tela em todos os perfis): página de entrada", () => {
    expect(screenName(t, "home")).toBe("Início (página de entrada do login)");
  });

  it("nunca diz Control Tower; as outras telas seguem com o nome de sempre", () => {
    for (const key of ["type:trading", "role:customer", "role:agency"])
      expect(
        screenName(t, "home", { key, access: access(["home", "tasks"]) }),
      ).not.toMatch(/control tower/i);
    expect(screenName(t, "tasks")).toBe("Pendências");
    expect(screenName(t, "orders")).toBe(t("nav.orders"));
    expect(t("partnerAccess.home.hint")).toContain("Control Tower");
  });

  it("en e zh também", () => {
    const en = translator("en");
    const zh = translator("zh");
    const trading = { key: "type:trading", access: access(["home", "tasks"]) };
    expect(screenName(en, "home", trading)).toBe("Home (the login's tasks)");
    expect(screenName(zh, "home", trading)).toBe("首页（该账号的待办）");
  });
});
