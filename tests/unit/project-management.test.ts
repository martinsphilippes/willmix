import { describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import {
  canSeeProjectManagement,
  isPmTab,
  PM_TABS,
  projectManagementNav,
} from "@/lib/project-management";
import { PLATAFORMA_HTML } from "@/lib/project-management/plataforma-html";
import { PM_SHIM, withPortalBridge } from "@/lib/project-management/shim";

/*
 * Gestão do projeto (dono, 25/11/2026; docs/PROJECT_MANAGEMENT.md): a
 * Plataforma Wellmix v2 no portal, só para o login do dono da Wellmix.
 */
describe("Gestão do projeto", () => {
  it("todo administrador vê; os outros papéis não", () => {
    expect(
      canSeeProjectManagement({ email: "ana@wellmix.com", role: "admin" }),
    ).toBe(true);
    for (const role of ["operator", "customer", "supplier"] as const)
      expect(canSeeProjectManagement({ email: "x@wellmix.com", role })).toBe(
        false,
      );
    expect(
      projectManagementNav({ email: "ana@wellmix.com", role: "admin" }),
    ).toHaveLength(1);
  });

  it("e o login da lista, mesmo sem ser admin (sem diferenciar maiúsculas)", () => {
    expect(
      canSeeProjectManagement({
        email: "well_wellmix@wellmix.com",
        role: "operator",
      }),
    ).toBe(true);
    expect(canSeeProjectManagement({ email: "well@wellmix.com.br" })).toBe(
      true,
    );
    expect(canSeeProjectManagement({ email: " Well@Wellmix.com.br " })).toBe(
      true,
    );
    expect(canSeeProjectManagement({ email: "admin@wellmix.com.br" })).toBe(
      false,
    );
    expect(canSeeProjectManagement({ email: "" })).toBe(false);
    expect(canSeeProjectManagement(null)).toBe(false);
  });

  it("o menu ganha o grupo só para ele, com uma subaba por aba", () => {
    expect(projectManagementNav({ email: "outra@wellmix.com.br" })).toEqual([]);
    const [group] = projectManagementNav({ email: "well@wellmix.com.br" });
    expect(group && "items" in group && group.items.map((l) => l.href)).toEqual(
      PM_TABS.map((tab) => `/app/project-management/${tab}`),
    );
  });

  it("cada aba tem nome nos três idiomas e existe na plataforma", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      for (const tab of PM_TABS)
        expect(t(`pm.tab.${tab}`)).not.toBe(`pm.tab.${tab}`);
    }
    for (const tab of PM_TABS)
      expect(PLATAFORMA_HTML).toContain(`id="tab-${tab}"`);
    expect(isPmTab("projeto")).toBe(true);
    expect(isPmTab("frame")).toBe(false);
  });

  it("a ponte entra no <head> e os anexos passam pelo portal", () => {
    const html = withPortalBridge(
      PLATAFORMA_HTML,
      "/app/project-management/file",
    );
    expect(html.indexOf(PM_SHIM)).toBeGreaterThan(-1);
    expect(html.indexOf(PM_SHIM)).toBeLessThan(
      html.indexOf("<script" + ' id="wm-data"'),
    );
    expect(html).not.toContain("/_blob/");
    expect(html).toContain("/app/project-management/file?k=");
  });
});
