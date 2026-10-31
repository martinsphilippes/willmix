import { redirect } from "next/navigation";
import type { User } from "@/lib/db/schema";
import { canOpen, type Screen } from "./screens";

/**
 * Guarda das páginas: quem não abre a tela volta ao início com o aviso
 * "você não tem acesso a X" (não é erro técnico). As Server Actions usam
 * assertScreen (recusa). Fica fora de screens.ts para o menu e os testes não
 * dependerem do next/navigation.
 */
export function requireScreen(
  user: Pick<User, "role"> & Partial<Pick<User, "functions">>,
  screen: Screen,
): void {
  if (!canOpen(user, screen)) redirect(`/app?denied=${screen}`);
}
