/**
 * Convite para booking concorrente (docs/BOOKING_INVITES.md): a Wellmix
 * convida fornecedores e tradings a subir um booking concorrente de um item;
 * o parceiro responde subindo a planilha. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.bookingInvites": "Convites de book",
  "bookingInvites.selection.invite": "Abrir cotação",
  "bookingInvites.selection.inviteHint":
    "Convidar fornecedores e tradings a subir um book concorrente deste item",
  "bookingInvites.invite.title": "Cotação: book concorrente",
  "bookingInvites.invite.back": "Voltar à seleção",
  "bookingInvites.invite.item": "Item avaliado",
  "bookingInvites.invite.list": "Convites deste item",
  "bookingInvites.invite.none": "Nenhum convite para este item ainda.",
  "bookingInvites.invite.form": "Convidar parceiros",
  "bookingInvites.invite.hint":
    "Cada parceiro marcado recebe o aviso e a pendência para subir um book concorrente deste item em até {days} dia(s) (Configurações → SLA).",
  "bookingInvites.invite.partners": "Fornecedores e tradings",
  "bookingInvites.invite.already": "convite em aberto",
  "bookingInvites.invite.noPartners":
    "Nenhum fornecedor ou trading ativo cadastrado.",
  "bookingInvites.invite.message": "O que a Wellmix precisa (o parceiro lê)",
  "bookingInvites.invite.submit": "Convidar",
  "bookingInvites.invite.sending": "Convidando…",
  "bookingInvites.invite.sent": "{n} parceiro(s) convidado(s).",
  "bookingInvites.invite.cancel": "Cancelar",
  "bookingInvites.invite.cancelled": "Convite cancelado.",
  "bookingInvites.invite.openLot": "Abrir o book",
  "bookingInvites.col.number": "Nº",
  "bookingInvites.col.item": "Item",
  "bookingInvites.col.code": "Código da fábrica",
  "bookingInvites.col.booking": "Book de origem",
  "bookingInvites.col.partner": "Parceiro",
  "bookingInvites.col.quantity": "Quantidade (peças)",
  "bookingInvites.col.status": "Situação",
  "bookingInvites.col.due": "Prazo",
  "bookingInvites.col.answer": "Book enviado",
  "bookingInvites.status.open": "Aguardando o book",
  "bookingInvites.status.answered": "Book enviado",
  "bookingInvites.status.cancelled": "Cancelado",
  "bookingInvites.late": "Atrasado",
  "bookingInvites.list.title": "Convites de book",
  "bookingInvites.list.subtitle":
    "A Wellmix convidou você a enviar um book concorrente destes itens. Abra o convite e suba a planilha.",
  "bookingInvites.list.subtitleWellmix":
    "Convites para book concorrente enviados aos fornecedores e tradings.",
  "bookingInvites.list.empty": "Nenhum convite por enquanto.",
  "bookingInvites.detail.title": "Convite de book nº {n}",
  "bookingInvites.detail.back": "Ver todos os convites",
  "bookingInvites.detail.item": "O que a Wellmix procura",
  "bookingInvites.detail.material": "Material",
  "bookingInvites.detail.size": "Medidas (C × L × A, cm)",
  "bookingInvites.detail.capacity": "Capacidade (ml)",
  "bookingInvites.detail.package": "Embalagem",
  "bookingInvites.detail.colors": "Cores",
  "bookingInvites.detail.message": "O que a Wellmix precisa",
  "bookingInvites.detail.messageNone": "Sem observação.",
  "bookingInvites.detail.answer": "Enviar o book",
  "bookingInvites.detail.answerHint":
    "Suba a planilha do seu book (as mesmas colunas do book de sempre: item, código, preço, MOQ, caixa, medidas, foto). Ela vai para a Wellmix avaliar.",
  "bookingInvites.detail.submit": "Enviar book",
  "bookingInvites.detail.answered":
    "Book enviado. A Wellmix foi avisada e vai avaliar.",
  "bookingInvites.detail.sentLot": "Book nº {n} enviado em {date}.",
  "bookingInvites.detail.cancelled": "Este convite foi cancelado pela Wellmix.",
  "bookingInvites.notify.subject": "Convite de book nº {n}",
  "bookingInvites.notify.body":
    "A Wellmix convida você a enviar um book concorrente de: {item}. Prazo: {days} dia(s).",
  "bookingInvites.notify.answered.subject":
    "Convite de book nº {n}: book recebido",
  "bookingInvites.notify.answered.body":
    "{partner} enviou o book nº {lot}. Confira e feche para entrar na seleção.",
  "bookingInvites.task.title": "Enviar book concorrente: {item}",
  "bookingInvites.task.detail": "{qty} peças · convite nº {n}",
  "bookingInvites.settings.sla": "Prazo do convite de book (dias)",
  "bookingInvites.settings.slaHint":
    "Dias corridos para o parceiro convidado subir o book concorrente.",
  "bookingInvites.error.booking_invite_choose":
    "Marque ao menos um parceiro para convidar.",
  "bookingInvites.error.booking_invite_too_many":
    "Convide no máximo 30 parceiros de uma vez.",
  "bookingInvites.error.booking_invite_partner_invalid":
    "Só fornecedores e tradings ativos podem ser convidados.",
  "bookingInvites.error.booking_invite_exists":
    "Os parceiros marcados já têm convite em aberto para este item.",
  "bookingInvites.error.booking_invite_closed":
    "Este convite não está mais aberto.",
  "bookingInvites.error.booking_invite_sla_invalid":
    "Prazo do convite: de 1 a 30 dias.",
} as const;

export const en: Record<keyof typeof pt, string> = {
  "nav.bookingInvites": "Book invitations",
  "bookingInvites.selection.invite": "Open quotation",
  "bookingInvites.selection.inviteHint":
    "Invite suppliers and tradings to upload a competing book for this item",
  "bookingInvites.invite.title": "Quotation: competing book",
  "bookingInvites.invite.back": "Back to selection",
  "bookingInvites.invite.item": "Item under review",
  "bookingInvites.invite.list": "Invitations for this item",
  "bookingInvites.invite.none": "No invitations for this item yet.",
  "bookingInvites.invite.form": "Invite partners",
  "bookingInvites.invite.hint":
    "Each selected partner gets a notification and a task to upload a competing book for this item within {days} day(s) (Settings → SLA).",
  "bookingInvites.invite.partners": "Suppliers and tradings",
  "bookingInvites.invite.already": "open invitation",
  "bookingInvites.invite.noPartners":
    "No active supplier or trading registered.",
  "bookingInvites.invite.message": "What Wellmix needs (the partner reads it)",
  "bookingInvites.invite.submit": "Invite",
  "bookingInvites.invite.sending": "Inviting…",
  "bookingInvites.invite.sent": "{n} partner(s) invited.",
  "bookingInvites.invite.cancel": "Cancel",
  "bookingInvites.invite.cancelled": "Invitation cancelled.",
  "bookingInvites.invite.openLot": "Open the book",
  "bookingInvites.col.number": "No.",
  "bookingInvites.col.item": "Item",
  "bookingInvites.col.code": "Factory code",
  "bookingInvites.col.booking": "Source book",
  "bookingInvites.col.partner": "Partner",
  "bookingInvites.col.quantity": "Quantity (pcs)",
  "bookingInvites.col.status": "Status",
  "bookingInvites.col.due": "Due",
  "bookingInvites.col.answer": "Book sent",
  "bookingInvites.status.open": "Waiting for the book",
  "bookingInvites.status.answered": "Book sent",
  "bookingInvites.status.cancelled": "Cancelled",
  "bookingInvites.late": "Late",
  "bookingInvites.list.title": "Book invitations",
  "bookingInvites.list.subtitle":
    "Wellmix invited you to send a competing book for these items. Open the invitation and upload the spreadsheet.",
  "bookingInvites.list.subtitleWellmix":
    "Competing book invitations sent to suppliers and tradings.",
  "bookingInvites.list.empty": "No invitations yet.",
  "bookingInvites.detail.title": "Book invitation no. {n}",
  "bookingInvites.detail.back": "See all invitations",
  "bookingInvites.detail.item": "What Wellmix is looking for",
  "bookingInvites.detail.material": "Material",
  "bookingInvites.detail.size": "Size (L × W × H, cm)",
  "bookingInvites.detail.capacity": "Capacity (ml)",
  "bookingInvites.detail.package": "Package",
  "bookingInvites.detail.colors": "Colors",
  "bookingInvites.detail.message": "What Wellmix needs",
  "bookingInvites.detail.messageNone": "No notes.",
  "bookingInvites.detail.answer": "Send the book",
  "bookingInvites.detail.answerHint":
    "Upload your book spreadsheet (the usual book columns: item, code, price, MOQ, carton, size, photo). It goes to Wellmix for review.",
  "bookingInvites.detail.submit": "Send book",
  "bookingInvites.detail.answered":
    "Book sent. Wellmix has been notified and will review it.",
  "bookingInvites.detail.sentLot": "Book no. {n} sent on {date}.",
  "bookingInvites.detail.cancelled": "Wellmix cancelled this invitation.",
  "bookingInvites.notify.subject": "Book invitation no. {n}",
  "bookingInvites.notify.body":
    "Wellmix invites you to send a competing book for: {item}. Due in {days} day(s).",
  "bookingInvites.notify.answered.subject":
    "Book invitation no. {n}: book received",
  "bookingInvites.notify.answered.body":
    "{partner} sent book no. {lot}. Review and close it to add it to the selection.",
  "bookingInvites.task.title": "Send a competing book: {item}",
  "bookingInvites.task.detail": "{qty} pcs · invitation no. {n}",
  "bookingInvites.settings.sla": "Book invitation deadline (days)",
  "bookingInvites.settings.slaHint":
    "Calendar days for the invited partner to upload the competing book.",
  "bookingInvites.error.booking_invite_choose":
    "Select at least one partner to invite.",
  "bookingInvites.error.booking_invite_too_many":
    "Invite at most 30 partners at a time.",
  "bookingInvites.error.booking_invite_partner_invalid":
    "Only active suppliers and tradings can be invited.",
  "bookingInvites.error.booking_invite_exists":
    "The selected partners already have an open invitation for this item.",
  "bookingInvites.error.booking_invite_closed":
    "This invitation is no longer open.",
  "bookingInvites.error.booking_invite_sla_invalid":
    "Invitation deadline: 1 to 30 days.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.bookingInvites": "Book 邀请",
  "bookingInvites.selection.invite": "发起询价",
  "bookingInvites.selection.inviteHint":
    "邀请供应商和贸易商为此商品提交竞争 Book",
  "bookingInvites.invite.title": "询价：竞争 Book",
  "bookingInvites.invite.back": "返回选品",
  "bookingInvites.invite.item": "评估中的商品",
  "bookingInvites.invite.list": "此商品的邀请",
  "bookingInvites.invite.none": "此商品暂无邀请。",
  "bookingInvites.invite.form": "邀请合作方",
  "bookingInvites.invite.hint":
    "每个选中的合作方都会收到通知和待办，需在 {days} 天内为此商品提交竞争 Book（设置 → SLA）。",
  "bookingInvites.invite.partners": "供应商和贸易商",
  "bookingInvites.invite.already": "已有未结邀请",
  "bookingInvites.invite.noPartners": "没有启用的供应商或贸易商。",
  "bookingInvites.invite.message": "Wellmix 的需求（合作方可见）",
  "bookingInvites.invite.submit": "邀请",
  "bookingInvites.invite.sending": "邀请中…",
  "bookingInvites.invite.sent": "已邀请 {n} 家合作方。",
  "bookingInvites.invite.cancel": "取消",
  "bookingInvites.invite.cancelled": "邀请已取消。",
  "bookingInvites.invite.openLot": "打开 Book",
  "bookingInvites.col.number": "编号",
  "bookingInvites.col.item": "商品",
  "bookingInvites.col.code": "工厂货号",
  "bookingInvites.col.booking": "来源 Book",
  "bookingInvites.col.partner": "合作方",
  "bookingInvites.col.quantity": "数量（件）",
  "bookingInvites.col.status": "状态",
  "bookingInvites.col.due": "截止",
  "bookingInvites.col.answer": "已提交 Book",
  "bookingInvites.status.open": "等待 Book",
  "bookingInvites.status.answered": "已提交 Book",
  "bookingInvites.status.cancelled": "已取消",
  "bookingInvites.late": "逾期",
  "bookingInvites.list.title": "Book 邀请",
  "bookingInvites.list.subtitle":
    "Wellmix 邀请您为这些商品提交竞争 Book。打开邀请并上传表格。",
  "bookingInvites.list.subtitleWellmix": "发给供应商和贸易商的竞争 Book 邀请。",
  "bookingInvites.list.empty": "暂无邀请。",
  "bookingInvites.detail.title": "Book 邀请 {n}",
  "bookingInvites.detail.back": "查看全部邀请",
  "bookingInvites.detail.item": "Wellmix 寻找的商品",
  "bookingInvites.detail.material": "材质",
  "bookingInvites.detail.size": "尺寸（长 × 宽 × 高，厘米）",
  "bookingInvites.detail.capacity": "容量（毫升）",
  "bookingInvites.detail.package": "包装",
  "bookingInvites.detail.colors": "颜色",
  "bookingInvites.detail.message": "Wellmix 的需求",
  "bookingInvites.detail.messageNone": "无备注。",
  "bookingInvites.detail.answer": "提交 Book",
  "bookingInvites.detail.answerHint":
    "上传您的 Book 表格（常用 Book 列：商品、货号、价格、起订量、外箱、尺寸、图片），提交给 Wellmix 评估。",
  "bookingInvites.detail.submit": "提交 Book",
  "bookingInvites.detail.answered": "Book 已提交，Wellmix 已收到通知并将评估。",
  "bookingInvites.detail.sentLot": "Book {n} 已于 {date} 提交。",
  "bookingInvites.detail.cancelled": "Wellmix 已取消此邀请。",
  "bookingInvites.notify.subject": "Book 邀请 {n}",
  "bookingInvites.notify.body":
    "Wellmix 邀请您为以下商品提交竞争 Book：{item}。期限：{days} 天。",
  "bookingInvites.notify.answered.subject": "Book 邀请 {n}：已收到 Book",
  "bookingInvites.notify.answered.body":
    "{partner} 提交了 Book {lot}。请核对并关闭，以进入选品。",
  "bookingInvites.task.title": "提交竞争 Book：{item}",
  "bookingInvites.task.detail": "{qty} 件 · 邀请 {n}",
  "bookingInvites.settings.sla": "Book 邀请期限（天）",
  "bookingInvites.settings.slaHint": "受邀合作方提交竞争 Book 的自然日天数。",
  "bookingInvites.error.booking_invite_choose": "请至少选择一家合作方。",
  "bookingInvites.error.booking_invite_too_many": "一次最多邀请 30 家合作方。",
  "bookingInvites.error.booking_invite_partner_invalid":
    "只能邀请启用的供应商和贸易商。",
  "bookingInvites.error.booking_invite_exists":
    "所选合作方已有此商品的未结邀请。",
  "bookingInvites.error.booking_invite_closed": "此邀请已不再开放。",
  "bookingInvites.error.booking_invite_sla_invalid": "邀请期限：1 至 30 天。",
};
