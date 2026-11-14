import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  SCREEN_GROUPS,
  SCREEN_LABEL,
  SCREEN_ROUTES,
  type Screen,
} from "@/lib/auth/screens";
import {
  ALWAYS_OPEN,
  blockedFromDefault,
  isAdaptedInternal,
  isGrantable,
  originRoles,
  type AccessCell,
  type ProfileAccess,
} from "@/lib/partner-access";
import { partnerTypeName } from "@/lib/partner-types";
import type { AccessProfileInfo } from "@/lib/services/partner-access";
import { Badge, cx } from "@/components/ui";

/*
 * Peças comuns da aba Acessos externos (Cadastros → Parceiros): nomes das
 * telas e dos perfis, "Feita para", origem da configuração e as opções de
 * perfil separadas em tipos de parceiro e papéis de login.
 */

export const screenName = (t: Translate, screen: Screen) =>
  t(SCREEN_LABEL[screen]);

export const routesOf = (screen: Screen) =>
  SCREEN_ROUTES.filter(([, s]) => s === screen).map(([route]) => route);

export const moduleOf = (screen: Screen): DictionaryKey =>
  SCREEN_GROUPS.find((g) => g.screens.includes(screen))?.key ??
  ("nav.group.home" as DictionaryKey);

/** Nome do perfil: o do tipo de parceiro (como o administrador deu) ou o do papel. */
export const profileLabel = (p: AccessProfileInfo, t: Translate) =>
  p.type
    ? partnerTypeName(p.type, t.locale)
    : t(`role.${p.role}` as DictionaryKey);

/** "Tipo de parceiro" ou "Papel de login". */
export const kindLabel = (p: AccessProfileInfo, t: Translate) =>
  t(`partnerAccess.kind.${p.kind}`);

/** Para quem a tela foi feita (e se é da equipe Wellmix). */
export function originText(t: Translate, screen: Screen) {
  const roles = originRoles(screen).map((r) => t(`role.${r}` as DictionaryKey));
  // Tela da equipe adaptada a um login externo (Booking): as duas origens.
  return roles.length && !isAdaptedInternal(screen)
    ? roles.join(", ")
    : [t("partnerAccess.origin.wellmix"), ...roles].join(", ");
}

export type ScreenState = "always" | "open" | "hidden" | "blocked" | "internal";

/** Situação da tela no perfil, como a sessão do login externo vê. */
export function stateOf(access: ProfileAccess, screen: Screen): ScreenState {
  if (!isGrantable(screen)) return "internal";
  if (ALWAYS_OPEN.includes(screen)) return "always";
  if (!access.screens.includes(screen)) return "blocked";
  return access.menuHidden.includes(screen) ? "hidden" : "open";
}

const STATE_TONE: Record<
  ScreenState,
  "success" | "info" | "neutral" | "warning"
> = {
  always: "success",
  open: "success",
  hidden: "info",
  blocked: "neutral",
  internal: "warning",
};

export function StateBadge({ t, state }: { t: Translate; state: ScreenState }) {
  return (
    <Badge tone={STATE_TONE[state]} className="whitespace-nowrap">
      {t(`partnerAccess.state.${state}`)}
    </Badge>
  );
}

/**
 * De onde vem o que está valendo na tela: o padrão, liberada à mão, cópia de
 * outro perfil, ou bloqueada fora do padrão. Só mostra; não concede nada.
 */
export function sourceText(
  t: Translate,
  profiles: AccessProfileInfo[],
  profile: AccessProfileInfo,
  screen: Screen,
) {
  if (!isGrantable(screen)) return "—";
  const access = profile.access;
  if (!access.screens.includes(screen))
    return access.custom && blockedFromDefault(profile.key, screen)
      ? t("partnerAccess.source.removed")
      : t("partnerAccess.source.default");
  const source = access.sources[screen];
  if (source?.startsWith("copy:")) {
    const from = profiles.find((p) => p.key === source.slice(5));
    return t("partnerAccess.source.copy", {
      from: from ? profileLabel(from, t) : source.slice(5),
    });
  }
  // Mudança à mão: liberada, ou tirada do menu (o padrão de fábrica mostra
  // toda tela que abre, então fora do menu é sempre escolha do administrador).
  if (access.menuHidden.includes(screen))
    return t("partnerAccess.source.menuHidden");
  if (source === "manual") return t("partnerAccess.source.manual");
  return t("partnerAccess.source.default");
}

/** Opções de perfil, separadas: tipos de parceiro e papéis de login. */
export function ProfileOptions({
  profiles,
  t,
}: {
  profiles: AccessProfileInfo[];
  t: Translate;
}) {
  return (
    <>
      {(["type", "role"] as const).map((kind) => (
        <optgroup key={kind} label={t(`partnerAccess.kind.groups.${kind}`)}>
          {profiles
            .filter((p) => p.kind === kind)
            .map((p) => (
              <option key={p.key} value={p.key}>
                {profileLabel(p, t)}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

/** Sim / Não / — (não se aplica), com texto para leitor de tela. */
export function YesNo({
  t,
  value,
  highlight = false,
}: {
  t: Translate;
  value: boolean | null;
  highlight?: boolean;
}) {
  const text =
    value === null
      ? t("partnerAccess.notApplicable")
      : t(value ? "partnerAccess.yes" : "partnerAccess.no");
  return (
    <span
      className={cx(
        "inline-flex min-w-9 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
        value === null
          ? "text-zinc-400"
          : value
            ? "text-emerald-800"
            : "text-zinc-600",
        highlight && "bg-amber-100 ring-1 ring-inset ring-amber-300",
      )}
      title={text}
    >
      <span aria-hidden>{value === null ? "—" : value ? "✓" : "✕"}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Uma célula de acesso (Abre ou No menu) para comparação e prévia. */
export const cellOpen = (c: AccessCell) => c.open;
export const cellMenu = (c: AccessCell) => c.menu;
