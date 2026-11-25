import { redirect } from "next/navigation";
import { PM_TABS, PROJECT_MANAGEMENT_PATH } from "@/lib/project-management";

/** Sem aba no endereço: a primeira (Visão). O layout já conferiu o acesso. */
export default function ProjectManagementIndex() {
  redirect(`${PROJECT_MANAGEMENT_PATH}/${PM_TABS[0]}`);
}
