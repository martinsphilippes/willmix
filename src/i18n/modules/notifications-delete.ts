/**
 * Dicionário do módulo "notifications-delete" (excluir avisos da lista de
 * notificações, um a um ou todos): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "notifications.delete": "Excluir",
  "notifications.deleteOne": "Excluir este aviso",
  "notifications.deleteAll": "Excluir todas",
  "notifications.deleteAllConfirm":
    "Excluir todas as notificações? Elas somem da sua lista e não voltam.",
  "notifications.deleted": "{n} notificação(ões) excluída(s).",
  "notifications.markAllRead": "Marcar todas como lidas",
};

export const en: Record<keyof typeof pt, string> = {
  "notifications.delete": "Delete",
  "notifications.deleteOne": "Delete this notification",
  "notifications.deleteAll": "Delete all",
  "notifications.deleteAllConfirm":
    "Delete all notifications? They are removed from your list for good.",
  "notifications.deleted": "{n} notification(s) deleted.",
  "notifications.markAllRead": "Mark all as read",
};

export const zh: Record<keyof typeof pt, string> = {
  "notifications.delete": "删除",
  "notifications.deleteOne": "删除此通知",
  "notifications.deleteAll": "全部删除",
  "notifications.deleteAllConfirm":
    "删除全部通知？删除后将从列表中移除，无法恢复。",
  "notifications.deleted": "已删除 {n} 条通知。",
  "notifications.markAllRead": "全部标为已读",
};
