import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/db/schema";
import { isLocale, translator } from "./index";

export const LOCALE_COOKIE = "wm_locale";

/** Idioma: cookie (troca manual) > preferência do usuário > pt. */
export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const user = await getCurrentUser();
  if (user && isLocale(user.locale)) return user.locale;
  return "pt";
});

export async function getT() {
  return translator(await getLocale());
}
