import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  FLOW_OVERVIEW_BLOCKS,
  isFlowBlock,
  overviewHref,
  stepsOf,
} from "@/lib/flow";
import { FlowOverview } from "@/components/flow-overview";

/*
 * Overview do bloco do fluxo (docs/FLOW_MENU.md): linha do tempo dos passos
 * com o que espera ação, o que atrasou e há quantos dias, e a tabela dos
 * casos do passo escolhido. O da Produção é a tela /app/production.
 */
export default async function FlowBlockPage({
  params,
  searchParams,
}: PageProps<"/app/flow/[block]">) {
  const { block } = await params;
  if (!isFlowBlock(block) || !FLOW_OVERVIEW_BLOCKS.includes(block)) notFound();
  if (block === "production") redirect(overviewHref(block));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/app/flow/${block}`);
  requireScreen(user, stepsOf(block)[0].screen);
  const { step } = await searchParams;
  const t = await getT();
  return (
    <FlowOverview
      user={user}
      block={block}
      selected={typeof step === "string" ? step : null}
      t={t}
      basePath={overviewHref(block)}
    />
  );
}
