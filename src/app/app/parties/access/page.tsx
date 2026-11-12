import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import {
  SCREENS,
  SCREEN_GROUPS,
  SCREEN_LABEL,
  SCREEN_ROUTES,
  isScreen,
  type Screen,
} from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import {
  ALWAYS_OPEN,
  GRANTABLE_SCREENS,
  isAdaptedInternal,
  isGrantable,
  isLimitedFor,
  originRoles,
  type ProfileAccess,
  type ScreenChange,
} from "@/lib/partner-access";
import { partnerTypeName } from "@/lib/partner-types";
import {
  listAccessProfiles,
  previewCopy,
  type AccessProfileInfo,
} from "@/lib/services/partner-access";
import {
  copyPartnerAccessAction,
  resetPartnerAccessAction,
  savePartnerAccessAction,
} from "../../actions/partner-access";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  cx,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * Gestão de telas (docs/PARTNER_ACCESS.md): por tipo ou perfil, por tela,
 * copiar o acesso de um perfil para outro e comparar dois perfis. Só o
 * administrador. O catálogo são as telas reais do portal (as do menu e as
 * de detalhe, pelo endereço).
 */

const BASE = "/app/parties/access";
const VIEWS = ["profile", "screen", "copy", "compare"] as const;
type View = (typeof VIEWS)[number];

const moduleOf = (screen: Screen) =>
  SCREEN_GROUPS.find((g) => g.screens.includes(screen))?.key ??
  ("nav.group.home" as DictionaryKey);
const routesOf = (screen: Screen) =>
  SCREEN_ROUTES.filter(([, s]) => s === screen).map(([route]) => route);

const profileLabel = (p: AccessProfileInfo, t: Translate) =>
  p.type
    ? partnerTypeName(p.type, t.locale)
    : t(`role.${p.role}` as DictionaryKey);

const tabClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

const checkClass =
  "h-4 w-4 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed";

