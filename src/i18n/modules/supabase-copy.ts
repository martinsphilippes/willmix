/**
 * Dicionário do módulo "supabase-copy" (Configurações → Supabase: cópia do
 * Appwrite antes da virada): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "supaCopy.link": "Supabase",
  "supaCopy.title": "Cópia para o Supabase",
  "supaCopy.subtitle":
    "Copia tudo do Appwrite para o Supabase antes da virada: tabelas (mesmo id e datas), arquivos e as contas de login (sem senha: cada pessoa define pelo link do e-mail). Pode rodar de novo: atualiza o que já foi copiado.",
  "supaCopy.onSupabase":
    "O portal já está no Supabase (DATA_MODE=supabase): a cópia fica desligada.",
  "supaCopy.notConfigured":
    "Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.",
  "supaCopy.error":
    "A cópia parou com erro: {detail}. Rodar de novo continua de onde parou.",
  "supaCopy.done": "Cópia concluída.",
  "supaCopy.partial": "Parte copiada. Continue até aparecer Concluída.",
  "supaCopy.wasReset":
    "Recomeçado do zero: as tabelas do Supabase foram esvaziadas.",
  "supaCopy.status": "Andamento",
  "supaCopy.phase": "Etapa",
  "supaCopy.phase.tables": "Tabelas",
  "supaCopy.phase.files": "Arquivos",
  "supaCopy.phase.accounts": "Contas de login",
  "supaCopy.phase.done": "Concluída",
  "supaCopy.rows": "Linhas copiadas",
  "supaCopy.tablesOf": "{n} de {total} tabelas",
  "supaCopy.files": "Arquivos",
  "supaCopy.filesCounts":
    "{copied} copiados, {existing} já estavam, {missing} sem arquivo na origem",
  "supaCopy.accounts": "Contas",
  "supaCopy.accountsCounts":
    "{created} criadas, {existing} já existiam, {failed} com erro",
  "supaCopy.updated": "Última rodada",
  "supaCopy.start": "Começar a cópia",
  "supaCopy.continue": "Continuar",
  "supaCopy.perTable": "Por tabela",
  "supaCopy.table": "Tabela",
  "supaCopy.resetTitle": "Recomeçar do zero",
  "supaCopy.resetHint":
    "Esvazia as tabelas no Supabase e zera o andamento (o Appwrite não é tocado). Use antes da cópia final da virada, para não sobrar no Supabase o que foi apagado no Appwrite depois da primeira cópia.",
  "supaCopy.confirmLabel": "Para confirmar, digite COPIAR",
  "supaCopy.reset": "Recomeçar do zero",
};

export const en: Record<keyof typeof pt, string> = {
  "supaCopy.link": "Supabase",
  "supaCopy.title": "Copy to Supabase",
  "supaCopy.subtitle":
    "Copies everything from Appwrite to Supabase before the switch: tables (same id and dates), files and the login accounts (no password: each person sets it from the e-mail link). Can run again: it updates what was already copied.",
  "supaCopy.onSupabase":
    "The portal is already on Supabase (DATA_MODE=supabase): copying is off.",
  "supaCopy.notConfigured":
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing on Vercel.",
  "supaCopy.error":
    "The copy stopped with an error: {detail}. Running again continues where it stopped.",
  "supaCopy.done": "Copy finished.",
  "supaCopy.partial": "Part copied. Continue until it shows Finished.",
  "supaCopy.wasReset": "Started over: the Supabase tables were emptied.",
  "supaCopy.status": "Progress",
  "supaCopy.phase": "Step",
  "supaCopy.phase.tables": "Tables",
  "supaCopy.phase.files": "Files",
  "supaCopy.phase.accounts": "Login accounts",
  "supaCopy.phase.done": "Finished",
  "supaCopy.rows": "Rows copied",
  "supaCopy.tablesOf": "{n} of {total} tables",
  "supaCopy.files": "Files",
  "supaCopy.filesCounts":
    "{copied} copied, {existing} already there, {missing} without a file at the source",
  "supaCopy.accounts": "Accounts",
  "supaCopy.accountsCounts":
    "{created} created, {existing} already existed, {failed} with errors",
  "supaCopy.updated": "Last run",
  "supaCopy.start": "Start the copy",
  "supaCopy.continue": "Continue",
  "supaCopy.perTable": "By table",
  "supaCopy.table": "Table",
  "supaCopy.resetTitle": "Start over",
  "supaCopy.resetHint":
    "Empties the tables on Supabase and resets the progress (Appwrite is not touched). Use before the final copy of the switch, so nothing deleted on Appwrite after the first copy stays on Supabase.",
  "supaCopy.confirmLabel": "To confirm, type COPIAR",
  "supaCopy.reset": "Start over",
};

export const zh: Record<keyof typeof pt, string> = {
  "supaCopy.link": "Supabase",
  "supaCopy.title": "复制到 Supabase",
  "supaCopy.subtitle":
    "切换前把 Appwrite 的全部数据复制到 Supabase：数据表（相同的 id 和日期）、文件和登录账户（不含密码：每个人通过邮件链接设置）。可以再次运行：会更新已复制的内容。",
  "supaCopy.onSupabase":
    "门户已在使用 Supabase（DATA_MODE=supabase）：复制已关闭。",
  "supaCopy.notConfigured":
    "Vercel 中缺少 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。",
  "supaCopy.error": "复制因错误停止：{detail}。再次运行会从停止处继续。",
  "supaCopy.done": "复制完成。",
  "supaCopy.partial": "已复制一部分。请继续，直到显示“已完成”。",
  "supaCopy.wasReset": "已从头开始：Supabase 的数据表已清空。",
  "supaCopy.status": "进度",
  "supaCopy.phase": "步骤",
  "supaCopy.phase.tables": "数据表",
  "supaCopy.phase.files": "文件",
  "supaCopy.phase.accounts": "登录账户",
  "supaCopy.phase.done": "已完成",
  "supaCopy.rows": "已复制行数",
  "supaCopy.tablesOf": "{total} 张表中的 {n} 张",
  "supaCopy.files": "文件",
  "supaCopy.filesCounts":
    "已复制 {copied}，已存在 {existing}，源端缺少文件 {missing}",
  "supaCopy.accounts": "账户",
  "supaCopy.accountsCounts": "新建 {created}，已存在 {existing}，出错 {failed}",
  "supaCopy.updated": "最近一次运行",
  "supaCopy.start": "开始复制",
  "supaCopy.continue": "继续",
  "supaCopy.perTable": "按数据表",
  "supaCopy.table": "数据表",
  "supaCopy.resetTitle": "从头开始",
  "supaCopy.resetHint":
    "清空 Supabase 中的数据表并重置进度（不影响 Appwrite）。请在切换前的最终复制之前使用，以免在首次复制后于 Appwrite 删除的数据仍留在 Supabase。",
  "supaCopy.confirmLabel": "请输入 COPIAR 以确认",
  "supaCopy.reset": "从头开始",
};
