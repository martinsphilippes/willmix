import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nav = vi.hoisted(() => ({ path: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

const { AppSidebar } = await import("@/components/app-nav");

/*
 * Item pai do menu (Produção, dono, 14/11/2026): sem subitens é um link do
 * primeiro nível, com o ícone, como os outros itens principais; com
 * subitens, o nome continua abrindo a tela e a seta ao lado abre e fecha.
 * Na tela do pai (ou de um subitem) o grupo já vem aberto. Abrir e fechar
 * com a seta é do navegador; aqui, o que a página entrega.
 */
type Props = ComponentProps<typeof AppSidebar>;
type Entry = Props["entries"][number];

const labels = {
  main: "Menu principal",
  collapse: "Recolher menu",
  expand: "Expandir menu",
};
const parent = (items: Entry["items"]): Entry => ({
  id: "nav.production",
  label: "Produção",
  href: "/app/production",
  icon: "factory",
  items,
  toggle: {
    show: "Mostrar os itens de Produção",
    hide: "Ocultar os itens de Produção",
  },
});
const STEP = { href: "/app/production/inspection", label: "Inspeção" };

const render = (entries: Entry[], path: string) => {
  nav.path = path;
  return renderToStaticMarkup(
    createElement(AppSidebar, { entries, footer: [], labels } as Props),
  );
};
/** A tag de abertura do link do menu para um endereço. */
const linkTag = (html: string, href: string) =>
  html.match(new RegExp(`<a[^>]*data-nav-link="${href}"[^>]*>`))?.[0] ?? "";

describe("item pai do menu (Produção)", () => {
  it("sem subitens: link do primeiro nível, com o ícone e sem seta", () => {
    const html = render(
      [{ label: "Produção", href: "/app/production", icon: "factory" }],
      "/app/production",
    );
    const tag = linkTag(html, "/app/production");
    expect(tag).toContain('href="/app/production"');
    expect(tag).toContain('aria-current="page"');
    expect(html).toMatch(
      /data-nav-link="\/app\/production"[^>]*><svg[^>]*>.*?<\/svg><span[^>]*>Produção<\/span>/,
    );
    expect(html).not.toContain("data-nav-group-toggle");
  });

  it("com subitens: o nome abre a tela e a seta (aberta na tela do pai) mostra as etapas", () => {
    const html = render([parent([STEP])], "/app/production");
    const tag = linkTag(html, "/app/production");
    expect(tag).toContain('aria-current="page"');
    expect(html).toContain('data-nav-parent="/app/production"');
    expect(html).toMatch(
      /<button[^>]*aria-expanded="true"[^>]*aria-label="Ocultar os itens de Produção"[^>]*data-nav-group-toggle="\/app\/production"/,
    );
    expect(linkTag(html, STEP.href)).toContain(`href="${STEP.href}"`);
  });

  it("fora da tela: grupo fechado, só o nome (link) e a seta", () => {
    const html = render([parent([STEP])], "/app/orders");
    const tag = linkTag(html, "/app/production");
    expect(tag).toContain('href="/app/production"');
    expect(tag).not.toContain("aria-current");
    expect(html).toMatch(
      /<button[^>]*aria-expanded="false"[^>]*aria-label="Mostrar os itens de Produção"/,
    );
    expect(linkTag(html, STEP.href)).toBe("");
  });

  it("num subitem: o grupo vem aberto e o subitem fica aceso, não o pai", () => {
    const html = render([parent([STEP])], STEP.href);
    expect(linkTag(html, STEP.href)).toContain('aria-current="page"');
    expect(linkTag(html, "/app/production")).not.toContain("aria-current");
    expect(html).toContain('aria-expanded="true"');
  });
});
