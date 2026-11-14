import type { Translate } from "@/i18n";
import { compareAccess } from "@/lib/partner-access";
import {
  ACCESS_BASE,
  baseParams,
  closePanelHref,
  type AccessUrlState,
} from "@/lib/partner-access-view";
import type { AccessProfileInfo } from "@/lib/services/partner-access";
import { Field, LinkButton, Select, cx } from "@/components/ui";
import { AutoApply } from "@/components/auto-apply";
import { SidePanel } from "@/components/side-panel";
import {
  ProfileOptions,
  YesNo,
  kindLabel,
  profileLabel,
  screenName,
} from "./shared";

/*
 * Painel "Comparar acessos" (dono, 14/11/2026): dois tipos ou perfis, "Abre"
 * e "No menu" comparados separadamente, só as diferenças (ou todas as
 * telas). Só consulta: nada é gravado daqui.
 */
export function ComparePanel({
  t,
  profiles,
  a,
  b,
  url,
}: {
  t: Translate;
  profiles: AccessProfileInfo[];
  a: AccessProfileInfo;
  b: AccessProfileInfo;
  url: AccessUrlState;
}) {
  const rows = compareAccess(a.access, b.access);
  const differs = rows.filter((r) => r.openDiff || r.menuDiff);
  const shown = url.all ? rows : differs;
  const nameA = profileLabel(a, t);
  const nameB = profileLabel(b, t);
  const th =
    "border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const td = "border-b border-zinc-100 px-2 py-2 align-middle text-[13px]";
  const hidden = baseParams(url);
  return (
    <SidePanel
      title={t("partnerAccess.compare.title")}
      subtitle={t("partnerAccess.compare.hint")}
      closeHref={closePanelHref(url)}
      closeLabel={t("partnerAccess.panel.close")}
      wide
      data-access-panel="compare"
      footer={
        <LinkButton href={closePanelHref(url)} replace scroll={false}>
          {t("partnerAccess.panel.close")}
        </LinkButton>
      }
    >
      <form method="get" action={ACCESS_BASE} className="space-y-3">
        <input type="hidden" name="panel" value="compare" />
        {[...hidden.entries()].map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("partnerAccess.compare.a")}>
            <Select name="a" defaultValue={a.key} data-access-compare-a>
              <ProfileOptions profiles={profiles} t={t} />
            </Select>
          </Field>
          <Field label={t("partnerAccess.compare.b")}>
            <Select name="b" defaultValue={b.key} data-access-compare-b>
              <ProfileOptions profiles={profiles} t={t} />
            </Select>
          </Field>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="all"
            value="1"
            defaultChecked={url.all}
            className="h-4 w-4 cursor-pointer accent-brand-600"
            data-access-compare-all
          />
          {t("partnerAccess.compare.showAll")}
        </label>
        <AutoApply />
      </form>

      <p
        className="mt-4 text-sm font-medium text-zinc-800"
        data-access-compare-diff={differs.length}
      >
        {differs.length
          ? t("partnerAccess.compare.summary", {
              n: differs.length,
              open: rows.filter((r) => r.openDiff).length,
              menu: rows.filter((r) => r.menuDiff).length,
            })
          : null}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        <strong>A</strong> = {nameA} ({kindLabel(a, t)}) · <strong>B</strong> ={" "}
        {nameB} ({kindLabel(b, t)})
      </p>

      {shown.length ? (
        <div className="-mx-4 mt-3 overflow-x-auto border-y border-zinc-200 sm:mx-0 sm:rounded-xl sm:border">
          <table className="w-full text-left text-sm" data-access-compare-table>
            <thead>
              <tr>
                <th rowSpan={2} className={th}>
                  {t("partnerAccess.col.screen")}
                </th>
                <th colSpan={2} className={cx(th, "border-l text-center")}>
                  {t("partnerAccess.col.open")}
                </th>
                <th colSpan={2} className={cx(th, "border-l text-center")}>
                  {t("partnerAccess.col.menu")}
                </th>
              </tr>
              <tr>
                {["A", "B", "A", "B"].map((x, i) => (
                  <th
                    key={i}
                    className={cx(
                      th,
                      "w-12 text-center",
                      i % 2 === 0 && "border-l",
                    )}
                    title={x === "A" ? nameA : nameB}
                  >
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.screen}
                  className={cx(
                    "transition hover:bg-brand-50/40",
                    (r.openDiff || r.menuDiff) && "bg-amber-50/60",
                  )}
                  data-access-compare={r.screen}
                  data-differs={r.openDiff || r.menuDiff ? "1" : undefined}
                  data-open-differs={r.openDiff ? "1" : undefined}
                  data-menu-differs={r.menuDiff ? "1" : undefined}
                >
                  <td className={cx(td, "font-medium text-zinc-900")}>
                    {screenName(t, r.screen)}
                  </td>
                  <td className={cx(td, "border-l text-center")}>
                    <YesNo t={t} value={r.a.open} highlight={r.openDiff} />
                  </td>
                  <td className={cx(td, "text-center")}>
                    <YesNo t={t} value={r.b.open} highlight={r.openDiff} />
                  </td>
                  <td className={cx(td, "border-l text-center")}>
                    <YesNo t={t} value={r.a.menu} highlight={r.menuDiff} />
                  </td>
                  <td className={cx(td, "text-center")}>
                    <YesNo t={t} value={r.b.menu} highlight={r.menuDiff} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
          data-access-compare-same
        >
          {t("partnerAccess.compare.same")}
        </p>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        {t("partnerAccess.compare.menuNote")}
      </p>
    </SidePanel>
  );
}
