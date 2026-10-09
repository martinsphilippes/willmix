/*
 * Visibilidade por login do cliente: só o solicitante vê a solicitação e o
 * pedido. `pt` é a fonte; `en` e `zh` têm as mesmas chaves.
 */
export const pt = {
  "login.unavailable":
    "Não foi possível entrar agora: o banco de dados do portal não está respondendo. Sua senha não é o problema. Tente de novo em alguns minutos.",
  "access.requester": "Solicitante (login do cliente)",
  "access.requesterHint":
    "Só este login do cliente verá a solicitação e o pedido; outros logins da mesma empresa não veem. Sem solicitante, nenhum login do cliente vê.",
  "access.requesterNone": "Nenhum (só a Wellmix vê)",
  "access.requesterTitle": "Solicitante do cliente",
  "access.requesterCurrent": "Atual",
  "access.requesterSaved": "Solicitante atualizado.",
  "access.error.invalid_requester":
    "O login escolhido não é um usuário ativo deste cliente.",
};
export const en: Record<keyof typeof pt, string> = {
  "login.unavailable":
    "Cannot sign in right now: the portal database is not responding. Your password is not the problem. Try again in a few minutes.",
  "access.requester": "Requester (customer login)",
  "access.requesterHint":
    "Only this customer login will see the request and the order; other logins of the same company do not. Without a requester, no customer login sees it.",
  "access.requesterNone": "None (only Wellmix sees it)",
  "access.requesterTitle": "Customer requester",
  "access.requesterCurrent": "Current",
  "access.requesterSaved": "Requester updated.",
  "access.error.invalid_requester":
    "The chosen login is not an active user of this customer.",
};
export const zh: Record<keyof typeof pt, string> = {
  "login.unavailable":
    "暂时无法登录：门户数据库没有响应。不是您的密码问题，请几分钟后再试。",
  "access.requester": "申请人（客户登录账号）",
  "access.requesterHint":
    "只有该客户登录账号能看到此申请和订单；同一公司的其他账号看不到。未指定申请人时，客户的任何账号都看不到。",
  "access.requesterNone": "无（仅 Wellmix 可见）",
  "access.requesterTitle": "客户申请人",
  "access.requesterCurrent": "当前",
  "access.requesterSaved": "申请人已更新。",
  "access.error.invalid_requester": "所选账号不是该客户的有效用户。",
};