export default async function PartnerAccessPage({
  searchParams,
}: PageProps<"/app/parties/access">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const t = await getT();
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const many = (key: string) => {
    const v = query[key];
    return (Array.isArray(v) ? v : v ? [v] : []).filter(
      (x): x is string => typeof x === "string",
    );
  };
  if (!isAdmin(user))
    return (
      <>
        <PageHeader t={t} title={t("partnerAccess.title")} />
        <Alert tone="info">{t("partnerAccess.adminOnly")}</Alert>
      </>
    );

  const profiles = await listAccessProfiles();
  const view: View = (VIEWS as readonly string[]).includes(one("view"))
    ? (one("view") as View)
    : "profile";
  const byKey = (key: string) => profiles.find((p) => p.key === key) ?? null;
  const optionGroups = (["type", "role"] as const).map((kind) => ({
    kind,
    items: profiles.filter((p) => p.kind === kind),
  }));
  const profileOptions = optionGroups.map((g) => (
    <optgroup key={g.kind} label={t(`partnerAccess.kind.${g.kind}`)}>
      {g.items.map((p) => (
        <option key={p.key} value={p.key}>
          {profileLabel(p, t)}
        </option>
      ))}
    </optgroup>
  ));
  const screenName = (screen: Screen) => t(SCREEN_LABEL[screen]);
  const originText = (screen: Screen) => {
    const roles = originRoles(screen).map((r) =>
      t(`role.${r}` as DictionaryKey),
    );
    // Tela da equipe adaptada a um login externo (Booking): as duas origens.
    return roles.length && !isAdaptedInternal(screen)
      ? roles.join(", ")
      : [t("partnerAccess.origin.wellmix"), ...roles].join(", ");
  };
  const sourceText = (access: ProfileAccess, screen: Screen) => {
    const source = access.sources[screen];
    if (!source) return "—";
    if (source.startsWith("copy:")) {
      const from = byKey(source.slice(5));
      return t("partnerAccess.source.copy", {
        from: from ? profileLabel(from, t) : source.slice(5),
      });
    }
    return t(
      source === "manual"
        ? "partnerAccess.source.manual"
        : "partnerAccess.source.default",
    );
  };
  const changeRows = (changes: ScreenChange[]) => (
    <ul className="space-y-1 text-sm" data-access-changes={changes.length}>
      {changes.map((c) => (
        <li key={`${c.screen}:${c.change}`} className="flex gap-2">
          <Badge
            tone={
              c.change === "added"
                ? "success"
                : c.change === "removed"
                  ? "danger"
                  : "info"
            }
          >
            {t(`partnerAccess.change.${c.change}`)}
          </Badge>
          <span>{screenName(c.screen)}</span>
        </li>
      ))}
    </ul>
  );

  const error = one("error");
  const errorKey = `partnerAccess.error.${error}`;
  const saved = one("saved");

  /* ------------------------------ Por perfil ------------------------------ */
  const current = byKey(one("profile")) ?? profiles[0];
  const q = one("q").trim().toLowerCase();
  const stateFilter = one("state");
  const stateOf = (access: ProfileAccess, screen: Screen) =>
    !isGrantable(screen)
      ? "internal"
      : access.screens.includes(screen)
        ? "open"
        : "blocked";
  const shown = (screen: Screen) =>
    (!q ||
      screenName(screen).toLowerCase().includes(q) ||
      routesOf(screen).some((r) => r.includes(q))) &&
    (!stateFilter || stateOf(current.access, screen) === stateFilter);

  /* -------------------------------- Copiar -------------------------------- */
  const from = byKey(one("from"));
  const to = byKey(one("to"));
  const picked = many("screens").filter(isScreen).filter(isGrantable);
  const mode = one("mode") === "replace" ? "replace" : "add";
  let preview: ScreenChange[] | null = null;
  let previewError = "";
  if (view === "copy" && one("preview") && from && to) {
    try {
      preview = await previewCopy(from.key, to.key, picked, mode);
    } catch (e) {
      previewError = e instanceof Error ? e.message : "unexpected";
    }
  }
  const previewErrorKey = `partnerAccess.error.${previewError}`;

  /* ------------------------------- Comparar ------------------------------- */
  const a = byKey(one("a")) ?? profiles[0];
  const b = byKey(one("b")) ?? profiles[1] ?? profiles[0];
  const cell = (access: ProfileAccess, screen: Screen) =>
    !access.screens.includes(screen)
      ? t("partnerAccess.no")
      : access.menuHidden.includes(screen)
        ? t("partnerAccess.hiddenMenu")
        : t("partnerAccess.yes");
  const differs = (screen: Screen) =>
    cell(a.access, screen) !== cell(b.access, screen);

  /* ------------------------------- Por tela ------------------------------- */
  const screen: Screen = isScreen(one("screen"))
    ? (one("screen") as Screen)
    : "orders";

  return (
    <>
      <PageHeader
        t={t}
        title={t("partnerAccess.title")}
        subtitle={t("partnerAccess.subtitle")}
        actions={
          <LinkButton href="/app/parties">{t("partnerAccess.back")}</LinkButton>
        }
      />
      <div className="mb-3 space-y-2">
        {error ? (
          <Alert tone="danger">
            {errorKey in dictionaries.pt
              ? t(errorKey as DictionaryKey)
              : t("common.error")}
          </Alert>
        ) : null}
        {saved ? (
          <div data-access-saved={saved}>
            <Alert tone="success">
              {saved === "reset"
                ? t("partnerAccess.saved.reset")
                : saved === "0"
                  ? t("partnerAccess.saved.none")
                  : t("partnerAccess.saved", { n: saved })}
            </Alert>
          </div>
        ) : null}
      </div>
      <nav className="mb-4 flex flex-wrap gap-2" data-access-tabs>
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={`${BASE}?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={tabClass(view === v)}
            data-access-tab={v}
          >
            {t(`partnerAccess.tab.${v}`)}
          </Link>
        ))}
      </nav>

      {view === "profile" ? (
        <Card>
          <form
            method="get"
            action={BASE}
            className="mb-3 flex flex-wrap items-end gap-3"
            data-access-profile-form
          >
            <div className="min-w-0 basis-64">
              <Field label={t("partnerAccess.profile")}>
                <Select name="profile" defaultValue={current.key}>
                  {profileOptions}
                </Select>
              </Field>
            </div>
            <div className="min-w-0 basis-48">
              <Field label={t("partnerAccess.filter.search")}>
                <Input name="q" defaultValue={one("q")} />
              </Field>
            </div>
            <div className="min-w-0 basis-44">
              <Field label={t("partnerAccess.filter.state")}>
                <Select name="state" defaultValue={stateFilter}>
                  <option value="">{t("partnerAccess.filter.all")}</option>
                  {(["open", "blocked", "internal"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`partnerAccess.state.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              {t("partnerAccess.filter.apply")}
            </Button>
          </form>
          <p
            className="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-700"
            data-access-profile={current.key}
          >
            <span className="font-semibold text-zinc-900">
              {profileLabel(current, t)}
            </span>
            <Badge>{t(`partnerAccess.kind.${current.kind}`)}</Badge>
            <Badge tone={current.access.custom ? "brand" : "neutral"}>
              {t(
                current.access.custom
                  ? "partnerAccess.custom"
                  : current.kind === "type"
                    ? "partnerAccess.factory.type"
                    : "partnerAccess.factory",
              )}
            </Badge>
            <span data-access-users={current.users}>
              {t("partnerAccess.users", { n: current.users })}
            </span>
          </p>
          <form action={savePartnerAccessAction} data-access-form>
            <input type="hidden" name="profile" value={current.key} />
            {/* O que o filtro esconde continua como está. */}
            {GRANTABLE_SCREENS.filter((s) => !shown(s)).flatMap((s) =>
              current.access.screens.includes(s)
                ? [
                    <input key={`o${s}`} type="hidden" name="open" value={s} />,
                    ...(current.access.menuHidden.includes(s)
                      ? []
                      : [
                          <input
                            key={`m${s}`}
                            type="hidden"
                            name="menu"
                            value={s}
                          />,
                        ]),
                  ]
                : [],
            )}
            <Table>
              <thead>
                <tr>
                  <Th>{t("partnerAccess.col.screen")}</Th>
                  <Th>{t("partnerAccess.col.module")}</Th>
                  <Th>{t("partnerAccess.col.origin")}</Th>
                  <Th>{t("partnerAccess.col.state")}</Th>
                  <Th>{t("partnerAccess.col.open")}</Th>
                  <Th>{t("partnerAccess.col.menu")}</Th>
                  <Th>{t("partnerAccess.col.source")}</Th>
                </tr>
              </thead>
              <tbody>
                {SCREENS.filter(shown).map((s) => {
                  const state = stateOf(current.access, s);
                  const always = ALWAYS_OPEN.includes(s);
                  return (
                    <tr
                      key={s}
                      className={rowClass}
                      data-access-screen={s}
                      data-access-state={state}
                    >
                      <Td>
                        <span className="block font-medium text-zinc-900">
                          {screenName(s)}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {routesOf(s).join(" · ")}
                        </span>
                      </Td>
                      <Td>{t(moduleOf(s))}</Td>
                      <Td>
                        <span className="block max-w-56 whitespace-normal text-zinc-600">
                          {originText(s)}
                        </span>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            state === "open"
                              ? "success"
                              : state === "internal"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {t(
                            always
                              ? "partnerAccess.state.always"
                              : `partnerAccess.state.${state}`,
                          )}
                        </Badge>
                        {isLimitedFor(s, current.key) ? (
                          <span
                            className="mt-1 block max-w-56 whitespace-normal text-xs text-amber-800"
                            data-access-limited={s}
                          >
                            {t("partnerAccess.limited", {
                              origin: originText(s),
                            })}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {state === "internal" ? (
                          "—"
                        ) : always ? (
                          <>
                            <input type="hidden" name="open" value={s} />
                            <input
                              type="checkbox"
                              checked
                              disabled
                              readOnly
                              aria-label={t("partnerAccess.col.open")}
                              className={checkClass}
                            />
                          </>
                        ) : (
                          <input
                            type="checkbox"
                            name="open"
                            value={s}
                            defaultChecked={state === "open"}
                            aria-label={`${t("partnerAccess.col.open")}: ${screenName(s)}`}
                            className={checkClass}
                            data-access-open={s}
                          />
                        )}
                      </Td>
                      <Td>
                        {state === "internal" ? (
                          "—"
                        ) : (
                          <input
                            type="checkbox"
                            name="menu"
                            value={s}
                            defaultChecked={
                              !current.access.menuHidden.includes(s)
                            }
                            aria-label={`${t("partnerAccess.col.menu")}: ${screenName(s)}`}
                            className={checkClass}
                            data-access-menu={s}
                          />
                        )}
                      </Td>
                      <Td>{sourceText(current.access, s)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SubmitButton
                confirmText={t("partnerAccess.save.confirm", {
                  profile: profileLabel(current, t),
                  n: current.users,
                })}
                data-access-save
              >
                {t("partnerAccess.save")}
              </SubmitButton>
              <LinkButton
                href={`${BASE}?view=copy&to=${encodeURIComponent(current.key)}`}
              >
                {t("partnerAccess.tab.copy")}
              </LinkButton>
            </div>
          </form>
          {current.access.custom ? (
            <form action={resetPartnerAccessAction} className="mt-2">
              <input type="hidden" name="profile" value={current.key} />
              <SubmitButton
                variant="secondary"
                confirmText={t("partnerAccess.reset.confirm", {
                  profile: profileLabel(current, t),
                  n: current.users,
                })}
                data-access-reset
              >
                {t("partnerAccess.reset")}
              </SubmitButton>
            </form>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">
            {t("partnerAccess.dataHint")} {t("partnerAccess.otherHint")}{" "}
            {t("partnerAccess.internalHint")}
          </p>
        </Card>
      ) : null}

      {view === "screen" ? (
        <Card>
          <form
            method="get"
            action={BASE}
            className="mb-3 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="view" value="screen" />
            <div className="min-w-0 basis-72">
              <Field label={t("partnerAccess.screen.pick")}>
                <Select name="screen" defaultValue={screen}>
                  {SCREEN_GROUPS.map((g) => (
                    <optgroup key={g.key} label={t(g.key)}>
                      {g.screens.map((s) => (
                        <option key={s} value={s}>
                          {screenName(s)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              {t("partnerAccess.filter.apply")}
            </Button>
          </form>
          <p
            className="mb-3 text-sm text-zinc-700"
            data-access-by-screen={screen}
          >
            <span className="font-semibold text-zinc-900">
              {screenName(screen)}
            </span>{" "}
            · {routesOf(screen).join(" · ")} · {t("partnerAccess.col.origin")}:{" "}
            {originText(screen)}
          </p>
          {isGrantable(screen) ? null : (
            <div className="mb-3">
              <Alert tone="warning">{t("partnerAccess.internalHint")}</Alert>
            </div>
          )}
          <Table>
            <thead>
              <tr>
                <Th>{t("partnerAccess.profile")}</Th>
                <Th>{t("partnerAccess.col.open")}</Th>
                <Th>{t("partnerAccess.col.menu")}</Th>
                <Th>{t("partnerAccess.col.source")}</Th>
                <Th>{t("partnerAccess.users", { n: "" }).trim()}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const open = p.access.screens.includes(screen);
                return (
                  <tr
                    key={p.key}
                    className={rowClass}
                    data-access-holder={p.key}
                    data-access-open={open ? "1" : "0"}
                  >
                    <Td>
                      <span className="font-medium text-zinc-900">
                        {profileLabel(p, t)}
                      </span>{" "}
                      <span className="text-xs text-zinc-500">
                        {t(`partnerAccess.kind.${p.kind}`)}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={open ? "success" : "neutral"}>
                        {t(open ? "partnerAccess.yes" : "partnerAccess.no")}
                      </Badge>
                    </Td>
                    <Td>
                      {open
                        ? t(
                            p.access.menuHidden.includes(screen)
                              ? "partnerAccess.no"
                              : "partnerAccess.yes",
                          )
                        : "—"}
                    </Td>
                    <Td>{sourceText(p.access, screen)}</Td>
                    <Td className="tabular-nums">{p.users}</Td>
                    <Td>
                      <Link
                        href={`${BASE}?profile=${encodeURIComponent(p.key)}`}
                        className="text-sm font-medium text-brand-700 underline"
                      >
                        {t("partnerAccess.configure")}
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-zinc-500">
            {t("partnerAccess.screen.wellmix")}
          </p>
        </Card>
      ) : null}

      {view === "copy" ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card title={t("partnerAccess.tab.copy")}>
            <form
              method="get"
              action={BASE}
              className="space-y-3"
              data-access-copy-form
            >
              <input type="hidden" name="view" value="copy" />
              <input type="hidden" name="preview" value="1" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("partnerAccess.copy.from")}>
                  <Select
                    name="from"
                    defaultValue={from?.key ?? "role:supplier"}
                  >
                    {profileOptions}
                  </Select>
                </Field>
                <Field label={t("partnerAccess.copy.to")}>
                  <Select name="to" defaultValue={to?.key ?? profiles[0].key}>
                    {profileOptions}
                  </Select>
                </Field>
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-zinc-800">
                  {t("partnerAccess.copy.screens")}
                </legend>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {GRANTABLE_SCREENS.filter(
                    (s) => !ALWAYS_OPEN.includes(s),
                  ).map((s) => (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800"
                    >
                      <input
                        type="checkbox"
                        name="screens"
                        value={s}
                        defaultChecked={picked.includes(s)}
                        className={checkClass}
                        data-access-copy-screen={s}
                      />
                      {screenName(s)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label={t("partnerAccess.copy.mode")}>
                <Select name="mode" defaultValue={mode}>
                  <option value="add">
                    {t("partnerAccess.copy.mode.add")}
                  </option>
                  <option value="replace">
                    {t("partnerAccess.copy.mode.replace")}
                  </option>
                </Select>
              </Field>
              <Button
                type="submit"
                variant="secondary"
                data-access-copy-preview
              >
                {t("partnerAccess.copy.preview")}
              </Button>
              <p className="text-xs text-zinc-500">
                {t("partnerAccess.copy.hint")}
              </p>
            </form>
          </Card>
          {one("preview") ? (
            <Card
              title={
                from && to
                  ? t("partnerAccess.copy.previewTitle", {
                      from: profileLabel(from, t),
                      to: profileLabel(to, t),
                    })
                  : t("partnerAccess.copy.preview")
              }
            >
              {previewError || !from || !to ? (
                <Alert tone="danger">
                  {previewErrorKey in dictionaries.pt
                    ? t(previewErrorKey as DictionaryKey)
                    : t("partnerAccess.error.partner_access_profile")}
                </Alert>
              ) : preview && preview.length ? (
                <div className="space-y-3" data-access-copy-result>
                  {changeRows(preview)}
                  <p className="text-sm text-zinc-700">
                    {t("partnerAccess.copy.impact", { n: to.users })}
                  </p>
                  <form action={copyPartnerAccessAction}>
                    <input type="hidden" name="from" value={from.key} />
                    <input type="hidden" name="to" value={to.key} />
                    <input type="hidden" name="mode" value={mode} />
                    {picked.map((s) => (
                      <input key={s} type="hidden" name="screens" value={s} />
                    ))}
                    <SubmitButton data-access-copy-apply>
                      {t("partnerAccess.copy.apply")}
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <Alert tone="info">{t("partnerAccess.copy.none")}</Alert>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {view === "compare" ? (
        <Card>
          <form
            method="get"
            action={BASE}
            className="mb-3 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="view" value="compare" />
            <div className="min-w-0 basis-56">
              <Field label={t("partnerAccess.compare.a")}>
                <Select name="a" defaultValue={a.key}>
                  {profileOptions}
                </Select>
              </Field>
            </div>
            <div className="min-w-0 basis-56">
              <Field label={t("partnerAccess.compare.b")}>
                <Select name="b" defaultValue={b.key}>
                  {profileOptions}
                </Select>
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              {t("partnerAccess.compare.run")}
            </Button>
          </form>
          <p
            className="mb-3 text-sm text-zinc-700"
            data-access-compare-diff={GRANTABLE_SCREENS.filter(differs).length}
          >
            {GRANTABLE_SCREENS.some(differs)
              ? t("partnerAccess.compare.onlyDiff", {
                  n: GRANTABLE_SCREENS.filter(differs).length,
                })
              : t("partnerAccess.compare.same")}
          </p>
          <Table>
            <thead>
              <tr>
                <Th>{t("partnerAccess.col.screen")}</Th>
                <Th>{profileLabel(a, t)}</Th>
                <Th>{profileLabel(b, t)}</Th>
              </tr>
            </thead>
            <tbody>
              {GRANTABLE_SCREENS.map((s) => (
                <tr
                  key={s}
                  className={cx(rowClass, differs(s) && "bg-amber-50/70")}
                  data-access-compare={s}
                  data-differs={differs(s) ? "1" : undefined}
                >
                  <Td>
                    <span className="font-medium text-zinc-900">
                      {screenName(s)}
                    </span>
                  </Td>
                  <Td>{cell(a.access, s)}</Td>
                  <Td>{cell(b.access, s)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}
