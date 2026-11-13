/**
 * Mesas de trabalho por papel (docs/DESKS.md): filas de cada área na etapa
 * Pedido. Mesmas chaves em pt, en e zh.
 */
export const pt = {
  "desk.title": "Mesa de trabalho",
  "desk.back": "← Minhas pendências",
  "desk.link": "Mesa de trabalho",
  "desk.open": "Abrir",
  "desk.late": "atrasado",
  "desk.empty": "Nada esperando aqui.",
  "desk.col.item": "Item",
  "desk.col.order": "Pedido",
  "desk.col.due": "Prazo",
  "desk.gp.name": "Gerente de produto",
  "desk.gp.subtitle":
    "Amostras a avaliar e certificações dos pedidos de compra, que esperam a aprovação do GP.",
  "desk.cadastro.name": "Cadastro e fiscal",
  "desk.cadastro.subtitle":
    "NCM a validar e fichas incompletas que seguram o contrato, certificações a vencer e falhas do Sankhya.",
  "desk.mkt.name": "Marketing",
  "desk.mkt.subtitle":
    "Artes a validar nos pedidos de compra e produtos novos que ainda não estão na vitrine.",
  "desk.agency.name": "Agência de arte",
  "desk.agency.subtitle":
    "Artes a fazer (com as devolvidas e o motivo) e artes finais com o selo, por prazo.",
  "desk.ocp.name": "Certificadora",
  "desk.ocp.subtitle":
    "Certificados a emitir nos pedidos de compra, por prazo.",
  "desk.queue.gp.samples": "Amostras a avaliar",
  "desk.queue.gp.certificates": "Certificados pendentes nos pedidos",
  "desk.queue.cadastro.ncm": "NCM a validar",
  "desk.queue.cadastro.sheet": "Fichas mestre incompletas",
  "desk.queue.cadastro.certExpiring": "Certificações a vencer",
  "desk.queue.cadastro.sankhya": "Falhas do Sankhya (7 dias)",
  "desk.queue.mkt.artReview": "Artes a validar",
  "desk.queue.mkt.showcase": "Produtos fora da vitrine",
  "desk.queue.agency.art": "Artes a fazer",
  "desk.queue.agency.artFinal": "Artes finais com o selo",
  "desk.queue.ocp.certificates": "Certificados a emitir",
};

export const en: Record<keyof typeof pt, string> = {
  "desk.title": "Workdesk",
  "desk.back": "← My tasks",
  "desk.link": "Workdesk",
  "desk.open": "Open",
  "desk.late": "late",
  "desk.empty": "Nothing waiting here.",
  "desk.col.item": "Item",
  "desk.col.order": "Order",
  "desk.col.due": "Due",
  "desk.gp.name": "Product manager",
  "desk.gp.subtitle":
    "Samples to assess and purchase order certifications waiting for the product manager.",
  "desk.cadastro.name": "Registration and tax",
  "desk.cadastro.subtitle":
    "NCM to validate and incomplete sheets holding the contract, expiring certifications and Sankhya failures.",
  "desk.mkt.name": "Marketing",
  "desk.mkt.subtitle":
    "Artwork to validate in purchase orders and new products not yet in the showcase.",
  "desk.agency.name": "Artwork agency",
  "desk.agency.subtitle":
    "Artwork to make (with the returned ones and the reason) and final artwork with the seal, by due date.",
  "desk.ocp.name": "Certifier",
  "desk.ocp.subtitle": "Certificates to issue in purchase orders, by due date.",
  "desk.queue.gp.samples": "Samples to assess",
  "desk.queue.gp.certificates": "Pending certificates in orders",
  "desk.queue.cadastro.ncm": "NCM to validate",
  "desk.queue.cadastro.sheet": "Incomplete master sheets",
  "desk.queue.cadastro.certExpiring": "Expiring certifications",
  "desk.queue.cadastro.sankhya": "Sankhya failures (7 days)",
  "desk.queue.mkt.artReview": "Artwork to validate",
  "desk.queue.mkt.showcase": "Products not in the showcase",
  "desk.queue.agency.art": "Artwork to make",
  "desk.queue.agency.artFinal": "Final artwork with the seal",
  "desk.queue.ocp.certificates": "Certificates to issue",
};

export const zh: Record<keyof typeof pt, string> = {
  "desk.title": "工作台",
  "desk.back": "← 我的待办",
  "desk.link": "工作台",
  "desk.open": "打开",
  "desk.late": "已逾期",
  "desk.empty": "这里没有待办。",
  "desk.col.item": "项目",
  "desk.col.order": "订单",
  "desk.col.due": "期限",
  "desk.gp.name": "产品经理",
  "desk.gp.subtitle": "待评估的样品和采购订单的认证，等待产品经理审批。",
  "desk.cadastro.name": "登记与税务",
  "desk.cadastro.subtitle":
    "卡住合同的待验证 NCM 和不完整资料表、即将到期的认证以及 Sankhya 失败。",
  "desk.mkt.name": "市场部",
  "desk.mkt.subtitle": "采购订单中待审核的设计稿，以及尚未上架展示的新产品。",
  "desk.agency.name": "设计代理",
  "desk.agency.subtitle":
    "待制作的设计稿（含退回的及原因）和带认证标志的最终稿，按期限排序。",
  "desk.ocp.name": "认证机构",
  "desk.ocp.subtitle": "采购订单中待出具的证书，按期限排序。",
  "desk.queue.gp.samples": "待评估样品",
  "desk.queue.gp.certificates": "订单中待办的证书",
  "desk.queue.cadastro.ncm": "待验证 NCM",
  "desk.queue.cadastro.sheet": "不完整的主资料表",
  "desk.queue.cadastro.certExpiring": "即将到期的认证",
  "desk.queue.cadastro.sankhya": "Sankhya 失败（7 天）",
  "desk.queue.mkt.artReview": "待审核设计稿",
  "desk.queue.mkt.showcase": "未上架展示的产品",
  "desk.queue.agency.art": "待制作设计稿",
  "desk.queue.agency.artFinal": "带认证标志的最终稿",
  "desk.queue.ocp.certificates": "待出具证书",
};
