import { beforeEach, describe, expect, it } from "vitest";

/*
 * Cliente da API do Sankhya (OAuth client credentials + serviços do gateway),
 * sem rede: um fetch falso registra cada chamada e responde como o Sankhya.
 */
const sk = await import("@/lib/integrations/sankhya-client");
const dict = await import("@/lib/integrations/sankhya-dictionary");

const config = {
  baseUrl: sk.SANKHYA_PRODUCTION,
  clientId: "cid",
  clientSecret: "secret",
  xToken: "xtoken-123456",
};

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(
  handler: (url: string, init: RequestInit, calls: Call[]) => Response,
) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init, calls);
  }) as typeof fetch;
  return { fetcher, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const tokenResponse = (token = "tok-1") =>
  json({ access_token: token, token_type: "Bearer", expires_in: 300 });

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

beforeEach(() => sk.resetSankhyaTokenCache());

describe("configuração", () => {
  it("pede as três variáveis e aceita só os gateways oficiais", () => {
    expect(sk.sankhyaMissingEnv({})).toEqual([
      "SANKHYA_CLIENT_ID",
      "SANKHYA_CLIENT_SECRET",
      "SANKHYA_X_TOKEN",
    ]);
    const env = {
      SANKHYA_CLIENT_ID: " a ",
      SANKHYA_CLIENT_SECRET: "b",
      SANKHYA_X_TOKEN: "c",
    };
    expect(sk.sankhyaConfig(env)).toMatchObject({
      baseUrl: "https://api.sankhya.com.br",
      clientId: "a",
    });
    expect(
      sk.sankhyaConfig({
        ...env,
        SANKHYA_BASE_URL: "https://api.sandbox.sankhya.com.br/",
      })?.baseUrl,
    ).toBe("https://api.sandbox.sankhya.com.br");
    expect(
      sk.sankhyaConfig({ ...env, SANKHYA_BASE_URL: "https://evil.example" }),
    ).toBeNull();
  });
});

describe("autenticação", () => {
  it("manda X-Token e client credentials no formulário; guarda o token", async () => {
    const { fetcher, calls } = fakeFetch((url) =>
      url.endsWith("/authenticate")
        ? tokenResponse()
        : json({ status: "1", responseBody: { entities: { total: "0" } } }),
    );
    await sk.loadRecords({ entity: "Produto" }, { config, fetch: fetcher });
    await sk.loadRecords({ entity: "Parceiro" }, { config, fetch: fetcher });
    const auth = calls.filter((c) => c.url.endsWith("/authenticate"));
    expect(auth).toHaveLength(1);
    expect(headersOf(auth[0].init)["X-Token"]).toBe("xtoken-123456");
    const body = new URLSearchParams(String(auth[0].init.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "client_credentials",
      client_id: "cid",
      client_secret: "secret",
    });
    const service = calls.filter((c) => !c.url.endsWith("/authenticate"));
    expect(service).toHaveLength(2);
    expect(headersOf(service[0].init).Authorization).toBe("Bearer tok-1");
  });

  it("credencial recusada vira sankhya_auth com o texto do Sankhya", async () => {
    const { fetcher } = fakeFetch(() =>
      json(
        {
          error: "invalid_client",
          error_description: "Invalid client credentials",
        },
        401,
      ),
    );
    await expect(sk.authenticate(config, fetcher)).rejects.toMatchObject({
      code: "sankhya_auth",
      detail: "Invalid client credentials",
    });
  });

  it("um 401 no serviço renova o token e tenta de novo", async () => {
    let tokens = 0;
    let services = 0;
    const { fetcher } = fakeFetch((url) => {
      if (url.endsWith("/authenticate"))
        return tokenResponse(`tok-${++tokens}`);
      return ++services === 1
        ? new Response("expired", { status: 401 })
        : json({ status: "1", responseBody: {} });
    });
    await sk.callService("DatasetSP.save", {}, { config, fetch: fetcher });
    expect(tokens).toBe(2);
    expect(services).toBe(2);
  });

  it("sem configuração, avisa sem chamar a rede", async () => {
    await expect(
      sk.loadRecords({ entity: "Produto" }, { config: null }),
    ).rejects.toMatchObject({
      code: "sankhya_not_configured",
    });
  });
});

describe("serviços", () => {
  it("CACSP vai pelo mgecom; o resto pelo mge", async () => {
    expect(sk.moduleOf("CACSP.incluirNota")).toBe("mgecom");
    expect(sk.moduleOf("SelecaoDocumentoSP.faturar")).toBe("mgecom");
    expect(sk.moduleOf("CRUDServiceProvider.loadRecords")).toBe("mge");
    const { fetcher, calls } = fakeFetch((url) =>
      url.endsWith("/authenticate")
        ? tokenResponse()
        : json({ status: "1", responseBody: { pk: { NUNOTA: { $: "740" } } } }),
    );
    const out = await sk.createNote(
      {
        header: { CODPARC: 1, CODTIPOPER: 2000, TIPMOV: "P" },
        items: [{ CODPROD: 8, QTDNEG: 1, VLRUNIT: 1.75 }],
        informPrice: true,
      },
      { config, fetch: fetcher },
    );
    expect(out.nunota).toBe("740");
    const call = calls[1];
    expect(call.url).toBe(
      "https://api.sankhya.com.br/gateway/v1/mgecom/service.sbr?serviceName=CACSP.incluirNota&outputType=json",
    );
    const sent = JSON.parse(String(call.init.body));
    expect(sent.serviceName).toBe("CACSP.incluirNota");
    expect(sent.requestBody.nota.cabecalho).toEqual({
      NUNOTA: {},
      CODPARC: { $: "1" },
      CODTIPOPER: { $: "2000" },
      TIPMOV: { $: "P" },
    });
    expect(sent.requestBody.nota.itens.INFORMARPRECO).toBe("True");
    expect(sent.requestBody.nota.itens.item[0]).toMatchObject({
      CODPROD: { $: "8" },
      VLRUNIT: { $: "1.75" },
      IGNOREDESCPROMOQTD: { $: "True" },
    });
  });

  it("status diferente de 1 é erro, com a mensagem (inclusive em Base64)", async () => {
    const message = Buffer.from("Campo CODPARC obrigatório na nota").toString(
      "base64",
    );
    const { fetcher } = fakeFetch((url) =>
      url.endsWith("/authenticate")
        ? tokenResponse()
        : json({ status: "0", statusMessage: message }),
    );
    await expect(
      sk.callService("DatasetSP.save", {}, { config, fetch: fetcher }),
    ).rejects.toMatchObject({
      code: "sankhya_service",
      detail: "Campo CODPARC obrigatório na nota",
    });
    expect(sk.decodeStatusMessage("Erro simples")).toBe("Erro simples");
  });

  it("loadRecords monta o dataSet com ligações e critério, e lê f0..fn", async () => {
    const { fetcher, calls } = fakeFetch((url) =>
      url.endsWith("/authenticate")
        ? tokenResponse()
        : json({
            status: "1",
            responseBody: {
              entities: {
                total: "2",
                hasMoreResult: "true",
                offsetPage: "0",
                metadata: {
                  fields: {
                    field: [
                      { name: "CODPROD" },
                      { name: "DESCRPROD" },
                      { name: "GrupoProduto_DESCRGRUPOPROD" },
                    ],
                  },
                },
                entity: [
                  {
                    f0: { $: "1" },
                    f1: { $: "QUEIJO" },
                    f2: { $: "LATICÍNIOS" },
                  },
                  { f0: { $: "2" }, f1: {}, f2: { $: "X" } },
                ],
              },
            },
          }),
    );
    const out = await sk.loadRecords(
      {
        entity: "Produto",
        fields: "CODPROD, DESCRPROD",
        joins: [{ path: "GrupoProduto", fields: "DESCRGRUPOPROD" }],
        where: "ATIVO = ?",
        params: [{ value: "S", type: "S" }],
        page: 1,
      },
      { config, fetch: fetcher },
    );
    expect(out).toMatchObject({ total: 2, hasMore: true });
    expect(out.rows).toEqual([
      {
        CODPROD: "1",
        DESCRPROD: "QUEIJO",
        GrupoProduto_DESCRGRUPOPROD: "LATICÍNIOS",
      },
      { CODPROD: "2", DESCRPROD: null, GrupoProduto_DESCRGRUPOPROD: "X" },
    ]);
    const dataSet = JSON.parse(String(calls[1].init.body)).requestBody.dataSet;
    expect(dataSet).toMatchObject({
      rootEntity: "Produto",
      offsetPage: "1",
      criteria: {
        expression: { $: "ATIVO = ?" },
        parameter: [{ $: "S", type: "S" }],
      },
      entity: [
        { path: "", fieldset: { list: "CODPROD, DESCRPROD" } },
        { path: "GrupoProduto", fieldset: { list: "DESCRGRUPOPROD" } },
      ],
    });
  });

  it("um registro só (objeto, não lista) também vira linha", () => {
    const out = sk.parseLoadRecords({
      entities: {
        total: "1",
        metadata: { fields: { field: { name: "CODEMP" } } },
        entity: { f0: { $: "1" } },
      },
    });
    expect(out.rows).toEqual([{ CODEMP: "1" }]);
  });

  it("recusa entidade e campos fora do formato antes de chamar o Sankhya", async () => {
    await expect(
      sk.loadRecords({ entity: "Produto; DROP" }, { config, fetch: fetch }),
    ).rejects.toMatchObject({ code: "sankhya_service" });
    await expect(
      sk.loadRecords(
        { entity: "Produto", fields: "CODPROD) --" },
        { config, fetch: fetch },
      ),
    ).rejects.toMatchObject({ code: "sankhya_service" });
  });

  it("DatasetSP.save: com pk altera, sem pk inclui; valores por índice", async () => {
    const { fetcher, calls } = fakeFetch((url) =>
      url.endsWith("/authenticate")
        ? tokenResponse()
        : json({
            status: "1",
            responseBody: { total: "1", result: [["4454", "NOME", "S"]] },
          }),
    );
    const out = await sk.datasetSave(
      {
        entity: "Parceiro",
        values: { CODPARC: null, NOMEPARC: "NOME", ATIVO: "S" },
      },
      { config, fetch: fetcher },
    );
    expect(out.rows[0]).toEqual({
      CODPARC: "4454",
      NOMEPARC: "NOME",
      ATIVO: "S",
    });
    const body = JSON.parse(String(calls[1].init.body)).requestBody;
    expect(body).toEqual({
      entityName: "Parceiro",
      standAlone: false,
      fields: ["CODPARC", "NOMEPARC", "ATIVO"],
      records: [{ values: { 0: "", 1: "NOME", 2: "S" } }],
    });
    await sk.datasetSave(
      {
        entity: "Parceiro",
        values: { NOMEPARC: "NOVO" },
        pk: { CODPARC: 4454 },
      },
      { config, fetch: fetcher },
    );
    expect(
      JSON.parse(String(calls[2].init.body)).requestBody.records[0].pk,
    ).toEqual({
      CODPARC: "4454",
    });
  });
});

describe("SQL somente leitura", () => {
  it("aceita SELECT e WITH; recusa o que altera o banco", () => {
    expect(sk.assertReadOnlySql("SELECT * FROM TGFPRO;")).toBe(
      "SELECT * FROM TGFPRO",
    );
    expect(() =>
      sk.assertReadOnlySql("with x as (select 1 from dual) select * from x"),
    ).not.toThrow();
    // Palavra dentro de texto não conta.
    expect(() =>
      sk.assertReadOnlySql(
        "SELECT * FROM TGFPAR WHERE NOMEPARC = 'DELETE; LTDA'",
      ),
    ).not.toThrow();
    for (const bad of [
      "DELETE FROM TGFPRO",
      "SELECT 1; DROP TABLE TGFPRO",
      "UPDATE TGFPRO SET ATIVO = 'N'",
      "SELECT * FROM TGFPRO /* x */ ; TRUNCATE TABLE X",
      "EXEC sp_who",
    ])
      expect(() => sk.assertReadOnlySql(bad), bad).toThrow(sk.SankhyaError);
  });

  it("lê fieldsMetadata e rows do executeQuery", async () => {
    const { fetcher } = fakeFetch((url) =>
      url.endsWith("/authenticate")
        ? tokenResponse()
        : json({
            status: "1",
            responseBody: {
              fieldsMetadata: [{ name: "NOMETAB" }, { name: "DESCRTAB" }],
              rows: [["TGFPRO", "Produtos"]],
            },
          }),
    );
    const out = await dict.searchTables("produto", { config, fetch: fetcher });
    expect(out.rows).toEqual([{ NOMETAB: "TGFPRO", DESCRTAB: "Produtos" }]);
  });
});

describe("dicionário de dados", () => {
  it("termo e nome de tabela não levam aspas nem símbolos ao SQL", () => {
    expect(dict.sqlTerm("Pedido' OR 1=1 --")).toBe("PEDIDO OR 11");
    expect(dict.sqlTerm("Cotação")).toBe("COTACAO");
    expect(dict.tableName("tgfpro")).toBe("TGFPRO");
    expect(dict.tableName("TGFPRO'--")).toBeNull();
    expect(dict.searchTablesSql("nota")).toContain("LIKE '%NOTA%'");
    expect(dict.searchTablesSql("")).not.toContain("WHERE");
    expect(dict.linksSql("TGFCAB")).toContain("O.NOMETAB = 'TGFCAB'");
  });

  it("cada parte da descrição falha sozinha", async () => {
    const { fetcher } = fakeFetch((url, init) => {
      if (url.endsWith("/authenticate")) return tokenResponse();
      const sql = JSON.parse(String(init.body)).requestBody.sql as string;
      return sql.includes("TDDLIG")
        ? json({ status: "0", statusMessage: "ORA-00904: invalid identifier" })
        : json({
            status: "1",
            responseBody: {
              fieldsMetadata: [{ name: "NOMECAMPO" }],
              rows: [["CODPROD"]],
            },
          });
    });
    const out = await dict.describeTable("TGFPRO", { config, fetch: fetcher });
    expect(out?.fields).toEqual({
      columns: ["NOMECAMPO"],
      rows: [{ NOMECAMPO: "CODPROD" }],
    });
    expect(out?.links).toEqual({ error: "ORA-00904: invalid identifier" });
    expect(await dict.describeTable("x'--")).toBeNull();
  });
});
