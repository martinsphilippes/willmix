/**
 * Dicionário do módulo "sourcing-standby" (Sourcing em espera, decisão do
 * dono em 10/11/2026, docs/RFQ_STANDBY.md): o quadro no alto da tela
 * Pedidos → Sourcing com a situação e o interruptor. Mesmas chaves em pt, en
 * e zh. O nome no menu ("Sourcing (em espera)") fica em dictionaries.ts.
 */
export const pt = {
  "sourcingStandby.state.off": "Em espera",
  "sourcingStandby.state.on": "Ativo",
  "sourcingStandby.now.title": "Como está funcionando agora",
  "sourcingStandby.now.off":
    "O Sourcing está em espera. Os produtos chegam pela ficha técnica que sobe no Book, já com o fornecedor. O pedido de produto fora do catálogo continua virando solicitação, mas não abre item de Sourcing nem pendência para a equipe. As visitas e os itens já cadastrados continuam aqui embaixo, guardados.",
  "sourcingStandby.now.on":
    "O Sourcing está ativo. O pedido de produto fora do catálogo abre um item de Sourcing e uma pendência para a equipe localizar fornecedores.",
  "sourcingStandby.kept.title": "O que está guardado (nada foi apagado)",
  "sourcingStandby.kept.1": "Visitas a feiras e fornecedores, com as fotos.",
  "sourcingStandby.kept.2":
    "Itens encontrados, com preço, medidas, fotos e negociação.",
  "sourcingStandby.kept.3":
    "Transformar um item em produto do catálogo e a busca por foto ou link.",
  "sourcingStandby.switch.hintOff":
    "Ao ativar, o pedido de produto fora do catálogo volta a abrir item de Sourcing e pendência para a equipe.",
  "sourcingStandby.switch.hintOn":
    "Ao colocar em espera, o pedido de produto fora do catálogo deixa de abrir item de Sourcing e a pendência some. O que já está cadastrado fica.",
  "sourcingStandby.switch.adminOnly":
    "Só o administrador liga ou coloca o Sourcing em espera.",
  "sourcingStandby.switch.on": "Ativar o Sourcing",
  "sourcingStandby.switch.off": "Colocar o Sourcing em espera",
  "sourcingStandby.saved.on": "Sourcing ativado.",
  "sourcingStandby.saved.off": "Sourcing em espera.",
  "requests.sourcingDemand.hintStandby":
    "Deixe o produto em branco e descreva o que procura. A Wellmix recebe o pedido como uma solicitação e responde por ela.",
};

export const en: Record<keyof typeof pt, string> = {
  "sourcingStandby.state.off": "On hold",
  "sourcingStandby.state.on": "Active",
  "sourcingStandby.now.title": "How it is working now",
  "sourcingStandby.now.off":
    "Sourcing is on hold. Products arrive through the technical sheet uploaded to the Book, already with the supplier. A request for a product outside the catalogue still becomes a request, but it does not open a Sourcing item or a task for the team. The visits and items already registered stay below, stored.",
  "sourcingStandby.now.on":
    "Sourcing is active. A request for a product outside the catalogue opens a Sourcing item and a task for the team to find suppliers.",
  "sourcingStandby.kept.title": "What is stored (nothing was deleted)",
  "sourcingStandby.kept.1": "Visits to fairs and suppliers, with the photos.",
  "sourcingStandby.kept.2":
    "Items found, with price, sizes, photos and negotiation.",
  "sourcingStandby.kept.3":
    "Turning an item into a catalogue product and the search by photo or link.",
  "sourcingStandby.switch.hintOff":
    "When activated, a request for a product outside the catalogue opens a Sourcing item and a task for the team again.",
  "sourcingStandby.switch.hintOn":
    "When put on hold, a request for a product outside the catalogue stops opening a Sourcing item and the task disappears. What is already registered stays.",
  "sourcingStandby.switch.adminOnly":
    "Only the administrator activates Sourcing or puts it on hold.",
  "sourcingStandby.switch.on": "Activate Sourcing",
  "sourcingStandby.switch.off": "Put Sourcing on hold",
  "sourcingStandby.saved.on": "Sourcing activated.",
  "sourcingStandby.saved.off": "Sourcing on hold.",
  "requests.sourcingDemand.hintStandby":
    "Leave the product blank and describe what you are looking for. Wellmix receives it as a request and answers through it.",
};

export const zh: Record<keyof typeof pt, string> = {
  "sourcingStandby.state.off": "暂停中",
  "sourcingStandby.state.on": "已启用",
  "sourcingStandby.now.title": "目前的运作方式",
  "sourcingStandby.now.off":
    "寻源功能暂停中。产品通过上传到 Book 的技术表进入系统，并已带有供应商。目录外产品的需求仍会生成询价单，但不会创建寻源条目，也不会给团队生成待办。已登记的走访和条目仍保存在下方。",
  "sourcingStandby.now.on":
    "寻源功能已启用。目录外产品的需求会创建寻源条目，并给团队生成寻找供应商的待办。",
  "sourcingStandby.kept.title": "已保存的内容（没有删除任何数据）",
  "sourcingStandby.kept.1": "展会和供应商走访记录及照片。",
  "sourcingStandby.kept.2": "已找到的条目：价格、尺寸、照片和谈判记录。",
  "sourcingStandby.kept.3": "把条目转为目录产品，以及按照片或链接搜索。",
  "sourcingStandby.switch.hintOff":
    "启用后，目录外产品的需求会重新创建寻源条目并给团队生成待办。",
  "sourcingStandby.switch.hintOn":
    "暂停后，目录外产品的需求不再创建寻源条目，待办也会消失。已登记的内容保留。",
  "sourcingStandby.switch.adminOnly": "只有管理员可以启用或暂停寻源。",
  "sourcingStandby.switch.on": "启用寻源",
  "sourcingStandby.switch.off": "暂停寻源",
  "sourcingStandby.saved.on": "寻源已启用。",
  "sourcingStandby.saved.off": "寻源已暂停。",
  "requests.sourcingDemand.hintStandby":
    "产品留空并描述您要找的东西。Wellmix 会把它作为一个询价单接收并回复。",
};
