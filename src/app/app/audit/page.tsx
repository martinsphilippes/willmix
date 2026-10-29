import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  AUDIT_MODULES,
  auditLink,
  canSeeAudit,
  searchAudit,
  type AuditModule,
} from "@/lib/services/audit-view";
import {
  Alert,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * Auditoria (Fase G): trilha de quem fez o quê e quando, com filtros por
 * período, módulo, pessoa, pedido e texto, e o antes/depois de cada mudança.
 * Só admin e diretorias. Só leitura.
 */

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function json(value: unknown) {
  if (value === null || value === undefined) return null;
  try {
    const s =
      typeof value === "string" ? value : JSON.stringify(value, null, 1);
    return s.length > 2000 ? `${s.slice(0, 2000)}…` : s;
  } catch {
    return null;
  }
}

export default async function AuditPage({
  searchParams,
}: PageProps<"/app/audit">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeeAudit(user)) notFound();
  const t = await getT();
  const sp = await searchParams;
  const moduleParam = one(sp.module);
  const query = {
    from: day(one(sp.from)),
    to: day(one(sp.to)),
    module: (AUDIT_MODULES as readonly string[]).includes(moduleParam)
      ? (moduleParam as AuditModule)
      : null,
    userId: /^[A-Za-z0-9_-]{1,64}$/.test(one(sp.user)) ? one(sp.user) : null,
    orderNumber: /^\d{1,9}$/.test(one(sp.order)) ? Number(one(sp.order)) : null,
    text: one(sp.q).slice(0, 100) || null,
    page: /^\d{1,5}$/.test(one(sp.page)) ? Number(one(sp.page)) : 1,
  };
  const store = getStore();
  const [result, users] = await Promise.all([
    searchAudit(user, query),
    store.list("users", { orderBy: "name" }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(t.intl, {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      from: query.from,
      to: query.to,
      module: query.module,
      user: query.userId,
      order: query.orderNumber ? String(query.orderNumber) : null,
      q: query.text,
    }))
      if (v) p.set(k, v);
    p.set("page", String(page));
    return `/app/audit?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("audit.title")} subtitle={t("audit.subtitle")} />
      <Card>
        <form
          method="get"
          className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
          data-audit-filters
        >
          <Field label={t("audit.from")}>
            <Input type="date" name="from" defaultValue={query.from ?? ""} />
          </Field>
          <Field label={t("audit.to")}>
            <Input type="date" name="to" defaultValue={query.to ?? ""} />
          </Field>
          <Field label={t("audit.module")}>
            <Select name="module" defaultValue={query.module ?? ""}>
              <option value="">{t("audit.all")}</option>
              {AUDIT_MODULES.map((m) => (
                <option key={m} value={m}>
                  {t(`audit.module.${m}` as DictionaryKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("audit.user")}>
            <Select name="user" defaultValue={query.userId ?? ""}>
              <option value="">{t("audit.all")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("audit.order")}>
            <Input
              name="order"
              inputMode="numeric"
              defaultValue={query.orderNumber ?? ""}
            />
          </Field>
          <Field label={t("audit.text")}>
            <Input name="q" maxLength={100} defaultValue={query.text ?? ""} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-6">
            <SubmitButton variant="secondary">{t("audit.filter")}</SubmitButton>
            <LinkButton href="/app/audit">{t("audit.clear")}</LinkButton>
            <span className="text-sm text-zinc-500" data-audit-total>
              {t("audit.total", { n: String(result.total) })}
            </span>
          </div>
        </form>
      </Card>
      {result.capped ? <Alert tone="warning">{t("audit.capped")}</Alert> : null}
      <Card>
        {!result.rows.length ? (
          <Empty>{t("audit.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("audit.when")}</Th>
                <Th>{t("audit.who")}</Th>
                <Th>{t("audit.action")}</Th>
                <Th>{t("audit.what")}</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((e) => {
                const link = auditLink(e);
                const before = json(e.before);
                const after = json(e.after);
                return (
                  <tr key={e.id} data-audit-row={e.action}>
                    <Td className="whitespace-nowrap tabular-nums">
                      {fmt(e.createdAt)}
                    </Td>
                    <Td>
                      {e.userId
                        ? (name.get(e.userId) ?? "—")
                        : t("audit.system")}
                    </Td>
                    <Td>
                      <code className="text-xs">{e.action}</code>
                    </Td>
                    <Td>
                      {link ? (
                        <TextLink href={link}>{e.summary}</TextLink>
                      ) : (
                        e.summary
                      )}
                      {before || after ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-zinc-500">
                            {t("audit.diff")}
                          </summary>
                          <div className="mt-1 grid gap-2 text-xs sm:grid-cols-2">
                            <pre className="max-h-48 overflow-auto rounded bg-zinc-50 p-2 whitespace-pre-wrap">
                              {before ?? "—"}
                            </pre>
                            <pre className="max-h-48 overflow-auto rounded bg-emerald-50 p-2 whitespace-pre-wrap">
                              {after ?? "—"}
                            </pre>
                          </div>
                        </details>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {result.pages > 1 ? (
          <div className="mt-3 flex items-center gap-3 text-sm">
            {result.page > 1 ? (
              <TextLink href={pageHref(result.page - 1)}>
                ← {t("audit.prev")}
              </TextLink>
            ) : null}
            <span>
              {result.page} / {result.pages}
            </span>
            {result.page < result.pages ? (
              <TextLink href={pageHref(result.page + 1)}>
                {t("audit.next")} →
              </TextLink>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
