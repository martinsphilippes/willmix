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
    "As áreas da empresa (Marketing, Financeiro, Comex...). Cada pessoa da equipe pode ficar em uma área, escolhida em “Editar acessos”. A área não é o Cargo (o nível, de Analista a Diretor) nem a Função (o que libera telas e ações).",
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
} as const;

export const en: Record<keyof typeof pt, string> = {
  "team.tab.areas": "Areas",
  "team.col.area": "Area",
  "access.areaNote":
    "The area only organizes the team: it does not grant screens or actions.",
  "area.title": "Team areas",
  "area.intro":
    "The company's areas (Marketing, Finance, Comex...). Each team member can be in one area, chosen in “Edit access”. The area is not the Position (the level, from Analyst to Director) nor the Function (what grants screens and actions).",
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
};

export const zh: Record<keyof typeof pt, string> = {
  "team.tab.areas": "部门",
  "team.col.area": "部门",
  "access.areaNote": "部门只用于组织团队，不开放页面或操作。",
  "area.title": "团队部门",
  "area.intro":
    "公司的部门（市场、财务、外贸……）。每位团队成员可以属于一个部门，在“编辑权限”中选择。部门不是职位（从分析员到总监的级别），也不是职能（开放页面和操作的设置）。",
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
};
