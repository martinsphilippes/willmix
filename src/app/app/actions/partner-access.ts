"use server";

import { z } from "zod";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Gestão de telas (docs/PARTNER_ACCESS.md), hoje a aba Acessos externos de
 * Cadastros → Parceiros: conceder pelo catálogo, copiar de um perfil para
 * outro e voltar ao padrão. Só o administrador; o serviço confere de novo e
 * grava a auditoria. A volta mantém a visão e os filtros de quem salvou.
 */

const PROFILE = z.string().regex(/^(role|type):[a-z0-9_]{1,80}$/);
const SCREEN = z.string().regex(/^[A-Za-z]{1,40}$/);
const BASE = "/app/parties/access";

const list = (form: FormData, key: string) =>
  z
    .array(SCREEN)
    .max(100)
    .parse(form.getAll(key).filter((v): v is string => typeof v === "string"));

/**
 * Endereço de volta com a visão e os filtros da página (busca, situação,
 * tela da visão por tela). Só os valores reconhecidos passam.
 */
function backTo(form: FormData, profile: string): string {
  let back = BASE;
  if (str(form, "view") === "screen") {
    back = withQuery(back, "view", "screen");
    const screen = str(form, "screen");
    if (SCREEN.safeParse(screen).success)
      back = withQuery(back, "screen", screen);
  }
  if (PROFILE.safeParse(profile).success)
    back = withQuery(back, "profile", profile);
  const q = str(form, "q").slice(0, 120);
  if (q) back = withQuery(back, "q", q);
  const state = str(form, "state");
  if (["open", "hidden", "blocked", "internal"].includes(state))
    back = withQuery(back, "state", state);
  return back;
}

export async function savePartnerAccessAction(form: FormData) {
  const user = await requireUser();
  const profile = str(form, "profile");
  const back = backTo(form, profile);
  await run(back, async () => {
    const key = PROFILE.parse(profile);
    const open = list(form, "open");
    // "No menu" marcado = aparece; o que abre e não está marcado fica escondido.
    const menu = new Set(list(form, "menu"));
    const { saveProfileScreens } =
      await import("@/lib/services/partner-access");
    const changes = await saveProfileScreens(user, key, {
      screens: open,
      menuHidden: open.filter((s) => !menu.has(s)),
    });
    return withQuery(back, "saved", String(changes.length));
  });
}

export async function resetPartnerAccessAction(form: FormData) {
  const user = await requireUser();
  const profile = str(form, "profile");
  const back = backTo(form, profile);
  await run(back, async () => {
    const { resetProfileScreens } =
      await import("@/lib/services/partner-access");
    await resetProfileScreens(user, PROFILE.parse(profile));
    return withQuery(back, "saved", "reset");
  });
}

/**
 * Painel "Copiar acesso": aplica só no destino e só nas telas escolhidas, e
 * só se a configuração ainda for a da prévia (`expect`). Com erro, o painel
 * volta aberto com o aviso; deu certo, fecha e a página mostra o destino.
 */
export async function copyPartnerAccessAction(form: FormData) {
  const user = await requireUser();
  const from = str(form, "from");
  const to = str(form, "to");
  const screens = form
    .getAll("screens")
    .filter((v): v is string => typeof v === "string");
  let panel = withQuery(backTo(form, str(form, "profile")), "panel", "copy");
  if (PROFILE.safeParse(from).success) panel = withQuery(panel, "from", from);
  if (PROFILE.safeParse(to).success) panel = withQuery(panel, "to", to);
  const url = new URL(panel, "http://x");
  for (const s of screens)
    if (SCREEN.safeParse(s).success) url.searchParams.append("screens", s);
  url.searchParams.set(
    "mode",
    str(form, "mode") === "replace" ? "replace" : "add",
  );
  url.searchParams.set("preview", "1");
  const back = url.pathname + url.search;
  await run(back, async () => {
    const source = PROFILE.parse(from);
    const target = PROFILE.parse(to);
    const mode = z.enum(["add", "replace"]).parse(str(form, "mode"));
    const expect = z.string().max(4000).parse(str(form, "expect"));
    const { copyProfileScreens } =
      await import("@/lib/services/partner-access");
    const changes = await copyProfileScreens(
      user,
      source,
      target,
      list(form, "screens"),
      mode,
      expect,
    );
    // Volta à página de antes, agora no destino, com o aviso da cópia.
    const done =
      str(form, "view") === "screen"
        ? backTo(form, str(form, "profile"))
        : backTo(form, target);
    return withQuery(
      withQuery(done, "saved", String(changes.length)),
      "copied",
      target,
    );
  });
}
