import Link from "next/link";
import type { Translate } from "@/i18n";
import { SCREEN_GROUPS, type Screen } from "@/lib/auth/screens";
import { isGrantable } from "@/lib/partner-access";
import {
  ACCESS_BASE,
  editHref,
  type AccessUrlState,
} from "@/lib/partner-access-view";
import type { AccessProfileInfo } from "@/lib/services/partner-access";
import { Alert, Field, Select, cx } from "@/components/ui";
import { AutoApply } from "@/components/auto-apply";
import {
  YesNo,
  kindLabel,
  originText,
  profileLabel,
  routesOf,
  screenName,
  sourceText,
} from "./shared";

/*
 * Visão "Por tela" (dono, 14/11/2026): quais tipos e perfis abrem a tela, se
 * ela aparece no menu, a origem da configuração e quantos logins ativos cada
 * um tem. "Editar" abre a visão por tipo ou perfil já no perfil e na tela.
 */
export function ScreenView({
  t,
  profiles,
  screen,
  url,
}: {
  t: Translate;
  profiles: AccessProfileInfo[];
  screen: Screen;
  url: AccessUrlState;
}) {
  const grantable = isGrantable(screen);
  const th =
    "border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const td =
    "border-b border-zinc-100 px-2.5 py-2 align-middle text-[13px] text-zinc-800";
  return (
    <div data-access-view="screen">
      <form
        method="get"
        action={ACCESS_BASE}
        className="grid gap-3 sm:max-w-md"
      >
        <input type="hidden" name="view" value="screen" />
        {url.profile ? (
          <input type="hidden" name="profile" value={url.profile} />
        ) : null}
        <Field label={t("partnerAccess.screen.pick")}>
          <Select name="screen" defaultValue={screen} data-access-screen-select>
            {SCREEN_GROUPS.map((g) => (
              <optgroup key={g.key} label={t(g.key)}>
                {g.screens.map((s) => (
                  <option key={s} value={s}>
                    {screenName(t, s)}
                    {isGrantable(s)
                      ? ""
                      : ` (${t("partnerAccess.state.internal")})`}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <AutoApply />
      </form>

      <div className="mt-4" data-access-by-screen={screen}>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">
          {screenName(t, screen)}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {t("partnerAccess.col.origin")}: {originText(t, screen)}
        </p>
        <p className="mt-0.5 break-all font-mono text-xs text-zinc-500">
          {routesOf(screen).join(" · ")}
        </p>
      </div>
      {grantable ? null : (
        <div className="mt-3">
          <Alert tone="warning">{t("partnerAccess.internalHint")}</Alert>
        </div>
      )}

      <div className="-mx-3.5 mt-3 overflow-x-auto border-y border-zinc-200 sm:mx-0 sm:rounded-xl sm:border">
        <table className="w-full text-left text-sm" data-access-holders>
          <thead>
            <tr>
              <th className={th}>{t("partnerAccess.profile")}</th>
              <th className={cx(th, "text-center")}>
                {t("partnerAccess.col.open")}
              </th>
              <th className={cx(th, "text-center")}>
                {t("partnerAccess.col.menu")}
              </th>
              <th className={cx(th, "hidden sm:table-cell")}>
                {t("partnerAccess.col.sourceShort")}
              </th>
              <th className={cx(th, "text-right")}>
                {t("partnerAccess.col.logins")}
              </th>
              <th className={th}>
                <span className="sr-only">{t("partnerAccess.edit")}</span>
              </th>
            </tr>
          </thead>
          {(["type", "role"] as const).map((kind) => (
            <tbody key={kind}>
              <tr>
                <td
                  colSpan={6}
                  className="border-b border-zinc-200 bg-zinc-100/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                >
                  {t(`partnerAccess.kind.groups.${kind}`)}
                </td>
              </tr>
              {profiles
                .filter((p) => p.kind === kind)
                .map((p) => {
                  const open = p.access.screens.includes(screen);
                  const menu = open
                    ? !p.access.menuHidden.includes(screen)
                    : null;
                  return (
                    <tr
                      key={p.key}
                      className="transition hover:bg-brand-50/40"
                      data-access-holder={p.key}
                      data-access-open={open ? "1" : "0"}
                      data-access-menu-shown={menu ? "1" : "0"}
                    >
                      <td className={td}>
                        <span className="block font-medium text-zinc-900">
                          {profileLabel(p, t)}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {kindLabel(p, t)}
                        </span>
                      </td>
                      <td className={cx(td, "text-center")}>
                        <YesNo t={t} value={open} />
                      </td>
                      <td className={cx(td, "text-center")}>
                        <YesNo t={t} value={menu} />
                      </td>
                      <td className={cx(td, "hidden sm:table-cell")}>
                        {sourceText(t, profiles, p, screen)}
                      </td>
                      <td className={cx(td, "text-right tabular-nums")}>
                        {p.users}
                      </td>
                      <td className={cx(td, "text-right")}>
                        {grantable ? (
                          <Link
                            href={editHref(p.key, screen)}
                            className="whitespace-nowrap text-sm font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600"
                            data-access-edit={p.key}
                          >
                            {t("partnerAccess.edit")}
                          </Link>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {t("partnerAccess.screen.wellmix")}
      </p>
    </div>
  );
}
