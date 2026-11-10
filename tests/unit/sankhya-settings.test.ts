import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Configuração do Sankhya gravada na tela Integração Sankhya: segredos
 * cifrados (AES-256-GCM), tela com prioridade sobre as variáveis de ambiente,
 * códigos do ERP e a nota de teste montada a partir deles.
 */
withTempStore();

const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const { getStore } = await import("@/lib/db");

const env = { SESSION_SECRET: "segredo-de-teste", NODE_ENV: "test" };
const key = st.encryptionKey(env)!;

describe("cifra", () => {
  it("cifra e decifra; outra chave ou valor alterado não decifra", () => {
    const enc = st.encryptSecret("meu-client-secret", key);
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain("meu-client-secret");
    expect(st.decryptSecret(enc, key)).toBe("meu-client-secret");
    const other = st.encryptionKey({ SESSION_SECRET: "outro" })!;
    expect(st.decryptSecret(enc, other)).toBeNull();
    const [v, iv, tag, data] = enc.split(":");
    // Troca o primeiro caractere por outro de verdade: quando o cifrado já
    // começava com "A" (1 em 64), "A" + resto era o próprio valor e o teste
    // falhava ao acaso.
    const first = data.startsWith("A") ? "B" : "A";
    const tampered = [v, iv, tag, `${first}${data.slice(1)}`].join(":");
    expect(st.decryptSecret(tampered, key)).toBeNull();
    // Cada gravação usa um IV novo.
    expect(st.encryptSecret("x", key)).not.toBe(st.encryptSecret("x", key));
  });

  it("em produção sem segredo do servidor não há chave", () => {
    expect(st.encryptionKey({ NODE_ENV: "production" })).toBeNull();
    expect(
      st.encryptionKey({ NODE_ENV: "production", SANKHYA_ENCRYPTION_KEY: "k" }),
    ).not.toBeNull();
    expect(st.encryptionKey({ NODE_ENV: "development" })).not.toBeNull();
  });
});

describe("configuração efetiva", () => {
  const stored = st.mergeCredentials(
    {},
    {
      environment: "production",
      clientId: "client-id-da-tela",
      clientSecret: "client-secret-da-tela",
      xToken: "",
    },
    key,
    { at: "2026-11-10T00:00:00.000Z", by: "u1" },
  );

  it("tela tem prioridade; o que falta vem da variável de ambiente", () => {
    const status = st.resolveSankhyaConfig(stored, {
      ...env,
      SANKHYA_CLIENT_ID: "client-id-env",
      SANKHYA_X_TOKEN: "x-token-do-ambiente",
    });
    expect(status.config).toEqual({
      baseUrl: sk.SANKHYA_PRODUCTION,
      clientId: "client-id-da-tela",
      clientSecret: "client-secret-da-tela",
      xToken: "x-token-do-ambiente",
    });
    expect(status.sources).toEqual({
      clientId: "screen",
      clientSecret: "screen",
      xToken: "env",
    });
    // Só o final, nunca o valor.
    expect(status.hints.clientSecret).toBe("…tela");
    expect(JSON.stringify(status.hints)).not.toContain("client-secret");
  });

  it("sem X-Token não há configuração; segredo que não decifra é avisado", () => {
    const missing = st.resolveSankhyaConfig(stored, env);
    expect(missing.config).toBeNull();
    expect(missing.missing).toEqual(["xToken"]);
    const unreadable = st.resolveSankhyaConfig(stored, {
      SESSION_SECRET: "chave-trocada",
    });
    expect(unreadable.sources.clientId).toBe("unreadable");
  });

  it("campo vazio mantém; 'apagar' volta para a variável de ambiente", () => {
    const kept = st.mergeCredentials(
      stored,
      { environment: "sandbox", xToken: "novo-x-token" },
      key,
      { at: "x", by: "u1" },
    );
    expect(kept.clientId).toBe(stored.clientId);
    const status = st.resolveSankhyaConfig(kept, env);
    expect(status.config?.baseUrl).toBe(sk.SANKHYA_SANDBOX);
    expect(status.config?.xToken).toBe("novo-x-token");
    const cleared = st.mergeCredentials(
      kept,
      { environment: "production", clear: ["clientId"] },
      key,
      { at: "y", by: "u1" },
    );
    expect(cleared.clientId).toBeNull();
    expect(st.resolveSankhyaConfig(cleared, env).sources.clientId).toBe(
      "missing",
    );
  });

  it("grava cifrado na tabela settings e o cliente usa a configuração da tela", async () => {
    await st.saveSankhyaCredentials(
      {
        environment: "production",
        clientId: "cid-gravado",
        clientSecret: "secret-gravado",
        xToken: "xtoken-gravado",
      },
      "admin-1",
    );
    const [row] = await getStore().list("settings", {
      filter: { key: "sankhya.credentials" },
    });
    expect(JSON.stringify(row.value)).not.toContain("secret-gravado");
    const status = await st.getSankhyaConfigStatus();
    expect(status.config?.clientSecret).toBe("secret-gravado");

    // Sem config nas opções, o cliente lê a da tela.
    sk.resetSankhyaTokenCache();
    const bodies: string[] = [];
    const fetcher = (async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ) => {
      if (String(input).endsWith("/authenticate")) {
        bodies.push(String(init.body));
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 300 }),
        );
      }
      return new Response(
        JSON.stringify({
          status: "1",
          responseBody: { fieldsMetadata: [{ name: "X" }], rows: [[1]] },
        }),
      );
    }) as typeof fetch;
    const table = await sk.executeQuery("SELECT 1 AS X FROM DUAL", {
      fetch: fetcher,
    });
    expect(table.rows).toEqual([{ X: 1 }]);
    expect(bodies[0]).toContain("client_secret=secret-gravado");
  });
});

