import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWillmix } from "@/lib/auth/permissions";
import { getStore, PARTY_TYPES } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";

export default async function PartiesPage({
  searchParams,
}: PageProps<"/app/parties">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWillmix(user);
  const { type } = await searchParams;
  const t = await getT();
  const store = getStore();
  const parties = await store.list("parties", { orderBy: "name" });
  const filtered =
    typeof type === "string" && type
      ? parties.filter((p) => p.type === type)
      : parties;

  return (
    <>
      <PageHeader
        title={t("parties.title")}
        actions={
          <>
            <LinkButton href="/app/import?entity=parties">
              {t("parties.import")}
            </LinkButton>
            <LinkButton href="/app/parties/new" variant="primary">
              + {t("parties.new")}
            </LinkButton>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/app/parties"
          className={`rounded-full px-3 py-1 ${!type ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}
        >
          {t("common.actions") === "" ? "" : "Todos"}
        </Link>
        {PARTY_TYPES.map((pt) => (
          <Link
            key={pt}
            href={`/app/parties?type=${pt}`}
            className={`rounded-full px-3 py-1 ${type === pt ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}
          >
            {t(`party.${pt}`)}
          </Link>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("common.name")}</Th>
              <Th>{t("parties.type")}</Th>
              <Th>{t("parties.country")}</Th>
              <Th>{t("common.email")}</Th>
              <Th>{t("common.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <Td>
                  <Link
                    href={`/app/parties/${p.id}`}
                    className="font-medium underline"
                  >
                    {p.name}
                  </Link>
                </Td>
                <Td>{t(`party.${p.type}`)}</Td>
                <Td>{p.country ?? "—"}</Td>
                <Td>{p.email ?? "—"}</Td>
                <Td>
                  <Badge tone={p.active ? "success" : "neutral"}>
                    {p.active ? t("common.yes") : t("common.no")}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
