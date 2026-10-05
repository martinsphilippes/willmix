import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TaskList } from "@/components/task-list";

export default async function TasksPage({
  searchParams,
}: PageProps<"/app/tasks">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/tasks");
  // Filtros: ?due=overdue|today|week|later|none e ?type=<etapa ou tipo>.
  const { due, type } = await searchParams;
  return (
    <TaskList
      user={user}
      due={typeof due === "string" ? due : null}
      group={typeof type === "string" ? type : null}
    />
  );
}
