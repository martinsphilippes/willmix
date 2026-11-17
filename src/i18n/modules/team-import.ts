/**
 * Importar equipe (Equipe → "Importar da planilha") e o "A conferir" dos
 * logins (dono, 16/11/2026; docs/ACCESS.md, "Importar equipe"). Mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "teamImport.open": "Importar da planilha",
  "teamImport.subtitle":
    "Logins da equipe a partir da planilha, com cargo, área e funções.",
  "teamImport.back": "Voltar à equipe",
  "teamImport.title": "Importar equipe da planilha",
  "teamImport.hint":
    "Cole as linhas da planilha: Nome, Cargo, Área e Email, separados por tabulação (copiando as colunas da planilha) ou por “;”. A linha de títulos pode vir junto. “Conferir” mostra o que cada linha vira, sem gravar nada. Cargo e área vêm pelo nome cadastrado; o cargo com área leva a área junto. As funções e o nível são sugeridos pelo cargo; o que não dá para afirmar fica “a conferir” no login, com o motivo, para você detalhar em Editar acessos. Quem já tem login não é criado de novo.",
  "teamImport.rows": "Linhas da planilha (Nome, Cargo, Área, Email)",
  "teamImport.password": "Senha provisória (igual para todos os logins novos)",
  "teamImport.passwordHint":
    "Pelo menos 8 caracteres. No primeiro acesso o portal pede a troca da senha (a pessoa pode pular, como hoje). Peça para cada um entrar logo e trocar: enquanto a senha for esta, quem souber o e-mail entra no lugar da pessoa.",
  "teamImport.preview": "Conferir",
  "teamImport.run": "Criar os logins",
  "teamImport.working": "Trabalhando…",
  "teamImport.col.line": "Linha",
  "teamImport.col.name": "Nome",
  "teamImport.col.email": "E-mail",
  "teamImport.col.status": "Situação",
  "teamImport.col.review": "A conferir",
  "teamImport.unknownPosition": "não cadastrado",
  "teamImport.previewDone":
    "Prévia: {n} pessoa(s), {fresh} login(s) novo(s), {review} com algo a conferir",
  "teamImport.runDone":
    "Pronto: {created} login(s) criado(s) ({review} com algo a conferir) e {linked} login(s) que já existiam ligados ao cargo e à área.",
  "teamImport.remaining":
    "Faltam {n} login(s): clique em “Criar os logins” de novo para continuar.",
  "teamImport.failed": "{n} não foram criados:",
  "teamImport.invalid.name": "Linha {line}: sem nome (“{text}”)",
  "teamImport.invalid.email": "Linha {line}: sem e-mail válido (“{text}”)",
  "teamImport.repeated":
    "Linha {line}: e-mail repetido na planilha ({email}); vale a primeira",
  "teamImport.header": "Títulos reconhecidos: {header}",
  "teamImport.status.new": "Login novo",
  "teamImport.status.existing": "Já tem login",
  "teamImport.status.partner": "E-mail de um login de parceiro (fica de fora)",
  "teamImport.status.inactive": "E-mail de um login excluído (fica de fora)",
  "teamImport.skipped.has_place": "já tinha cargo ou área; ficou como estava",
  "teamImport.review": "Conferir:",
  "teamImport.noReview": "Nada a conferir",
  "teamImport.keep": "não mudam",
  "team.review.badge": "A conferir",
  "team.review.notice": "{n} login(s) com cargo, área ou funções a conferir.",
  "team.review.show": "Ver só esses",
  "team.review.only": "Mostrando só os {n} login(s) a conferir.",
  "team.review.all": "Ver toda a equipe",
  "team.review.title": "A conferir",
  "team.review.done": "Conferido: tirar a marcação ao salvar",
  "team.error.import_empty":
    "Cole ao menos uma linha da planilha (Nome, Cargo, Área, Email).",
  "team.error.import_too_many": "Cole no máximo 400 linhas por vez.",
  "team.pending.open": "{n} aguardando e-mail",
  "team.pending.title": "Aguardando e-mail",
  "team.pending.hint":
    "Quem veio da planilha sem e-mail. O cargo, a área e as funções sugeridas já estão guardados: ponha o e-mail (ou um nome de usuário) e a senha provisória e clique em “Criar login”; o portal pede a troca da senha no primeiro acesso. Quem não vai ter login pode sair da lista.",
  "team.pending.none": "Ninguém aguardando e-mail.",
  "team.pending.email": "E-mail ou nome de usuário",
  "team.pending.password": "Senha provisória",
  "team.pending.create": "Criar login",
  "team.pending.remove": "Tirar da lista",
  "team.pending.removeConfirm":
    "Tirar {name} da lista de quem aguarda e-mail? O registro fica guardado.",
  "team.pending.functions": "Funções sugeridas: {list}",
  "team.pending.noFunctions": "Sem função sugerida",
  "team.pending.saved.created": "Login criado para {name}.",
  "team.pending.saved.removed": "{name} saiu da lista.",
  "team.pending.adminOnly": "Só o administrador cria os logins.",
  "team.error.pending_not_found":
    "Essa pessoa não está mais aguardando e-mail.",
  "teamImport.pending.title": "Aguardando e-mail ({n})",
  "teamImport.pending.hint":
    "Sem e-mail na planilha: ao criar os logins, ficam na Equipe em “Aguardando e-mail”, com o cargo, a área e as funções, para pôr o e-mail depois.",
  "teamImport.pending.already": "já está aguardando",
  "teamImport.pendingDone":
    "{n} pessoa(s) sem e-mail ficaram em “Aguardando e-mail” na Equipe.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "teamImport.open": "Import from spreadsheet",
  "teamImport.subtitle":
    "Team logins from the spreadsheet, with job title, area and functions.",
  "teamImport.back": "Back to the team",
  "teamImport.title": "Import the team from a spreadsheet",
  "teamImport.hint":
    "Paste the spreadsheet rows: Name, Job title, Area and Email, separated by tabs (copying the spreadsheet columns) or by “;”. The title row can come along. “Check” shows what each row becomes, without saving anything. Job title and area are matched by the registered name; a job title with an area brings the area along. Functions and level are suggested from the job title; whatever cannot be confirmed is marked “to review” on the login, with the reason, for you to detail in Edit access. People who already have a login are not created again.",
  "teamImport.rows": "Spreadsheet rows (Name, Job title, Area, Email)",
  "teamImport.password": "Temporary password (the same for every new login)",
  "teamImport.passwordHint":
    "At least 8 characters. On first access the portal asks for a new password (the person can skip, as today). Ask everyone to sign in soon and change it: while the password is this one, anyone who knows the email can sign in as them.",
  "teamImport.preview": "Check",
  "teamImport.run": "Create the logins",
  "teamImport.working": "Working…",
  "teamImport.col.line": "Row",
  "teamImport.col.name": "Name",
  "teamImport.col.email": "Email",
  "teamImport.col.status": "Status",
  "teamImport.col.review": "To review",
  "teamImport.unknownPosition": "not registered",
  "teamImport.previewDone":
    "Preview: {n} person(s), {fresh} new login(s), {review} with something to review",
  "teamImport.runDone":
    "Done: {created} login(s) created ({review} with something to review) and {linked} existing login(s) linked to the job title and area.",
  "teamImport.remaining":
    "{n} login(s) left: click “Create the logins” again to continue.",
  "teamImport.failed": "{n} were not created:",
  "teamImport.invalid.name": "Row {line}: no name (“{text}”)",
  "teamImport.invalid.email": "Row {line}: no valid email (“{text}”)",
  "teamImport.repeated":
    "Row {line}: email repeated in the spreadsheet ({email}); the first one counts",
  "teamImport.header": "Titles recognized: {header}",
  "teamImport.status.new": "New login",
  "teamImport.status.existing": "Already has a login",
  "teamImport.status.partner": "Email of a partner login (left out)",
  "teamImport.status.inactive": "Email of a deleted login (left out)",
  "teamImport.skipped.has_place":
    "already had a job title or area; left as it was",
  "teamImport.review": "Review:",
  "teamImport.noReview": "Nothing to review",
  "teamImport.keep": "unchanged",
  "team.review.badge": "To review",
  "team.review.notice":
    "{n} login(s) with a job title, area or functions to review.",
  "team.review.show": "Show only these",
  "team.review.only": "Showing only the {n} login(s) to review.",
  "team.review.all": "Show the whole team",
  "team.review.title": "To review",
  "team.review.done": "Reviewed: remove the mark when saving",
  "team.error.import_empty":
    "Paste at least one spreadsheet row (Name, Job title, Area, Email).",
  "team.error.import_too_many": "Paste at most 400 rows at a time.",
  "team.pending.open": "{n} waiting for an email",
  "team.pending.title": "Waiting for an email",
  "team.pending.hint":
    "People who came from the spreadsheet without an email. The job title, area and suggested functions are already saved: enter the email (or a username) and the temporary password and click “Create login”; the portal asks for a new password on first access. Whoever will not have a login can leave the list.",
  "team.pending.none": "Nobody waiting for an email.",
  "team.pending.email": "Email or username",
  "team.pending.password": "Temporary password",
  "team.pending.create": "Create login",
  "team.pending.remove": "Remove from the list",
  "team.pending.removeConfirm":
    "Remove {name} from the list of people waiting for an email? The record is kept.",
  "team.pending.functions": "Suggested functions: {list}",
  "team.pending.noFunctions": "No suggested function",
  "team.pending.saved.created": "Login created for {name}.",
  "team.pending.saved.removed": "{name} left the list.",
  "team.pending.adminOnly": "Only the administrator creates the logins.",
  "team.error.pending_not_found":
    "This person is no longer waiting for an email.",
  "teamImport.pending.title": "Waiting for an email ({n})",
  "teamImport.pending.hint":
    "No email in the spreadsheet: when the logins are created, they stay in the Team under “Waiting for an email”, with the job title, area and functions, so the email can be added later.",
  "teamImport.pending.already": "already waiting",
  "teamImport.pendingDone":
    "{n} person(s) without an email are now in “Waiting for an email” in the Team.",
};

export const zh: Record<keyof typeof pt, string> = {
  "teamImport.open": "从表格导入",
  "teamImport.subtitle": "根据表格创建团队账号，包含职位、部门和职能。",
  "teamImport.back": "返回团队",
  "teamImport.title": "从表格导入团队",
  "teamImport.hint":
    "粘贴表格的行：姓名、职位、部门和邮箱，用制表符（复制表格的列）或“;”分隔。可以连同标题行一起粘贴。“检查”会显示每一行将变成什么，不保存任何内容。职位和部门按已登记的名称匹配；职位有所属部门时，部门会一并带入。职能和级别根据职位建议；无法确定的会在账号上标记“待核对”并注明原因，供您在“编辑权限”中细化。已有账号的人员不会重复创建。",
  "teamImport.rows": "表格行（姓名、职位、部门、邮箱）",
  "teamImport.password": "临时密码（所有新账号相同）",
  "teamImport.passwordHint":
    "至少 8 个字符。首次登录时系统会要求更改密码（与现在一样，可以跳过）。请提醒每个人尽快登录并更改：只要密码还是这个，知道邮箱的人就能冒用其身份登录。",
  "teamImport.preview": "检查",
  "teamImport.run": "创建账号",
  "teamImport.working": "处理中…",
  "teamImport.col.line": "行",
  "teamImport.col.name": "姓名",
  "teamImport.col.email": "邮箱",
  "teamImport.col.status": "状态",
  "teamImport.col.review": "待核对",
  "teamImport.unknownPosition": "未登记",
  "teamImport.previewDone":
    "预览：{n} 人，{fresh} 个新账号，{review} 个有待核对内容",
  "teamImport.runDone":
    "完成：已创建 {created} 个账号（{review} 个有待核对内容），{linked} 个已有账号已关联职位和部门。",
  "teamImport.remaining": "还剩 {n} 个账号：请再次点击“创建账号”继续。",
  "teamImport.failed": "{n} 个未创建：",
  "teamImport.invalid.name": "第 {line} 行：没有姓名（“{text}”）",
  "teamImport.invalid.email": "第 {line} 行：没有有效邮箱（“{text}”）",
  "teamImport.repeated":
    "第 {line} 行：表格中邮箱重复（{email}）；以第一行为准",
  "teamImport.header": "识别的标题：{header}",
  "teamImport.status.new": "新账号",
  "teamImport.status.existing": "已有账号",
  "teamImport.status.partner": "合作伙伴账号的邮箱（不处理）",
  "teamImport.status.inactive": "已删除账号的邮箱（不处理）",
  "teamImport.skipped.has_place": "已有职位或部门；保持不变",
  "teamImport.review": "待核对：",
  "teamImport.noReview": "无需核对",
  "teamImport.keep": "不变",
  "team.review.badge": "待核对",
  "team.review.notice": "{n} 个账号的职位、部门或职能待核对。",
  "team.review.show": "只看这些",
  "team.review.only": "只显示 {n} 个待核对的账号。",
  "team.review.all": "查看全部团队",
  "team.review.title": "待核对",
  "team.review.done": "已核对：保存时移除标记",
  "team.error.import_empty":
    "请至少粘贴一行表格数据（姓名、职位、部门、邮箱）。",
  "team.error.import_too_many": "每次最多粘贴 400 行。",
  "team.pending.open": "{n} 人等待邮箱",
  "team.pending.title": "等待邮箱",
  "team.pending.hint":
    "表格中没有邮箱的人员。职位、部门和建议的职能已保存：输入邮箱（或用户名）和临时密码，然后点击“创建账号”；首次登录时系统会要求更改密码。不需要账号的人可以从列表中移除。",
  "team.pending.none": "没有人等待邮箱。",
  "team.pending.email": "邮箱或用户名",
  "team.pending.password": "临时密码",
  "team.pending.create": "创建账号",
  "team.pending.remove": "从列表中移除",
  "team.pending.removeConfirm":
    "将 {name} 从等待邮箱的列表中移除？记录会保留。",
  "team.pending.functions": "建议的职能：{list}",
  "team.pending.noFunctions": "没有建议的职能",
  "team.pending.saved.created": "已为 {name} 创建账号。",
  "team.pending.saved.removed": "{name} 已从列表中移除。",
  "team.pending.adminOnly": "只有管理员可以创建账号。",
  "team.error.pending_not_found": "此人已不在等待邮箱的列表中。",
  "teamImport.pending.title": "等待邮箱（{n}）",
  "teamImport.pending.hint":
    "表格中没有邮箱：创建账号时，这些人员会进入团队的“等待邮箱”，保留职位、部门和职能，以便之后补上邮箱。",
  "teamImport.pending.already": "已在等待",
  "teamImport.pendingDone": "{n} 名没有邮箱的人员已进入团队的“等待邮箱”。",
};
