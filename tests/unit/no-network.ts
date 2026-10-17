/*
 * Testes unitários não dependem da internet. Uma chamada externa sem
 * `fetcher` injetado (câmbio do dia, IA, prévia de link) falha na hora, como
 * sem rede. Antes, o câmbio do dia esperava os serviços reais (PTAX, AwesomeAPI,
 * BCE, até 5 s cada) e às vezes estourava o tempo do teste no CI. Quem precisa
 * de resposta injeta o próprio fetcher (ou usa vi.stubGlobal("fetch", ...)).
 */
const offline: typeof fetch = async (input) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  throw new TypeError(`fetch failed (sem rede nos testes unitários): ${url}`);
};

globalThis.fetch = offline;
