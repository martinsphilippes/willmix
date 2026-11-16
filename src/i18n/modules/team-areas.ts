/**
 * Áreas da equipe (Equipe Acessos e Parceiros → Áreas; dono, 16/11/2026;
 * docs/ACCESS.md, "Áreas"): a seção, a lista, nova área, renomear,
 * desativar, o cadastro em massa com o resumo, a coluna e o campo "Área" da
 * equipe. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "team.tab.areas": "Áreas",
  "team.col.area": "Área",
  "access.areaNote": "A área só organiza a equipe: não libera telas nem ações.",
  "area.title": "Áreas da equipe",
  "area.intro":
    "As áreas da empresa (Marketing, Financeiro, Comex...). Cada pessoa da equipe pode ficar em uma área, escolhida em “Editar acessos”. Cada cargo (Analista Financeiro Jr, Vendedor Sênior...) fica em uma área. A área não é o Nível (de Analista a Diretor) nem a Função (o que libera telas e ações).",
  "area.col.name": "Área",
  "area.col.people": "Pessoas",
  "area.col.status": "Situação",
  "area.status.active": "Ativa",
  "area.status.inactive": "Desativada",
  "area.people.none": "Ninguém",
  "area.people.one": "1 pessoa",
  "area.people.many": "{n} pessoas",
  "area.empty": "Nenhuma área cadastrada ainda.",
  "area.count": "{n} área(s) cadastrada(s), {active} ativa(s).",
  "area.rename": "Renomear",
  "area.rename.label": "Novo nome de {name}",
  "area.rename.save": "Salvar nome",
  "area.deactivate": "Desativar",
  "area.activate": "Reativar",
  "area.deactivate.hint":
    "Desativada, a área sai das escolhas e continua em quem já está nela. Nada é apagado.",
  "area.new": "Nova área",
  "area.new.name": "Nome da área",
  "area.new.submit": "Criar área",
  "area.inactiveSuffix": "(desativada)",
  "area.saved.area_created": "Área criada.",
  "area.saved.area_renamed": "Nome da área salvo.",
  "area.saved.area_deactivated":
    "Área desativada: saiu das escolhas e continua em quem já está nela.",
  "area.saved.area_activated": "Área reativada.",
  "area.bulk.title": "Cadastrar em massa",
  "area.bulk.hint":
    "Cole uma área por linha. Entram só as que faltam; as que já existem ficam como estão, com a grafia cadastrada. Na comparação não contam maiúsculas, acentos e pontuação: “Processos/Projetos” vale por “Processos Projetos”. Logins, funções e permissões não mudam.",
  "area.bulk.label": "Áreas, uma por linha",
  "area.bulk.submit": "Cadastrar as que faltam",
  "area.bulk.done":
    "Pronto: {created} criada(s) e {existing} já cadastrada(s).",
  "area.bulk.created": "Criadas agora ({n})",
  "area.bulk.existing": "Já cadastradas, mantidas como estão ({n})",
  "area.bulk.as": "cadastrada como “{name}”",
  "area.bulk.repeated": "Repetidas na lista, entraram uma vez ({n})",
  "area.bulk.invalid":
    "Não cadastradas: precisam de 2 a 120 caracteres, com letra ou número ({n})",
  "team.error.area_name":
    "O nome da área precisa de 2 a 120 caracteres, com ao menos uma letra ou número.",
  "team.error.area_exists":
    "Já existe uma área com esse nome (sem contar maiúsculas, acentos e pontuação).",
  "team.error.area_invalid": "Escolha uma área da lista.",
  "team.error.area_inactive":
    "Essa área está desativada: reative-a em Áreas ou escolha outra.",
  "team.error.area_bulk_empty": "Cole ao menos uma área, uma por linha.",
  "team.error.area_bulk_too_many": "Cole no máximo 100 áreas por vez.",
  "team.tab.positions": "Cargos",
  "team.col.position": "Cargo",
  "access.positionNote":
    "Com área, o cargo leva a área junto. O cargo não libera telas nem ações.",
  "access.areaFromPosition":
    "Vem do cargo. Para mudar, troque o cargo ou a área do cargo em Cargos.",
  "position.pick.hint": "Com área, o cargo leva a área junto.",
  "position.title": "Cargos da equipe",
  "position.intro":
    "Os cargos da empresa (Analista Financeiro Jr, Vendedor Sênior...). Cada cargo fica em uma área; a pessoa recebe o cargo em “Editar acessos” e a área vem junto. O Nível (de Analista a Diretor) e as Funções (o que libera telas e ações) continuam separados.",
  "position.empty": "Nenhum cargo cadastrado ainda.",
  "position.count": "{n} cargo(s) cadastrado(s), {active} ativo(s).",
  "position.filter": "Filtrar por área",
  "position.filter.all": "Todas as áreas",
  "position.filter.apply": "Filtrar",
  "position.noArea": "Sem área",
  "position.noArea.notice":
    "{n} cargo(s) ativo(s) sem área: escolha a área na linha de cada um.",
  "position.col.name": "Cargo",
  "position.col.area": "Área",
  "position.area.label": "Área do cargo {name}",
  "position.deactivate.hint":
    "Trocar a área do cargo leva junto quem tem o cargo. Desativado, o cargo sai das escolhas e continua em quem já está nele. Nada é apagado.",
  "position.new": "Novo cargo",
  "position.new.name": "Nome do cargo",
  "position.new.submit": "Criar cargo",
  "position.inactiveSuffix": "(desativado)",
  "position.saved.position_created": "Cargo criado.",
  "position.saved.position_renamed": "Nome do cargo salvo.",
  "position.saved.position_area": "Área do cargo salva.",
  "position.saved.position_deactivated":
    "Cargo desativado: saiu das escolhas e continua em quem já está nele.",
  "position.saved.position_activated": "Cargo reativado.",
  "position.saved.moved":
    "{n} pessoa(s) com este cargo passaram para a nova área.",
  "position.bulk.title": "Cadastrar em massa",
  "position.bulk.hint":
    "Cole um cargo por linha. A área pode vir na mesma linha, depois de uma tabulação (colando duas colunas da planilha) ou de “;”, como em “Analista Financeiro Jr; Financeiro”. Sem área na linha, vale a área escolhida abaixo. Entram só os que faltam; os que já existem ficam como estão. A linha de título (como “CARGO” ou “AREA”) é ignorada.",
  "position.bulk.area": "Área dos cargos sem área na linha",
  "position.bulk.area.none": "Sem área",
  "position.bulk.label": "Cargos, um por linha",
  "position.bulk.submit": "Cadastrar os que faltam",
  "position.bulk.done":
    "Pronto: {created} cargo(s) criado(s) e {existing} já cadastrado(s).",
  "position.bulk.created": "Criados agora ({n})",
  "position.bulk.existing": "Já cadastrados, mantidos como estão ({n})",
  "position.bulk.as": "cadastrado como “{name}”",
  "position.bulk.unknownArea":
    "Não cadastrados: área não encontrada ou desativada ({n})",
  "position.bulk.unknownAreaItem": "{name} (área “{area}”)",
  "position.bulk.repeated": "Repetidos na lista, entraram uma vez ({n})",
  "position.bulk.invalid":
    "Não cadastrados: precisam de 2 a 120 caracteres, com letra ou número ({n})",
  "area.bulk.header": "Linha de título ignorada",
  "area.col.positions": "Cargos",
  "area.positions.count": "{n} cargo(s)",
  "team.error.position_name":
    "O nome do cargo precisa de 2 a 120 caracteres, com ao menos uma letra ou número.",
  "team.error.position_exists":
    "Já existe um cargo com esse nome (sem contar maiúsculas, acentos e pontuação).",
  "team.error.position_invalid": "Escolha um cargo da lista.",
  "team.error.position_inactive":
    "Esse cargo está desativado: reative-o em Cargos ou escolha outro.",
  "team.error.position_bulk_empty": "Cole ao menos um cargo, um por linha.",
  "team.error.position_bulk_too_many": "Cole no máximo 100 cargos por vez.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "team.tab.areas": "Areas",
  "team.col.area": "Area",
  "access.areaNote":
    "The area only organizes the team: it does not grant screens or actions.",
  "area.title": "Team areas",
  "area.intro":
    "The company's areas (Marketing, Finance, Comex...). Each team member can be in one area, chosen in “Edit access”. Each job title (Junior Financial Analyst, Senior Salesperson...) belongs to an area. The area is not the Level (from Analyst to Director) nor the Function (what grants screens and actions).",
  "area.col.name": "Area",
  "area.col.people": "People",
  "area.col.status": "Status",
  "area.status.active": "Active",
  "area.status.inactive": "Inactive",
  "area.people.none": "Nobody",
  "area.people.one": "1 person",
  "area.people.many": "{n} people",
  "area.empty": "No area registered yet.",
  "area.count": "{n} area(s) registered, {active} active.",
  "area.rename": "Rename",
  "area.rename.label": "New name for {name}",
  "area.rename.save": "Save name",
  "area.deactivate": "Deactivate",
  "area.activate": "Reactivate",
  "area.deactivate.hint":
    "Once deactivated, the area leaves the choices and stays with whoever is already in it. Nothing is deleted.",
  "area.new": "New area",
  "area.new.name": "Area name",
  "area.new.submit": "Create area",
  "area.inactiveSuffix": "(inactive)",
  "area.saved.area_created": "Area created.",
  "area.saved.area_renamed": "Area name saved.",
  "area.saved.area_deactivated":
    "Area deactivated: it left the choices and stays with whoever is already in it.",
  "area.saved.area_activated": "Area reactivated.",
  "area.bulk.title": "Bulk registration",
  "area.bulk.hint":
    "Paste one area per line. Only the missing ones are added; the ones that already exist stay as they are, with the registered spelling. The comparison ignores case, accents and punctuation: “Processos/Projetos” counts as “Processos Projetos”. Logins, functions and permissions do not change.",
  "area.bulk.label": "Areas, one per line",
  "area.bulk.submit": "Register the missing ones",
  "area.bulk.done":
    "Done: {created} created and {existing} already registered.",
  "area.bulk.created": "Created now ({n})",
  "area.bulk.existing": "Already registered, kept as they are ({n})",
  "area.bulk.as": "registered as “{name}”",
  "area.bulk.repeated": "Repeated in the list, added once ({n})",
  "area.bulk.invalid":
    "Not registered: they need 2 to 120 characters, with a letter or number ({n})",
  "team.error.area_name":
    "The area name needs 2 to 120 characters, with at least one letter or number.",
  "team.error.area_exists":
    "An area with this name already exists (ignoring case, accents and punctuation).",
  "team.error.area_invalid": "Choose an area from the list.",
  "team.error.area_inactive":
    "This area is inactive: reactivate it in Areas or choose another one.",
  "team.error.area_bulk_empty": "Paste at least one area, one per line.",
  "team.error.area_bulk_too_many": "Paste at most 100 areas at a time.",
  "team.tab.positions": "Job titles",
  "team.col.position": "Job title",
  "access.positionNote":
    "With an area, the job title brings the area along. The job title does not grant screens or actions.",
  "access.areaFromPosition":
    "Comes from the job title. To change it, change the job title or the job title's area in Job titles.",
  "position.pick.hint": "With an area, the job title brings the area along.",
  "position.title": "Team job titles",
  "position.intro":
    "The company's job titles (Junior Financial Analyst, Senior Salesperson...). Each job title belongs to an area; the person gets the job title in “Edit access” and the area comes along. The Level (from Analyst to Director) and the Functions (what grants screens and actions) stay separate.",
  "position.empty": "No job title registered yet.",
  "position.count": "{n} job title(s) registered, {active} active.",
  "position.filter": "Filter by area",
  "position.filter.all": "All areas",
  "position.filter.apply": "Filter",
  "position.noArea": "No area",
  "position.noArea.notice":
    "{n} active job title(s) without an area: choose the area on each row.",
  "position.col.name": "Job title",
  "position.col.area": "Area",
  "position.area.label": "Area of the job title {name}",
  "position.deactivate.hint":
    "Changing a job title's area moves everyone with that job title along. Once deactivated, the job title leaves the choices and stays with whoever already has it. Nothing is deleted.",
  "position.new": "New job title",
  "position.new.name": "Job title name",
  "position.new.submit": "Create job title",
  "position.inactiveSuffix": "(inactive)",
  "position.saved.position_created": "Job title created.",
  "position.saved.position_renamed": "Job title name saved.",
  "position.saved.position_area": "Job title area saved.",
  "position.saved.position_deactivated":
    "Job title deactivated: it left the choices and stays with whoever already has it.",
  "position.saved.position_activated": "Job title reactivated.",
  "position.saved.moved":
    "{n} person(s) with this job title moved to the new area.",
  "position.bulk.title": "Bulk registration",
  "position.bulk.hint":
    "Paste one job title per line. The area can come on the same line, after a tab (pasting two spreadsheet columns) or after “;”, as in “Analista Financeiro Jr; Financeiro”. Without an area on the line, the area chosen below applies. Only the missing ones are added; the ones that already exist stay as they are. A title line (such as “CARGO” or “AREA”) is ignored.",
  "position.bulk.area": "Area for job titles without an area on the line",
  "position.bulk.area.none": "No area",
  "position.bulk.label": "Job titles, one per line",
  "position.bulk.submit": "Register the missing ones",
  "position.bulk.done":
    "Done: {created} job title(s) created and {existing} already registered.",
  "position.bulk.created": "Created now ({n})",
  "position.bulk.existing": "Already registered, kept as they are ({n})",
  "position.bulk.as": "registered as “{name}”",
  "position.bulk.unknownArea":
    "Not registered: area not found or inactive ({n})",
  "position.bulk.unknownAreaItem": "{name} (area “{area}”)",
  "position.bulk.repeated": "Repeated in the list, added once ({n})",
  "position.bulk.invalid":
    "Not registered: they need 2 to 120 characters, with a letter or number ({n})",
  "area.bulk.header": "Title line ignored",
  "area.col.positions": "Job titles",
  "area.positions.count": "{n} job title(s)",
  "team.error.position_name":
    "The job title needs 2 to 120 characters, with at least one letter or number.",
  "team.error.position_exists":
    "A job title with this name already exists (ignoring case, accents and punctuation).",
  "team.error.position_invalid": "Choose a job title from the list.",
  "team.error.position_inactive":
    "This job title is inactive: reactivate it in Job titles or choose another one.",
  "team.error.position_bulk_empty":
    "Paste at least one job title, one per line.",
  "team.error.position_bulk_too_many":
    "Paste at most 100 job titles at a time.",
};

export const zh: Record<keyof typeof pt, string> = {
  "team.tab.areas": "部门",
  "team.col.area": "部门",
  "access.areaNote": "部门只用于组织团队，不开放页面或操作。",
  "area.title": "团队部门",
  "area.intro":
    "公司的部门（市场、财务、外贸……）。每位团队成员可以属于一个部门，在“编辑权限”中选择。每个职位（初级财务分析员、高级销售……）属于一个部门。部门不是级别（从分析员到总监），也不是职能（开放页面和操作的设置）。",
  "area.col.name": "部门",
  "area.col.people": "人员",
  "area.col.status": "状态",
  "area.status.active": "启用",
  "area.status.inactive": "已停用",
  "area.people.none": "无人",
  "area.people.one": "1 人",
  "area.people.many": "{n} 人",
  "area.empty": "尚未登记任何部门。",
  "area.count": "已登记 {n} 个部门，{active} 个启用。",
  "area.rename": "重命名",
  "area.rename.label": "{name} 的新名称",
  "area.rename.save": "保存名称",
  "area.deactivate": "停用",
  "area.activate": "重新启用",
  "area.deactivate.hint":
    "停用后，该部门不再出现在选项中，已在该部门的人员保持不变。不会删除任何内容。",
  "area.new": "新部门",
  "area.new.name": "部门名称",
  "area.new.submit": "创建部门",
  "area.inactiveSuffix": "（已停用）",
  "area.saved.area_created": "部门已创建。",
  "area.saved.area_renamed": "部门名称已保存。",
  "area.saved.area_deactivated":
    "部门已停用：不再出现在选项中，已在该部门的人员保持不变。",
  "area.saved.area_activated": "部门已重新启用。",
  "area.bulk.title": "批量登记",
  "area.bulk.hint":
    "每行粘贴一个部门。只添加缺少的部门；已存在的保持不变，沿用已登记的写法。比较时不区分大小写、重音和标点：“Processos/Projetos”等同于“Processos Projetos”。登录、职能和权限不变。",
  "area.bulk.label": "部门，每行一个",
  "area.bulk.submit": "登记缺少的部门",
  "area.bulk.done": "完成：新建 {created} 个，已登记 {existing} 个。",
  "area.bulk.created": "本次新建（{n}）",
  "area.bulk.existing": "已登记，保持不变（{n}）",
  "area.bulk.as": "登记为“{name}”",
  "area.bulk.repeated": "列表中重复，只添加一次（{n}）",
  "area.bulk.invalid": "未登记：需要 2 到 120 个字符，且包含字母或数字（{n}）",
  "team.error.area_name":
    "部门名称需要 2 到 120 个字符，且至少包含一个字母或数字。",
  "team.error.area_exists": "已存在同名部门（不区分大小写、重音和标点）。",
  "team.error.area_invalid": "请从列表中选择部门。",
  "team.error.area_inactive":
    "该部门已停用：请在“部门”中重新启用，或选择其他部门。",
  "team.error.area_bulk_empty": "请至少粘贴一个部门，每行一个。",
  "team.error.area_bulk_too_many": "每次最多粘贴 100 个部门。",
  "team.tab.positions": "职位",
  "team.col.position": "职位",
  "access.positionNote":
    "职位有所属部门时，部门会一并带入。职位不开放页面或操作。",
  "access.areaFromPosition":
    "来自职位。如需更改，请更换职位，或在“职位”中更改该职位的部门。",
  "position.pick.hint": "职位有所属部门时，部门会一并带入。",
  "position.title": "团队职位",
  "position.intro":
    "公司的职位（初级财务分析员、高级销售……）。每个职位属于一个部门；在“编辑权限”中为人员选择职位，部门会一并带入。级别（从分析员到总监）和职能（开放页面和操作）仍然分开。",
  "position.empty": "尚未登记任何职位。",
  "position.count": "已登记 {n} 个职位，{active} 个启用。",
  "position.filter": "按部门筛选",
  "position.filter.all": "全部部门",
  "position.filter.apply": "筛选",
  "position.noArea": "无部门",
  "position.noArea.notice": "{n} 个启用的职位没有部门：请在每一行选择部门。",
  "position.col.name": "职位",
  "position.col.area": "部门",
  "position.area.label": "职位 {name} 的部门",
  "position.deactivate.hint":
    "更改职位的部门，拥有该职位的人员会一并调整。停用后，该职位不再出现在选项中，已有该职位的人员保持不变。不会删除任何内容。",
  "position.new": "新职位",
  "position.new.name": "职位名称",
  "position.new.submit": "创建职位",
  "position.inactiveSuffix": "（已停用）",
  "position.saved.position_created": "职位已创建。",
  "position.saved.position_renamed": "职位名称已保存。",
  "position.saved.position_area": "职位的部门已保存。",
  "position.saved.position_deactivated":
    "职位已停用：不再出现在选项中，已有该职位的人员保持不变。",
  "position.saved.position_activated": "职位已重新启用。",
  "position.saved.moved": "{n} 名拥有该职位的人员已转到新部门。",
  "position.bulk.title": "批量登记",
  "position.bulk.hint":
    "每行粘贴一个职位。部门可以写在同一行，用制表符（粘贴表格的两列）或“;”分隔，例如“Analista Financeiro Jr; Financeiro”。行内没有部门时，使用下方选择的部门。只添加缺少的职位；已存在的保持不变。标题行（如“CARGO”或“AREA”）会被忽略。",
  "position.bulk.area": "行内未写部门的职位所属部门",
  "position.bulk.area.none": "无部门",
  "position.bulk.label": "职位，每行一个",
  "position.bulk.submit": "登记缺少的职位",
  "position.bulk.done": "完成：新建 {created} 个职位，已登记 {existing} 个。",
  "position.bulk.created": "本次新建（{n}）",
  "position.bulk.existing": "已登记，保持不变（{n}）",
  "position.bulk.as": "登记为“{name}”",
  "position.bulk.unknownArea": "未登记：部门不存在或已停用（{n}）",
  "position.bulk.unknownAreaItem": "{name}（部门“{area}”）",
  "position.bulk.repeated": "列表中重复，只添加一次（{n}）",
  "position.bulk.invalid":
    "未登记：需要 2 到 120 个字符，且包含字母或数字（{n}）",
  "area.bulk.header": "已忽略标题行",
  "area.col.positions": "职位",
  "area.positions.count": "{n} 个职位",
  "team.error.position_name":
    "职位名称需要 2 到 120 个字符，且至少包含一个字母或数字。",
  "team.error.position_exists": "已存在同名职位（不区分大小写、重音和标点）。",
  "team.error.position_invalid": "请从列表中选择职位。",
  "team.error.position_inactive":
    "该职位已停用：请在“职位”中重新启用，或选择其他职位。",
  "team.error.position_bulk_empty": "请至少粘贴一个职位，每行一个。",
  "team.error.position_bulk_too_many": "每次最多粘贴 100 个职位。",
};
