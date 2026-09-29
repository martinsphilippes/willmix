import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix, isAdmin } from "@/lib/auth/permissions";
import { getStore, LOCALES, ROLES } from "@/lib/db";
import { getT } from "@/i18n/server";
import { LOCALE_NAMES } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
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
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { PartyForm } from "@/components/party-form";
import { SubmitButton } from "@/components/submit-button";
import { createUserAction } from "../../actions";
import { updatePartyExtraAction } from "../../actions/catalog";

const roleForType: Record<string, string> = {
  customer: "customer",
  supplier: "supplier",
  agency: "agency",
  broker: "broker",
  shipping_line: "shipping_line",
  carrier: "carrier",
  legal: "legal",
};

export default async function PartyPage({
  params,
  searchParams,
}: PageProps<"/app/parties/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { id } = await params;
  const { error, saved } = await searchParams;
  const store = getStore();
  const party = await store.get("parties", id);
  if (!party) notFound();
  const t = await getT();
  const isSupplier = party.type === "supplier";
  const [users, visits, products] = await Promise.all([
    store.list("users", { filter: { partyId: id } }),
    isSupplier
      ? store.list("supplier_visits", {
          filter: { supplierId: id },
          orderBy: "visitedAt",
          direction: "desc",
        })
      : Promise.resolve([]),
    isSupplier
      ? store.list("products", { filter: { supplierId: id }, orderBy: "name" })
      : Promise.resolve([]),
  ]);
  const roles = isAdmin(user)
    ? ROLES
    : ROLES.filter((r) => r !== "admin" && r !== "operator");

  return (
    <>
      <PageHeader
        help={{ body: "help.party.body", steps: "help.catalog.party.steps" }}
        t={t}
        title={party.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{t(`party.${party.type}`)}</Badge>
            {party.city || party.country ? (
              <span>
                {[party.city, party.country].filter(Boolean).join(", ")}
              </span>
            ) : null}
          </span>
        }
        actions={
          party.type === "supplier" ? (
            <LinkButton href={`/app/account?supplier=${party.id}`}>
              {t("nav.account")}
            </LinkButton>
          ) : null
        }
      />
      {saved ? <Alert tone="success">{t("catalog.saved")}</Alert> : null}
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("common.edit")}>
          <PartyForm party={party} t={t} />
        </Card>
        <div className="space-y-6">
          <Card title={t("catalog.party.sourcing")}>
            <form action={updatePartyExtraAction} className="space-y-4">
              <input type="hidden" name="id" value={party.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("catalog.party.city")}>
                  <Input
                    name="city"
                    maxLength={80}
                    defaultValue={party.city ?? ""}
                    className="py-2.5"
                  />
                </Field>
                <Field label={t("catalog.party.contactName")}>
                  <Input
                    name="contactName"
                    maxLength={120}
                    defaultValue={party.contactName ?? ""}
                    className="py-2.5"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t("catalog.party.address")}>
                    <Input
                      name="address"
                      maxLength={255}
                      defaultValue={party.address ?? ""}
                      className="py-2.5"
                    />
                  </Field>
                </div>
                <Field label={t("catalog.party.wechat")}>
                  <Input
                    name="wechat"
                    maxLength={80}
                    defaultValue={party.wechat ?? ""}
                    className="py-2.5"
                  />
                </Field>
              </div>
              <SubmitButton variant="secondary">
                {t("common.save")}
              </SubmitButton>
            </form>
          </Card>
          <Card title={t("parties.users")}>
            <ul className="mb-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 break-words">
                    <span className="font-medium text-zinc-900">{u.name}</span>{" "}
                    <span className="text-zinc-500">· {u.email}</span>
                  </span>
                  <span className="shrink-0">
                    <Badge>{t(`role.${u.role}`)}</Badge>
                  </span>
                </li>
              ))}
              {users.length === 0 ? (
                <li className="px-3 py-2.5 text-zinc-500">
                  {t("common.none")}
                </li>
              ) : null}
            </ul>
            <form
              action={createUserAction}
              className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
            >
              <input type="hidden" name="partyId" value={party.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("common.name")}>
                  <Input name="name" required />
                </Field>
                <Field label={t("common.email")}>
                  <Input name="email" type="email" required />
                </Field>
                <Field label={t("common.role")}>
                  <Select
                    name="role"
                    defaultValue={roleForType[party.type] ?? "customer"}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("common.language")}>
                  <Select
                    name="locale"
                    defaultValue={party.country === "CN" ? "zh" : "pt"}
                  >
                    {LOCALES.map((l) => (
                      <option key={l} value={l}>
                        {LOCALE_NAMES[l]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("login.password")}>
                  <Input name="password" type="text" minLength={6} required />
                </Field>
              </div>
              <SubmitButton variant="secondary">
                + {t("parties.users")}
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>

      {isSupplier ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card
            title={t("catalog.party.visits")}
            actions={
              <LinkButton href="/app/sourcing" className="px-3 py-1.5 text-xs">
                {t("nav.sourcing")}
              </LinkButton>
            }
          >
            {visits.length === 0 ? (
              <Empty>{t("catalog.party.visits.empty")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.date")}</Th>
                    <Th>{t("catalog.party.visit.location")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className={rowClass}>
                      <Td className="whitespace-nowrap">
                        {formatDate(v.visitedAt)}
                      </Td>
                      <Td>
                        {[v.factoryName, v.location, v.city]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {v.followUp ? (
                          <span className="block text-xs text-zinc-500">
                            {v.followUp}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge tone={v.status === "done" ? "success" : "info"}>
                          {t(
                            `catalog.visitStatus.${v.status}` as DictionaryKey,
                          )}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <TextLink href={`/app/sourcing/visits/${v.id}`}>
                          {t("catalog.party.visit.open")}
                        </TextLink>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title={t("catalog.party.products")}>
            {products.length === 0 ? (
              <Empty>{t("catalog.party.products.empty")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.product")}</Th>
                    <Th>{t("catalog.supplierSku")}</Th>
                    <Th className="text-right">{t("common.price")}</Th>
                    <Th className="text-right">{t("catalog.moq")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className={rowClass}>
                      <Td className="font-medium">
                        <TextLink
                          href={`/app/products/${p.id}`}
                          className="text-zinc-900"
                        >
                          {p.name}
                        </TextLink>
                        {p.sku ? (
                          <span className="block font-mono text-xs font-normal text-zinc-500">
                            {p.sku}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">
                          {p.supplierSku ?? "—"}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {p.price !== null
                          ? formatMoney(p.price, p.currency)
                          : "—"}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {p.moq ?? "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
