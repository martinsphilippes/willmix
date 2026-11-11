/**
 * Convite para booking concorrente (docs/BOOKING_INVITES.md): a Wellmix
 * convida fornecedores e tradings a subir um booking concorrente de um item;
 * o parceiro responde subindo a planilha. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.bookingInvites": "Convites de booking",
  "bookingInvites.selection.invite": "Abrir cotação",
  "bookingInvites.selection.inviteHint":
    "Convidar fornecedores e tradings a subir um booking concorrente deste item",
  "bookingInvites.invite.title": "Cotação: booking concorrente",
  "bookingInvites.invite.back": "Voltar à seleção",
  "bookingInvites.invite.item": "Item avaliado",
  "bookingInvites.invite.list": "Convites deste item",
  "bookingInvites.invite.none": "Nenhum convite para este item ainda.",
  "bookingInvites.invite.form": "Convidar parceiros",
  "bookingInvites.invite.hint":
    "Cada parceiro marcado recebe o aviso e a pendência para subir um booking concorrente deste item em até {days} dia(s) (Configurações → SLA).",
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
  "bookingInvites.invite.openLot": "Abrir o booking",
  "bookingInvites.col.number": "Nº",
  "bookingInvites.col.item": "Item",
  "bookingInvites.col.code": "Código da fábrica",
  "bookingInvites.col.booking": "Booking de origem",
  "bookingInvites.col.partner": "Parceiro",
  "bookingInvites.col.quantity": "Quantidade (peças)",
  "bookingInvites.col.status": "Situação",
  "bookingInvites.col.due": "Prazo",
  "bookingInvites.col.answer": "Booking enviado",
  "bookingInvites.status.open": "Aguardando o booking",
  "bookingInvites.status.answered": "Booking enviado",
  "bookingInvites.status.cancelled": "Cancelado",
  "bookingInvites.late": "Atrasado",
  "bookingInvites.list.title": "Convites de booking",
  "bookingInvites.list.subtitle":
    "A Wellmix convidou você a enviar um booking concorrente destes itens. Abra o convite e suba a planilha.",
  "bookingInvites.list.subtitleWellmix":
    "Convites para booking concorrente enviados aos fornecedores e tradings.",
  "bookingInvites.list.empty": "Nenhum convite por enquanto.",
  "bookingInvites.detail.title": "Convite de booking nº {n}",
  "bookingInvites.detail.back": "Ver todos os convites",
  "bookingInvites.detail.item": "O que a Wellmix procura",
  "bookingInvites.detail.material": "Material",
  "bookingInvites.detail.size": "Medidas (C × L × A, cm)",
  "bookingInvites.detail.capacity": "Capacidade (ml)",
  "bookingInvites.detail.package": "Embalagem",
  "bookingInvites.detail.colors": "Cores",
  "bookingInvites.detail.message": "O que a Wellmix precisa",
  "bookingInvites.detail.messageNone": "Sem observação.",
  "bookingInvites.detail.answer": "Enviar o booking",
  "bookingInvites.detail.answerHint":
    "Suba a planilha do seu booking (as mesmas colunas do booking de sempre: item, código, preço, MOQ, caixa, medidas, foto). Ela vai para a Wellmix avaliar.",
  "bookingInvites.detail.submit": "Enviar booking",
  "bookingInvites.detail.answered":
    "Booking enviado. A Wellmix foi avisada e vai avaliar.",
  "bookingInvites.detail.sentLot": "Booking nº {n} enviado em {date}.",
  "bookingInvites.detail.cancelled": "Este convite foi cancelado pela Wellmix.",
  "bookingInvites.notify.subject": "Convite de booking nº {n}",
  "bookingInvites.notify.body":
    "A Wellmix convida você a enviar um booking concorrente de: {item}. Prazo: {days} dia(s).",
  "bookingInvites.notify.answered.subject":
    "Convite de booking nº {n}: booking recebido",
  "bookingInvites.notify.answered.body":
    "{partner} enviou o booking nº {lot}. Confira e feche para entrar na seleção.",
  "bookingInvites.task.title": "Enviar booking concorrente: {item}",
  "bookingInvites.task.detail": "{qty} peças · convite nº {n}",
  "bookingInvites.settings.sla": "Prazo do convite de booking (dias)",
  "bookingInvites.settings.slaHint":
    "Dias corridos para o parceiro convidado subir o booking concorrente.",
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
  "nav.bookingInvites": "Booking invitations",
  "bookingInvites.selection.invite": "Open quotation",
  "bookingInvites.selection.inviteHint":
    "Invite suppliers and tradings to upload a competing booking for this item",
  "bookingInvites.invite.title": "Quotation: competing booking",
  "bookingInvites.invite.back": "Back to selection",
  "bookingInvites.invite.item": "Item under review",
  "bookingInvites.invite.list": "Invitations for this item",
  "bookingInvites.invite.none": "No invitations for this item yet.",
  "bookingInvites.invite.form": "Invite partners",
  "bookingInvites.invite.hint":
    "Each selected partner gets a notification and a task to upload a competing booking for this item within {days} day(s) (Settings → SLA).",
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
  "bookingInvites.invite.openLot": "Open the booking",
  "bookingInvites.col.number": "No.",
  "bookingInvites.col.item": "Item",
  "bookingInvites.col.code": "Factory code",
  "bookingInvites.col.booking": "Source booking",
  "bookingInvites.col.partner": "Partner",
  "bookingInvites.col.quantity": "Quantity (pcs)",
  "bookingInvites.col.status": "Status",
  "bookingInvites.col.due": "Due",
  "bookingInvites.col.answer": "Booking sent",
  "bookingInvites.status.open": "Waiting for the booking",
  "bookingInvites.status.answered": "Booking sent",
  "bookingInvites.status.cancelled": "Cancelled",
  "bookingInvites.late": "Late",
  "bookingInvites.list.title": "Booking invitations",
  "bookingInvites.list.subtitle":
    "Wellmix invited you to send a competing booking for these items. Open the invitation and upload the spreadsheet.",
  "bookingInvites.list.subtitleWellmix":
    "Competing booking invitations sent to suppliers and tradings.",
  "bookingInvites.list.empty": "No invitations yet.",
  "bookingInvites.detail.title": "Booking invitation no. {n}",
  "bookingInvites.detail.back": "See all invitations",
  "bookingInvites.detail.item": "What Wellmix is looking for",
  "bookingInvites.detail.material": "Material",
  "bookingInvites.detail.size": "Size (L × W × H, cm)",
  "bookingInvites.detail.capacity": "Capacity (ml)",
  "bookingInvites.detail.package": "Package",
  "bookingInvites.detail.colors": "Colors",
  "bookingInvites.detail.message": "What Wellmix needs",
  "bookingInvites.detail.messageNone": "No notes.",
  "bookingInvites.detail.answer": "Send the booking",
  "bookingInvites.detail.answerHint":
    "Upload your booking spreadsheet (the usual booking columns: item, code, price, MOQ, carton, size, photo). It goes to Wellmix for review.",
  "bookingInvites.detail.submit": "Send booking",
  "bookingInvites.detail.answered":
    "Booking sent. Wellmix has been notified and will review it.",
  "bookingInvites.detail.sentLot": "Booking no. {n} sent on {date}.",
  "bookingInvites.detail.cancelled": "Wellmix cancelled this invitation.",
  "bookingInvites.notify.subject": "Booking invitation no. {n}",
  "bookingInvites.notify.body":
    "Wellmix invites you to send a competing booking for: {item}. Due in {days} day(s).",
  "bookingInvites.notify.answered.subject":
    "Booking invitation no. {n}: booking received",
  "bookingInvites.notify.answered.body":
    "{partner} sent booking no. {lot}. Review and close it to add it to the selection.",
  "bookingInvites.task.title": "Send a competing booking: {item}",
  "bookingInvites.task.detail": "{qty} pcs · invitation no. {n}",
  "bookingInvites.settings.sla": "Booking invitation deadline (days)",
  "bookingInvites.settings.slaHint":
    "Calendar days for the invited partner to upload the competing booking.",
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
  "nav.bookingInvites": "订舱邀请",
  "bookingInvites.selection.invite": "发起询价",
  "bookingInvites.selection.inviteHint":
    "邀请供应商和贸易商为此商品提交竞争订舱",
  "bookingInvites.invite.title": "询价：竞争订舱",
  "bookingInvites.invite.back": "返回选品",
  "bookingInvites.invite.item": "评估中的商品",
  "bookingInvites.invite.list": "此商品的邀请",
  "bookingInvites.invite.none": "此商品暂无邀请。",
  "bookingInvites.invite.form": "邀请合作方",
  "bookingInvites.invite.hint":
    "每个选中的合作方都会收到通知和待办，需在 {days} 天内为此商品提交竞争订舱（设置 → SLA）。",
  "bookingInvites.invite.partners": "供应商和贸易商",
  "bookingInvites.invite.already": "已有未结邀请",
  "bookingInvites.invite.noPartners": "没有启用的供应商或贸易商。",
  "bookingInvites.invite.message": "Wellmix 的需求（合作方可见）",
  "bookingInvites.invite.submit": "邀请",
  "bookingInvites.invite.sending": "邀请中…",
  "bookingInvites.invite.sent": "已邀请 {n} 家合作方。",
  "bookingInvites.invite.cancel": "取消",
  "bookingInvites.invite.cancelled": "邀请已取消。",
  "bookingInvites.invite.openLot": "打开订舱",
  "bookingInvites.col.number": "编号",
  "bookingInvites.col.item": "商品",
  "bookingInvites.col.code": "工厂货号",
  "bookingInvites.col.booking": "来源订舱",
  "bookingInvites.col.partner": "合作方",
  "bookingInvites.col.quantity": "数量（件）",
  "bookingInvites.col.status": "状态",
  "bookingInvites.col.due": "截止",
  "bookingInvites.col.answer": "已提交订舱",
  "bookingInvites.status.open": "等待订舱",
  "bookingInvites.status.answered": "已提交订舱",
  "bookingInvites.status.cancelled": "已取消",
  "bookingInvites.late": "逾期",
  "bookingInvites.list.title": "订舱邀请",
  "bookingInvites.list.subtitle":
    "Wellmix 邀请您为这些商品提交竞争订舱。打开邀请并上传表格。",
  "bookingInvites.list.subtitleWellmix": "发给供应商和贸易商的竞争订舱邀请。",
  "bookingInvites.list.empty": "暂无邀请。",
  "bookingInvites.detail.title": "订舱邀请 {n}",
  "bookingInvites.detail.back": "查看全部邀请",
  "bookingInvites.detail.item": "Wellmix 寻找的商品",
  "bookingInvites.detail.material": "材质",
  "bookingInvites.detail.size": "尺寸（长 × 宽 × 高，厘米）",
  "bookingInvites.detail.capacity": "容量（毫升）",
  "bookingInvites.detail.package": "包装",
  "bookingInvites.detail.colors": "颜色",
  "bookingInvites.detail.message": "Wellmix 的需求",
  "bookingInvites.detail.messageNone": "无备注。",
  "bookingInvites.detail.answer": "提交订舱",
  "bookingInvites.detail.answerHint":
    "上传您的订舱表格（常用订舱列：商品、货号、价格、起订量、外箱、尺寸、图片），提交给 Wellmix 评估。",
  "bookingInvites.detail.submit": "提交订舱",
  "bookingInvites.detail.answered": "订舱已提交，Wellmix 已收到通知并将评估。",
  "bookingInvites.detail.sentLot": "订舱 {n} 已于 {date} 提交。",
  "bookingInvites.detail.cancelled": "Wellmix 已取消此邀请。",
  "bookingInvites.notify.subject": "订舱邀请 {n}",
  "bookingInvites.notify.body":
    "Wellmix 邀请您为以下商品提交竞争订舱：{item}。期限：{days} 天。",
  "bookingInvites.notify.answered.subject": "订舱邀请 {n}：已收到订舱",
  "bookingInvites.notify.answered.body":
    "{partner} 提交了订舱 {lot}。请核对并关闭，以进入选品。",
  "bookingInvites.task.title": "提交竞争订舱：{item}",
  "bookingInvites.task.detail": "{qty} 件 · 邀请 {n}",
  "bookingInvites.settings.sla": "订舱邀请期限（天）",
  "bookingInvites.settings.slaHint": "受邀合作方提交竞争订舱的自然日天数。",
  "bookingInvites.error.booking_invite_choose": "请至少选择一家合作方。",
  "bookingInvites.error.booking_invite_too_many": "一次最多邀请 30 家合作方。",
  "bookingInvites.error.booking_invite_partner_invalid":
    "只能邀请启用的供应商和贸易商。",
  "bookingInvites.error.booking_invite_exists":
    "所选合作方已有此商品的未结邀请。",
  "bookingInvites.error.booking_invite_closed": "此邀请已不再开放。",
  "bookingInvites.error.booking_invite_sla_invalid": "邀请期限：1 至 30 天。",
};
