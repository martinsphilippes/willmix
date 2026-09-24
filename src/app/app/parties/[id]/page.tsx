import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWillmix, isAdmin } from "@/lib/auth/permissions";
import { getStore, LOCALES, ROLES } from "@/lib/db";
import { getT } from "@/i18n/server";
import { LOCALE_NAMES } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { PartyForm } from "@/components/party-form";
import { SubmitButton } from "@/components/submit-button";
import { createUserAction } from "../../actions";

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
  assertWillmix(user);
  const { id } = await params;
  const { error } = await searchParams;
  const store = getStore();
  const party = await store.get("parties", id);
  if (!party) notFound();
  const t = await getT();
  const users = await store.list("users", { filter: { partyId: id } });
  const roles = isAdmin(user)
    ? ROLES
    : ROLES.filter((r) => r !== "admin" && r !== "operator");

  return (
    <>
      <PageHeader
        help={{ body: "help.party.body" }}
        t={t}
        title={party.name}
        subtitle={<Badge>{t(`party.${party.type}`)}</Badge>}
        actions={
          party.type === "supplier" ? (
            <LinkButton href={`/app/account?supplier=${party.id}`}>
              {t("nav.account")}
            </LinkButton>
          ) : null
        }
      />
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("common.edit")}>
          <PartyForm party={party} t={t} />
        </Card>
        <Card title={t("parties.users")}>
          <ul className="mb-4 space-y-1 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span>
                  {u.name} <span className="text-zinc-500">· {u.email}</span>
                </span>
                <span className="text-zinc-500">{t(`role.${u.role}`)}</span>
              </li>
            ))}
            {users.length === 0 ? (
              <li className="text-zinc-500">{t("common.none")}</li>
            ) : null}
          </ul>
          <form
            action={createUserAction}
            className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
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
    </>
  );
}
