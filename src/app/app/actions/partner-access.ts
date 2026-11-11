"use server";

import { z } from "zod";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Gestão de telas (docs/PARTNER_ACCESS.md): conceder pelo catálogo, copiar
 * de um perfil para outro e voltar ao padrão. Só o administrador; o serviço
 * confere de novo e grava a auditoria.
 */

const PROFILE = z.string().regex(/^(role|type):[a-z0-9_]{1,80}$/);
const SCREEN = z.string().regex(/^[A-Za-z]{1,40}$/);
const BASE = "/app/parties/access";

const list = (form: FormData, key: string) =>
  z
    .array(SCREEN)
    .max(100)
    .parse(form.getAll(key).filter((v): v is string => typeof v === "string"));

export async function savePartnerAccessAction(form: FormData) {
  const user = await requireUser();
  const profile = str(form, "profile");
  const back = withQuery(BASE, "profile", profile);
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
  const back = withQuery(BASE, "profile", profile);
  await run(back, async () => {
    const { resetProfileScreens } =
      await import("@/lib/services/partner-access");
    await resetProfileScreens(user, PROFILE.parse(profile));
    return withQuery(back, "saved", "reset");
  });
}

export async function copyPartnerAccessAction(form: FormData) {
  const user = await requireUser();
  const back = withQuery(BASE, "view", "copy");
  await run(back, async () => {
    const from = PROFILE.parse(str(form, "from"));
    const to = PROFILE.parse(str(form, "to"));
    const mode = z.enum(["add", "replace"]).parse(str(form, "mode"));
    const { copyProfileScreens } =
      await import("@/lib/services/partner-access");
    const changes = await copyProfileScreens(
      user,
      from,
      to,
      list(form, "screens"),
      mode,
    );
    return withQuery(
      withQuery(BASE, "profile", to),
      "saved",
      String(changes.length),
    );
  });
}
