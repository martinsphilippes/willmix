import { describe, expect, it } from "vitest";
import { AppwriteException } from "node-appwrite";
import {
  classifyLoginError,
  serviceErrorCode,
} from "@/lib/auth/login-errors";

/* Login: senha errada × banco fora (não dizer "credenciais inválidas" quando o problema é o serviço). */
describe("erros de login", () => {
  it("senha errada, usuário bloqueado e limite de tentativas contam como credencial", () => {
    for (const type of [
      "user_invalid_credentials",
      "user_blocked",
      "general_rate_limit_exceeded",
    ])
      expect(
        classifyLoginError(new AppwriteException("x", 401, type, "")),
      ).toBe("invalid");
  });

  it("projeto pausado, erro do servidor e rede contam como serviço indisponível", () => {
    const paused = new AppwriteException(
      "Project is paused due to inactivity. Please restore it from the console to resume operations.",
      403,
      "project_paused",
      "",
    );
    expect(classifyLoginError(paused)).toBe("unavailable");
    expect(serviceErrorCode(paused)).toBe("appwrite_paused");
    expect(
      classifyLoginError(new AppwriteException("boom", 500, "general_unknown", "")),
    ).toBe("unavailable");
    expect(classifyLoginError(new TypeError("fetch failed"))).toBe(
      "unavailable",
    );
  });
});
