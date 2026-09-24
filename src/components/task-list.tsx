import Link from "next/link";
import type { User } from "@/lib/db";
import { pendingTasksFor } from "@/lib/services/tasks";
import { getT } from "@/i18n/server";
import { Badge, Card, Empty, PageHeader, formatDate } from "./ui";

export async function TaskList({ user }: { user: User }) {
  const t = await getT();
  const tasks = await pendingTasksFor(user);
  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        subtitle={t("home.welcome", { name: user.name })}
      />
      {tasks.length === 0 ? (
        <Empty>{t("tasks.empty")}</Empty>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task, i) => (
            <li key={i}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900">
                        {task.title}
                      </span>
                      {task.overdue ? (
                        <Badge tone="danger">{t("common.overdue")}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{task.detail}</p>
                    {task.dueAt ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("common.due")}: {formatDate(task.dueAt)}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={task.link}
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    {t("tasks.open")}
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
