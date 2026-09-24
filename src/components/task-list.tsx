import type { User } from "@/lib/db";
import { pendingTasksFor } from "@/lib/services/tasks";
import { getT } from "@/i18n/server";
import {
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  cx,
  formatDate,
} from "./ui";

export async function TaskList({ user }: { user: User }) {
  const t = await getT();
  const tasks = await pendingTasksFor(user);
  return (
    <>
      <PageHeader
        help={{ body: "help.tasks.body", steps: "help.tasks.steps" }}
        t={t}
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
                      <span className="font-semibold text-zinc-900">
                        {task.title}
                      </span>
                      {task.overdue ? (
                        <Badge tone="danger">{t("common.overdue")}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{task.detail}</p>
                    {task.dueAt ? (
                      <p
                        className={cx(
                          "mt-1.5 text-xs",
                          task.overdue
                            ? "font-semibold text-red-700"
                            : "text-zinc-500",
                        )}
                      >
                        {t("common.due")}: {formatDate(task.dueAt)}
                      </p>
                    ) : null}
                  </div>
                  <LinkButton
                    href={task.link}
                    variant="primary"
                    className="shrink-0"
                  >
                    {t("tasks.open")}
                  </LinkButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
