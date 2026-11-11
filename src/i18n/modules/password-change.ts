/**
 * Dicionário do módulo "password-change" (troca da própria senha e primeiro
 * acesso com senha provisória): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "password.title": "Trocar senha",
  "password.hint": "Informe a senha atual e escolha a nova.",
  "password.first.title": "Primeiro acesso: escolha a sua senha",
  "password.first.hint":
    "Este login foi criado com uma senha provisória. Antes de usar o portal, troque por uma senha só sua.",
  "password.current": "Senha atual",
  "password.current.first": "Senha provisória (a que você recebeu)",
  "password.next": "Senha nova",
  "password.confirm": "Repita a senha nova",
  "password.rule": "Pelo menos {min} caracteres, diferente da senha atual.",
  "password.submit": "Salvar senha nova",
  "password.pending": "Salvando…",
  "password.saved": "Senha trocada. Use a senha nova no próximo acesso.",
  "password.menu": "Trocar senha",
  "password.error.password_short":
    "A senha nova precisa de pelo menos {min} caracteres (e não pode ser uma senha muito comum).",
  "password.error.password_long": "A senha nova é longa demais.",
  "password.error.password_same":
    "A senha nova precisa ser diferente da atual.",
  "password.error.password_mismatch": "As duas senhas novas não são iguais.",
  "password.error.password_wrong": "A senha atual não confere.",
  "password.error.failed":
    "Não foi possível trocar a senha agora. Tente de novo.",
};

export const en: Record<keyof typeof pt, string> = {
  "password.title": "Change password",
  "password.hint": "Enter your current password and choose the new one.",
  "password.first.title": "First access: choose your password",
  "password.first.hint":
    "This login was created with a temporary password. Before using the portal, replace it with a password of your own.",
  "password.current": "Current password",
  "password.current.first": "Temporary password (the one you received)",
  "password.next": "New password",
  "password.confirm": "Repeat the new password",
  "password.rule":
    "At least {min} characters, different from the current password.",
  "password.submit": "Save new password",
  "password.pending": "Saving…",
  "password.saved": "Password changed. Use the new password next time.",
  "password.menu": "Change password",
  "password.error.password_short":
    "The new password needs at least {min} characters (and cannot be a very common password).",
  "password.error.password_long": "The new password is too long.",
  "password.error.password_same":
    "The new password must be different from the current one.",
  "password.error.password_mismatch": "The two new passwords do not match.",
  "password.error.password_wrong": "The current password is incorrect.",
  "password.error.failed": "Could not change the password now. Try again.",
};

export const zh: Record<keyof typeof pt, string> = {
  "password.title": "修改密码",
  "password.hint": "请输入当前密码并设置新密码。",
  "password.first.title": "首次登录：请设置您的密码",
  "password.first.hint":
    "此账号使用临时密码创建。使用平台之前，请改为您自己的密码。",
  "password.current": "当前密码",
  "password.current.first": "临时密码（您收到的那个）",
  "password.next": "新密码",
  "password.confirm": "再次输入新密码",
  "password.rule": "至少 {min} 个字符，且不能与当前密码相同。",
  "password.submit": "保存新密码",
  "password.pending": "保存中…",
  "password.saved": "密码已修改。下次登录请使用新密码。",
  "password.menu": "修改密码",
  "password.error.password_short":
    "新密码至少需要 {min} 个字符（且不能是过于常见的密码）。",
  "password.error.password_long": "新密码过长。",
  "password.error.password_same": "新密码必须与当前密码不同。",
  "password.error.password_mismatch": "两次输入的新密码不一致。",
  "password.error.password_wrong": "当前密码不正确。",
  "password.error.failed": "暂时无法修改密码，请重试。",
};
