import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { Alert, PageHeader } from "@/components/ui";
import { VisitForm } from "../../_components/visit-form";
import { errorMessage } from "../../_components/shared";

export default async function NewVisitPage({
  searchParams,
}: PageProps<"/app/sourcing/visits/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error } = await searchParams;
  const t = await getT();
  const suppliers = await getStore().list("parties", {
    filter: { type: "supplier" },
    orderBy: "name",
  });
  const errorText = errorMessage(t, error);
  return (
    <>
      <PageHeader
        help={{
          body: "help.sourcing.visit.body",
          steps: "help.sourcing.visit.steps",
        }}
        t={t}
        title={t("sourcing.newVisit")}
      />
      {errorText ? (
        <div className="mb-4">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <div className="max-w-3xl">
        <VisitForm t={t} suppliers={suppliers} />
      </div>
    </>
  );
}
