import { isAdmin } from "./permissions";
import { accessOf } from "./access-cache";
import { menuScreensFor, screensFor } from "./screens";
import type { User } from "@/lib/db/schema";

/*
 * Carimbo do acesso do login (dono, 14/11/2026; docs/ACCESS.md): um resumo
 * curto das telas que ele abre, das que aparecem no menu e das ações que ele
 * pode fazer. O layout guarda o carimbo de quando foi desenhado; o navegador
 * confere em /api/access/stamp a cada navegação e quando a aba volta ao
 * foco. Mudou (uma função foi salva, o administrador mexeu no login), o menu
 * e os atalhos do cabeçalho são refeitos na hora: o layout não é desenhado
 * de novo numa navegação comum.
 */
export function accessStamp(
  user: Pick<User, "role"> &
    Partial<Pick<User, "functions" | "screens" | "screenExceptions">>,
): string {
  const screens = [...screensFor(user)].sort().join(",");
  const menu = [...menuScreensFor(user)].sort().join(",");
  const actions = isAdmin(user)
    ? "*"
    : [...(accessOf(user)?.actions ?? [])].sort().join(",");
  return fnv1a(`${user.role}|${screens}|${menu}|${actions}`);
}

/** Hash curto (FNV-1a de 32 bits, em base 36): só para comparar igual ou diferente. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
