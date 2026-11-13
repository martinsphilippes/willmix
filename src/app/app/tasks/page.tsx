import { requireScreen } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TaskList } from "@/components/task-list";
import { LinkButton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { desksFor } from "@/lib/services/desks";

export default async function TasksPage({
  searchParams,
}: PageProps<"/app/tasks">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/tasks");
  requireScreen(user, "tasks");
  // Filtros: ?due=overdue|today|week|later|none e ?type=<etapa ou tipo>.
  const { due, type } = await searchParams;
  const t = await getT();
  return (
    <>
      {/* Mesa de trabalho do papel (docs/DESKS.md): as filas da área. */}
      {desksFor(user).length ? (
        <div className="mb-3 flex justify-end">
          <LinkButton href="/app/tasks/desk" variant="secondary" data-desk-link>
            {t("desk.link")}
          </LinkButton>
        </div>
      ) : null}
      <TaskList
        user={user}
        due={typeof due === "string" ? due : null}
        group={typeof type === "string" ? type : null}
      />
    </>
  );
}
