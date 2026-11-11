import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  INTRO_ATTR,
  INTRO_BOOT,
  INTRO_MEDIA,
  INTRO_STORAGE_KEY,
} from "@/lib/intro";

/*
 * Abertura do portal: o script inline do <head> decide, antes do primeiro
 * quadro, se cobre a tela (html[data-wm-intro="pending"]). Aqui ele roda num
 * navegador de mentira com cada situação.
 */
function boot(env: {
  search?: string;
  width?: number;
  played?: boolean;
  webdriver?: boolean;
  storageBroken?: boolean;
}) {
  const attrs = new Map<string, string>();
  const sandbox = {
    URLSearchParams,
    location: { search: env.search ?? "" },
    navigator: { webdriver: env.webdriver ?? false },
    matchMedia: (query: string) => ({
      matches: query === INTRO_MEDIA && (env.width ?? 1440) >= 1024,
    }),
    sessionStorage: {
      getItem: (key: string) => {
        if (env.storageBroken) throw new Error("storage indisponível");
        return key === INTRO_STORAGE_KEY && env.played ? "1" : null;
      },
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => attrs.set(name, value),
      },
    },
  };
  runInNewContext(INTRO_BOOT, sandbox);
  return attrs.get(INTRO_ATTR) ?? null;
}

describe("abertura do portal: quando cobrir a tela", () => {
  it("desktop, primeira vez na aba: cobre", () => {
    expect(boot({ width: 1280 })).toBe("pending");
  });

  it("celular e tablet em pé (menos de 1024 px): não toca", () => {
    expect(boot({ width: 390 })).toBeNull();
    expect(boot({ width: 1023 })).toBeNull();
  });

  it("já tocou nesta aba: não repete", () => {
    expect(boot({ played: true })).toBeNull();
  });

  it("navegador automatizado (E2E, auditorias): não toca", () => {
    expect(boot({ webdriver: true })).toBeNull();
  });

  it("?intro=always força mesmo no celular, repetida ou automatizada", () => {
    expect(
      boot({
        search: "?intro=always",
        width: 390,
        played: true,
        webdriver: true,
      }),
    ).toBe("pending");
    expect(boot({ search: "?intro=manual", played: true })).toBe("pending");
  });

  it("?intro=off nunca toca", () => {
    expect(boot({ search: "?intro=off" })).toBeNull();
  });

  it("sem storage (navegador restrito): a página aparece normalmente", () => {
    expect(boot({ storageBroken: true })).toBeNull();
  });
});
