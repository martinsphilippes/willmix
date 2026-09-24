import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TaskList } from "@/components/task-list";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/tasks");
  return <TaskList user={user} />;
}