describe("códigos do ERP e nota de teste", () => {
  const erp = {
    ...st.DEFAULT_SANKHYA_ERP,
    codEmp: 1,
    codLocal: 10000,
  };

  it("diz o que falta", () => {
    expect(st.erpMissing(st.DEFAULT_SANKHYA_ERP, "order")).toEqual([
      "CODEMP",
      "CODLOCAL",
    ]);
    expect(st.erpMissing(erp, "order")).toEqual([]);
    expect(
      st.erpMissing({ ...erp, volumeMode: "fixed", codVol: " " }, "quote"),
    ).toEqual(["CODVOL"]);
  });

  it("monta cabeçalho e item com os códigos gravados", () => {
    const note = st.buildTestNote(erp, {
      kind: "quote",
      codParc: 123,
      codProd: 50,
      quantity: 2,
      unitPrice: 9.5,
      tipMov: "O",
      productVolume: "UN",
      date: "10/11/2026",
    });
    expect(note.header).toMatchObject({
      CODEMP: 1,
      CODPARC: 123,
      CODTIPOPER: 1002,
      CODTIPVENDA: 33,
      CODVEND: 0,
      TIPMOV: "O",
      DTNEG: "10/11/2026",
    });
    expect(note.items).toEqual([
      {
        CODPROD: 50,
        QTDNEG: 2,
        CODVOL: "UN",
        CODLOCALORIG: 10000,
        VLRUNIT: 9.5,
        PERCDESC: 0,
      },
    ]);
    expect(note.informPrice).toBe(true);
    const fixed = st.buildTestNote(
      { ...erp, volumeMode: "fixed", codVol: "CX" },
      {
        kind: "order",
        codParc: 1,
        codProd: 2,
        quantity: 1,
        unitPrice: 1,
        tipMov: "O",
        productVolume: "UN",
        date: "10/11/2026",
      },
    );
    expect(fixed.header.CODTIPOPER).toBe(1101);
    expect(fixed.items[0].CODVOL).toBe("CX");
  });

  it("grava e lê os códigos (padrões sugeridos antes de gravar)", async () => {
    expect((await st.getSankhyaErpSettings()).topOrder).toBe(1101);
    await st.saveSankhyaErpSettings({ ...erp, codEmp: 2 }, "admin-1");
    const saved = await st.getSankhyaErpSettings();
    expect(saved.codEmp).toBe(2);
    expect(saved.updatedBy).toBe("admin-1");
  });
});
