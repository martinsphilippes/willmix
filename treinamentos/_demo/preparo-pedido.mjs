// Passos da solicitação ao fornecedor até o embarque, feitos pela tela (Playwright), para o
// preparo de dados da trilha do Fornecedor (`caminho-fornecedor.mjs`). Tudo fictício, modo
// memória. Cada função age como um usuário: abre a tela, preenche e clica. Quando o portal
// recusa (volta com ?error=...), a função para com o texto que apareceu, sem contornar.
import fs from "node:fs";
import path from "node:path";
import { BASE, DEMO } from "../_pipeline/lib.mjs";

/** Arquivos fictícios enviados nos vídeos (`_demo/arquivos/`). */
export const PASTA_ARQUIVOS = path.join(DEMO, "arquivos");

/** Caminho de um arquivo de `_demo/arquivos/` (para se o arquivo não existir). */
export function arquivo(nome) {
  const caminho = path.join(PASTA_ARQUIVOS, nome);
  if (!fs.existsSync(caminho)) throw new Error(`arquivo de demonstração inexistente: ${caminho}`);
  return caminho;
}

// ------------------------------------------------------------------- datas --

/** Data (AAAA-MM-DD) daqui a `dias`, no dia civil de Brasília (o que o usuário vê na tela). */
export function dataEmDias(dias = 0) {
  const d = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** Número como se digita no portal em português: vírgula no decimal. */
export const numeroPt = (valor) => String(valor).replace(".", ",");

// ------------------------------------------------------------- utilitários --

const semBusca = (url) => url.split(/[?#]/)[0];
const temErro = (url) => new URL(url).searchParams.has("error");

/** Texto do aviso de erro da tela (para o relatório). */
async function avisoDaTela(page) {
  const alertas = await page.locator('main [role="alert"]').allInnerTexts().catch(() => []);
  if (alertas.length) return alertas.join(" | ");
  return (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
}

/** O portal voltou com ?error=...? Para aqui, com o que apareceu na tela. */
export async function pararSeErro(page, oque) {
  if (!temErro(page.url())) return;
  throw new Error(`${oque}: o portal recusou (${new URL(page.url()).searchParams.get("error")}) em ${page.url()}\n  na tela: ${await avisoDaTela(page)}`);
}

/**
 * Faz a ação e espera a tela voltar com o aviso esperado (`ok`, expressão sobre o endereço).
 * Se voltar com ?error=..., para com o texto da tela.
 */
export async function concluir(page, ok, oque, acao) {
  await Promise.all([
    page.waitForURL((u) => ok.test(u.href) || u.searchParams.has("error"), { timeout: 45_000 }),
    acao(),
  ]).catch(async (erro) => {
    throw new Error(`${oque}: a tela não chegou a ${ok} (ficou em ${page.url()})\n  na tela: ${await avisoDaTela(page)}\n  ${erro.message.split("\n")[0]}`);
  });
  if (!ok.test(page.url())) await pararSeErro(page, oque);
}

/** Abre um endereço do portal e confere que abriu (não 404 nem acesso negado). */
export async function abrir(page, url) {
  const destino = url.startsWith("http") ? url : `${BASE}${url}`;
  const resposta = await page.goto(destino);
  if (resposta && resposta.status() >= 400) throw new Error(`a tela ${destino} respondeu ${resposta.status()}`);
  if (/[?&]denied=/.test(page.url())) throw new Error(`acesso negado a ${destino} (caiu em ${page.url()})`);
  await page.waitForLoadState("networkidle").catch(() => {});
}

// -------------------------------------------------- pendências e endereços --

/** Linhas da tabela de pendências de quem está logado (texto de cada `main table tbody tr`). */
export async function linhasDePendencias(page) {
  await abrir(page, "/app");
  // Texto como aparece na tela (quebras de linha da célula viram " · "); linha escondida pela
  // paginação da tabela não tem texto na tela e cai no texto do documento.
  // No fim de cada linha, para onde o "Abrir" leva.
  return page.locator("main table tbody tr").evaluateAll((linhas) =>
    linhas.map((tr) => [...tr.querySelectorAll("td")]
      .map((td) => (td.innerText.trim() || td.textContent).split(/\n+/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · "))
      .filter(Boolean).join(" | ") + (tr.querySelector("a[href]") ? ` → ${tr.querySelector("a[href]").getAttribute("href")}` : "")));
}

/** Endereços das solicitações (por número) e dos pedidos que o usuário logado enxerga. */
export async function enderecos(page) {
  await abrir(page, "/app/supplier-requests");
  const solicitacoes = Object.fromEntries(await page.locator("[data-supplier-request-row]").evaluateAll((linhas) =>
    linhas.map((tr) => { const a = tr.querySelector("td a"); return [a.textContent.trim(), a.getAttribute("href")]; })));
  await abrir(page, "/app/orders");
  const pedidos = await page.locator('main a[href^="/app/orders/"]').evaluateAll((links) =>
    [...new Set(links.map((a) => a.getAttribute("href").match(/^\/app\/orders\/[^/?#]+/)?.[0]).filter(Boolean))]);
  return { solicitacoes, pedidos };
}

// ------------------------------------------------ solicitação ao fornecedor --

/** Lista de solicitações → clica no número. Fica na tabela dos produtos; devolve o endereço. */
export async function abrirSolicitacaoNumero(page, numero) {
  await abrir(page, "/app/supplier-requests");
  const link = page.locator("[data-supplier-request-row] td:first-child a", { hasText: new RegExp(`^\\s*${numero}\\s*$`) });
  if ((await link.count()) !== 1) throw new Error(`solicitação nº ${numero}: esperava 1 linha na lista, achei ${await link.count()}`);
  await Promise.all([page.waitForURL(/\/app\/supplier-requests\/[^/?]+$/), link.click()]);
  await page.locator("[data-supplier-table-row]").first().waitFor();
  return semBusca(page.url());
}

/** Da tabela, o ícone "Abrir produto": a tela completa do produto da solicitação. */
export async function abrirProdutoDaSolicitacao(page, numero) {
  const url = await abrirSolicitacaoNumero(page, numero);
  await Promise.all([page.waitForURL(/[?&]view=item/), page.locator("[data-supplier-table-open]").first().click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  return url;
}

/** Fornecedor: cartão "Resposta do fornecedor" na tela do produto (com o prazo de produção). */
export async function responderPelaTelaDoProduto(page, numero, { faz = true, preco, moeda = null, moq, prazoDias, entrega, obs }) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  const form = page.locator("[data-supplier-answer-form]");
  await form.locator("[data-supplier-answer-cando]").selectOption(faz ? "yes" : "no");
  if (preco != null) await form.locator("[data-supplier-answer-price]").fill(numeroPt(preco));
  if (moeda) await form.locator('select[name="currency"]').selectOption(moeda);
  if (moq != null) await form.locator('input[name="moq"]').fill(String(moq));
  if (prazoDias != null) await form.locator('input[name="leadTimeDays"]').fill(String(prazoDias));
  if (entrega) await form.locator("[data-supplier-answer-incoterm]").selectOption(entrega);
  if (obs != null) await form.locator('textarea[name="note"]').fill(obs);
  await concluir(page, /[?&]answered=1/, `resposta da solicitação nº ${numero}`, () => form.locator("[data-supplier-answer-submit]").click());
  return url;
}

/** Conversa da solicitação (ícone flutuante na tela do produto): mensagem com ou sem arquivo. */
export async function mandarMensagemNaConversa(page, numero, texto, arquivoNome = null) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  await page.click("[data-request-chat-toggle]");
  const chat = page.locator("[data-request-chat]");
  const antes = await chat.locator("[data-request-chat-message]").count();
  await chat.locator("[data-negotiation-message-text]").fill(texto);
  if (arquivoNome) await chat.locator("[data-negotiation-message-file]").setInputFiles(arquivo(arquivoNome));
  await concluir(page, /[?&]negotiation=message/, `mensagem na solicitação nº ${numero}`, () => chat.locator("[data-negotiation-message-submit]").click());
  // A conversa reabre sozinha com a mensagem nova (e o arquivo, quando há).
  await chat.locator("[data-request-chat-message]").nth(antes).waitFor();
  if (arquivoNome) await chat.locator("[data-negotiation-file]", { hasText: arquivoNome }).first().waitFor();
  return url;
}

/** Fornecedor, na tabela: ícone ✓ "Aprovar oferta" (confirma na caixa). */
export async function aprovarOfertaNaTabela(page, numero) {
  const url = await abrirSolicitacaoNumero(page, numero);
  await page.locator("[data-supplier-table-confirm]").first().click();
  await concluir(page, /[?&]offer=confirmed/, `aprovar a oferta da solicitação nº ${numero}`,
    () => page.locator("dialog[open] [data-supplier-table-confirm-submit]").click());
  return url;
}

/** Fornecedor, na tabela: ícone ✕ "Recusar oferta" (confirma na caixa). */
export async function recusarOfertaNaTabela(page, numero) {
  const url = await abrirSolicitacaoNumero(page, numero);
  await page.locator("[data-supplier-table-refuse]").first().click();
  await concluir(page, /[?&]offer=refused/, `recusar a oferta da solicitação nº ${numero}`,
    () => page.locator("dialog[open] [data-supplier-table-refuse-submit]").click());
  return url;
}

/** Wellmix: "Devolver com contraproposta" na tela do produto (comentário obrigatório). */
export async function devolverComContraproposta(page, numero, { preco, moq, prazoDias, entrega, comentario }) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  const form = page.locator("[data-negotiation-propose-form]");
  await form.locator("[data-negotiation-price]").fill(numeroPt(preco));
  if (moq != null) await form.locator("[data-negotiation-moq]").fill(String(moq));
  if (prazoDias != null) await form.locator("[data-negotiation-lead-time]").fill(String(prazoDias));
  if (entrega) await form.locator("[data-negotiation-incoterm]").selectOption(entrega);
  await form.locator("[data-negotiation-text]").fill(comentario);
  await concluir(page, /[?&]negotiation=proposal/, `contraproposta da solicitação nº ${numero}`, () => page.click("[data-negotiation-propose-submit]"));
  return url;
}

/** Fornecedor: "Aceitar" a contraproposta, na tela do produto. */
export async function aceitarContraproposta(page, numero) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  await concluir(page, /[?&]negotiation=accept/, `aceitar a contraproposta da solicitação nº ${numero}`, () => page.click("[data-negotiation-respond=accept]"));
  return url;
}

/** Wellmix: aprova a solicitação respondida (abre a amostragem para o fornecedor). */
export async function aprovarSolicitacao(page, numero) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  await concluir(page, /[?&]decided=approved/, `aprovar a solicitação nº ${numero}`, () => page.click("[data-supplier-decide=approved]"));
  await page.locator("[data-sampling=pending]").waitFor();
  return url;
}

// --------------------------------------------------------------- amostragem --

/** Fornecedor: sobe os arquivos da rodada (um por vez) e envia para a validação. */
export async function enviarAmostragem(page, numero, arquivos, obs = null) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  const cartao = page.locator("#amostragem");
  for (const nome of arquivos) {
    // Só os arquivos da rodada em curso (os das rodadas anteriores ficam recolhidos em <details>).
    const daRodada = cartao.locator("[data-sampling-file]:not(details [data-sampling-file])");
    const antes = await daRodada.count();
    await concluir(page, /[?&]sampling=file/, `arquivo ${nome} na amostragem da nº ${numero}`,
      () => page.locator("[data-sampling-upload] input[type=file]").setInputFiles(arquivo(nome)));
    await daRodada.nth(antes).waitFor();
    await abrir(page, `${url}?view=item`); // endereço limpo antes do próximo arquivo
  }
  if (obs) await page.locator('[data-sampling-submit-form] textarea[name="note"]').fill(obs);
  await concluir(page, /[?&]sampling=submitted/, `enviar a amostragem da nº ${numero}`, () => page.click("[data-sampling-submit]"));
  await page.locator("[data-sampling=submitted]").waitFor();
  return url;
}

/** Wellmix: aprova a amostra, ou reprova com o motivo. */
export async function validarAmostragem(page, numero, { aprova, motivo = null }) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  const form = page.locator("[data-sampling-review-form]");
  if ((await form.count()) === 0)
    throw new Error(`amostragem da nº ${numero}: este login não tem o formulário de validar (na tela: ${await page.locator("#amostragem").innerText().catch(() => "sem cartão Amostragem")})`);
  if (motivo) await form.locator('textarea[name="note"]').fill(motivo);
  await concluir(page, aprova ? /[?&]sampling=approved/ : /[?&]sampling=rejected/, `${aprova ? "aprovar" : "reprovar"} a amostra da nº ${numero}`,
    () => form.locator(`[data-sampling-review=${aprova ? "approve" : "reject"}]`).click());
  await page.locator(`[data-sampling=${aprova ? "approved" : "rejected"}]`).waitFor();
  return url;
}

// ------------------------------------------------------ seleção de itens --

/**
 * Seleção de itens: esvazia a cesta ("Limpar"). A cesta fica guardada na aba do navegador e
 * não esvazia sozinha depois de "Agrupar" nem ao trocar de login: sem isto, o grupo seguinte
 * leva junto os itens do grupo anterior (que viram alternativas da nova solicitação).
 */
export async function esvaziarCesta(page) {
  await abrir(page, "/app/booking/selection");
  // Quantos itens a cesta guarda nesta aba (só leitura: decide se há o que limpar).
  const naCesta = () => page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem("wm.selection.basket") ?? "[]").length; } catch { return 0; } });
  const antes = await naCesta();
  if (!antes) return 0;
  // A barra da cesta aparece quando a tela fica pronta; "Limpar" é o botão dela.
  await page.locator("[data-selection-basket-clear]").click();
  await page.locator("[data-selection-basket]").waitFor({ state: "detached" });
  if (await naCesta()) throw new Error("Seleção de itens: a cesta não esvaziou com o Limpar");
  return antes;
}

// ------------------------------------------------- produto e pedido de compra --

/**
 * Wellmix: cria o produto da solicitação aprovada (amostra aprovada). Confere antes as
 * condições combinadas que a tela mostra. Devolve o endereço do produto.
 */
export async function criarProdutoDaSolicitacao(page, numero, { nome = null, linha, condicoes = [] }) {
  const url = await abrirProdutoDaSolicitacao(page, numero);
  const cartao = page.locator("[data-request-product]");
  await cartao.locator("[data-request-product-form]").waitFor();
  const combinado = (await cartao.locator("[data-request-product-deal]").innerText()).replace(/\s+/g, " ");
  for (const trecho of condicoes)
    if (!combinado.includes(trecho)) throw new Error(`produto da nº ${numero}: as condições combinadas na tela são "${combinado}" (esperava conter "${trecho}")`);
  // Itens de book ligados ao produto: o escolhido e as alternativas do grupo comparado (já marcadas).
  const ligados = await cartao.locator("[data-request-product-form] li:has([data-request-product-item])").evaluateAll((linhas) =>
    linhas.map((li) => `${li.querySelector("input[type=checkbox]").checked ? "[x]" : "[ ]"} ${li.innerText.replace(/\s+/g, " ").trim()}`));
  if (nome) await cartao.locator("[data-request-product-name]").fill(nome);
  await cartao.locator("[data-request-product-line]").selectOption(linha);
  await concluir(page, /[?&]product=created/, `criar o produto da solicitação nº ${numero}`, () => cartao.locator("[data-request-product-create]").click());
  const produto = await page.locator("[data-request-product-open]").getAttribute("href");
  return { solicitacao: url, produto, combinado, ligados };
}

/**
 * Wellmix: gera o pedido de compra só com as solicitações de `numeros` (as outras candidatas do
 * mesmo fornecedor ficam desmarcadas). `confere` são trechos que a linha da candidata tem de
 * mostrar (preço, MOQ, prazo). Devolve o endereço e o número do pedido.
 */
export async function gerarPedidoDeCompra(page, numeros, { confere = {}, quantidades = {} } = {}) {
  await abrir(page, "/app/supplier-requests");
  const linhaDe = (n) => page.locator("[data-purchase-candidate]").filter({ has: page.locator("td:nth-child(2)", { hasText: new RegExp(`^\\s*${n}\\s*$`) }) });
  if ((await linhaDe(numeros[0]).count()) !== 1)
    throw new Error(`pedido de compra: a solicitação nº ${numeros[0]} não está entre as candidatas (na tela: ${(await page.locator("[data-purchase-candidate]").allInnerTexts()).join(" / ") || "nenhuma candidata"})`);
  const grupo = page.locator("form[data-purchase-group]").filter({ has: linhaDe(numeros[0]) });
  const candidatas = grupo.locator("[data-purchase-candidate]");
  const marcadas = [];
  for (let i = 0; i < (await candidatas.count()); i++) {
    const linha = candidatas.nth(i);
    const n = (await linha.locator("td:nth-child(2)").innerText()).trim();
    const caixa = linha.locator("input[type=checkbox]");
    if (numeros.map(String).includes(n)) {
      await caixa.check();
      const texto = (await linha.innerText()).replace(/\s+/g, " ");
      for (const trecho of confere[n] ?? [])
        if (!texto.includes(trecho)) throw new Error(`pedido de compra: a linha da nº ${n} mostra "${texto}" (esperava conter "${trecho}")`);
      const qtd = linha.locator("[data-purchase-qty]");
      if (quantidades[n] != null) {
        if ((await qtd.inputValue()) !== String(quantidades[n])) await qtd.fill(String(quantidades[n]));
      }
      marcadas.push(`nº ${n}: ${texto} · quantidade ${await qtd.inputValue().catch(() => "?")}`);
    } else await caixa.uncheck();
  }
  await concluir(page, /\/app\/orders\/[^/?]+\?purchase=created/, "gerar o pedido de compra", () => grupo.locator("[data-purchase-submit]").click());
  const url = semBusca(page.url());
  const numero = (await page.getByText(/Pedido #\d+/).first().textContent())?.match(/#(\d+)/)?.[1] ?? null;
  return { url, numero, marcadas };
}

/**
 * Wellmix, "Parceiros do pedido": designa quem ainda não está designado (o pedido só designa
 * sozinho o tipo que tem exatamente um cadastro ativo). `escolhas` = { tipo: "Nome do cadastro" }
 * troca ou define um tipo específico. Devolve a tabela como ficou.
 */
export async function designarParceiros(page, pedidoUrl, escolhas = {}) {
  await abrir(page, pedidoUrl);
  const tipos = await page.locator("[data-order-partner]").evaluateAll((linhas) => linhas.map((tr) => tr.getAttribute("data-order-partner")));
  for (const tipo of tipos) {
    const linha = page.locator(`[data-order-partner="${tipo}"]`);
    const atual = (await linha.locator("td").nth(1).innerText()).trim();
    const opcoes = await linha.locator("select option").evaluateAll((os) => os.map((o) => ({ valor: o.value, nome: o.textContent.trim() })).filter((o) => o.valor));
    const querido = escolhas[tipo] ?? (atual === "—" && opcoes.length ? opcoes[0].nome : null);
    if (!querido || querido === atual) continue;
    await linha.locator("select").selectOption({ label: querido });
    await linha.locator("button[type=submit]").click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await pararSeErro(page, `designar ${tipo}`);
    await abrir(page, pedidoUrl);
    const ficou = (await page.locator(`[data-order-partner="${tipo}"] td`).nth(1).innerText()).trim();
    if (ficou !== querido) throw new Error(`parceiros do pedido: ${tipo} ficou "${ficou}" (pedi "${querido}")`);
  }
  return page.locator("[data-order-partner]").evaluateAll((linhas) =>
    Object.fromEntries(linhas.map((tr) => [tr.querySelector("td").textContent.trim(), tr.querySelectorAll("td")[1].textContent.trim()])));
}

/** Lista Pedidos de quem está logado → endereço do detalhe do único pedido (`/app/orders/<id>`). */
export async function pedidoUnico(page) {
  const { pedidos } = await enderecos(page);
  if (pedidos.length !== 1) throw new Error(`esperava 1 pedido na lista, achei ${pedidos.length}: ${pedidos.join(", ")}`);
  return `${BASE}${pedidos[0]}`;
}

// ------------------------------------------------------------------ Die Cut --

/**
 * Fornecedor: quadro Die Cut do pedido (botão "Abrir o Die Cut"): faca, foto em alta e a
 * confirmação do pedido mínimo e do prazo. Confere que os campos vêm com o negociado.
 */
export async function fazerDieCut(page, pedidoUrl, { faca, fotoAlta, moq, prazoDias }) {
  await abrir(page, pedidoUrl);
  await Promise.all([page.waitForURL(/\/die-cut/), page.locator("[data-die-cut-link] a").first().click()]);
  const quadro = page.locator("[data-die-cut-product]");
  if ((await quadro.count()) !== 1) throw new Error(`Die Cut: esperava 1 produto no quadro, achei ${await quadro.count()}`);
  for (const [item, nome] of [["dieline", faca], ["hd", fotoAlta]]) {
    await concluir(page, new RegExp(`[?&]saved=${item}`), `Die Cut: enviar ${nome}`,
      () => quadro.locator(`[data-die-cut-item="${item}"] input[type=file]`).last().setInputFiles(arquivo(nome)));
    await quadro.locator(`[data-die-cut-item="${item}"][data-done="yes"]`).waitFor();
  }
  const termos = quadro.locator('[data-die-cut-item="terms"] [data-die-cut-terms]');
  const veio = { moq: await termos.locator("input[name=moq]").inputValue(), prazoDias: await termos.locator("input[name=leadTimeDays]").inputValue() };
  if (veio.moq !== String(moq) || veio.prazoDias !== String(prazoDias))
    console.log(`  Die Cut: os campos vieram com ${veio.moq} peças e ${veio.prazoDias} dias (o negociado era ${moq} e ${prazoDias}); corrigindo na tela`);
  await termos.locator("input[name=moq]").fill(String(moq));
  await termos.locator("input[name=leadTimeDays]").fill(String(prazoDias));
  await concluir(page, /[?&]saved=terms/, "Die Cut: confirmar pedido mínimo e prazo", () => termos.locator("button[type=submit]").click());
  await page.locator('[data-die-cut-product][data-complete="yes"]').waitFor();
  return { veio, confirmado: (await quadro.locator("[data-die-cut-terms-values]").innerText()).trim() };
}

// --------------------------------------------------- itens das etapas do pedido --

/** Linha (li) de um item da etapa pelo rótulo, na tela do pedido. */
export const itemDaEtapa = (page, rotulo) =>
  page.locator("main li", { has: page.locator("span.font-medium", { hasText: rotulo }) });

/** Situação que a tela mostra para um item da etapa ("Pendente", "Concluído"...). */
export async function situacaoDoItem(page, pedidoUrl, rotulo) {
  await abrir(page, pedidoUrl);
  const linha = itemDaEtapa(page, rotulo).first();
  if (!(await linha.count())) return null;
  return (await linha.innerText()).replace(/\s+/g, " ").trim();
}

/**
 * Preenche, um por vez, os itens pendentes que o login atual pode preencher na tela do pedido.
 * `responde(rotulo)` diz o que mandar: `{ arquivo }`, `{ valor }`, `{ confirma: true }` ou `null`
 * (não mexe nesse item). Item marcado "(opcional)" só entra com `opcionais: true`.
 * Devolve os rótulos preenchidos, na ordem.
 */
export async function preencherItensDoPedido(page, pedidoUrl, responde, { opcionais = false, limite = 30 } = {}) {
  const feitos = [];
  const pulados = new Set();
  for (let volta = 0; volta < limite; volta++) {
    await abrir(page, pedidoUrl);
    const forms = page.locator("main form:has(input[name=requirementId]):not([data-requirement-clear])");
    let alvo = null;
    for (let i = 0; i < (await forms.count()); i++) {
      const linha = forms.nth(i).locator("xpath=ancestor::li[1]");
      const rotulo = ((await linha.locator("span.font-medium").first().textContent()) ?? "").trim();
      if (pulados.has(rotulo)) continue;
      const opcional = /\((opcional|optional|可选)\)/.test(await linha.innerText());
      const resposta = opcional && !opcionais ? null : responde(rotulo);
      if (!resposta) { pulados.add(rotulo); continue; }
      alvo = { linha, rotulo, resposta };
      break;
    }
    if (!alvo) return { feitos, pulados: [...pulados] };
    const { linha, rotulo, resposta } = alvo;
    if (feitos.at(-1) === rotulo && feitos.at(-2) === rotulo)
      throw new Error(`item "${rotulo}": continua pendente depois de dois envios (na tela: ${(await linha.innerText()).replace(/\s+/g, " ")})`);
    if (resposta.arquivo) {
      const campos = linha.locator("input[type=file]");
      if (!(await campos.count())) throw new Error(`item "${rotulo}": a tela não tem campo de arquivo`);
      // Foto: botão "Tirar ou escolher foto" (o primeiro). Outro arquivo (PDF, vídeo): "Escolher arquivo".
      const foto = /\.(jpe?g|png|webp)$/i.test(resposta.arquivo);
      const campo = foto ? campos.first() : campos.last();
      if (!foto && ((await campo.getAttribute("accept")) ?? "").startsWith("image/"))
        throw new Error(`item "${rotulo}": só aceita foto e o arquivo é ${resposta.arquivo}`);
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/"), { timeout: 60_000 }),
        campo.setInputFiles(arquivo(resposta.arquivo)),
      ]);
    } else {
      const form = linha.locator("form:has(input[name=requirementId]):not([data-requirement-clear])").first();
      if (resposta.valor != null) {
        const campo = form.locator('input[name="value"]:not([type=hidden]), textarea[name="value"]').first();
        if (!(await campo.count())) throw new Error(`item "${rotulo}": a tela não tem campo de valor`);
        await campo.fill(String(resposta.valor));
      }
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/"), { timeout: 60_000 }),
        form.locator("button[type=submit]").first().click(),
      ]);
    }
    await page.waitForLoadState("networkidle").catch(() => {});
    await pararSeErro(page, `item "${rotulo}"`);
    // A linha deixa de ter o formulário quando o envio foi gravado (se não deixar, a próxima
    // volta reabre a tela e tenta de novo; na terceira, para com o que a tela mostra).
    const exato = new RegExp(`^\\s*${rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
    await itemDaEtapa(page, exato).first().locator("form:has(input[name=requirementId]):not([data-requirement-clear])").first()
      .waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
    feitos.push(rotulo);
  }
  throw new Error(`itens do pedido: passou de ${limite} envios sem terminar (feitos: ${feitos.join(", ")})`);
}

// ------------------------------------------------- cadastro e fiscal (Wellmix) --

/** Wellmix: valida o NCM do produto (atalho "Validar o NCM do produto" do pedido). */
export async function validarNcmDoProduto(page, pedidoUrl, ncm) {
  await abrir(page, pedidoUrl);
  const atalho = page.locator("[data-requirement-gate=ncm_validated]").first();
  if (!(await atalho.count())) return { feito: false, motivo: "sem o atalho (já validado)" };
  const fiscal = await atalho.getAttribute("href");
  await abrir(page, fiscal);
  const validar = page.locator("form[data-tax-validate] button[type=submit]");
  if (!(await validar.count())) {
    const nova = page.locator("form[data-tax-add]");
    await nova.locator("input[name=ncm]").fill(ncm);
    await Promise.all([page.waitForLoadState("networkidle"), nova.locator("button[type=submit]").click()]);
    await pararSeErro(page, "adicionar a candidata de NCM");
    await abrir(page, fiscal);
  }
  await Promise.all([page.waitForLoadState("networkidle"), validar.first().click()]);
  await pararSeErro(page, "validar o NCM");
  return { feito: true, fiscal, produto: fiscal.replace(/\/tax$/, "") };
}

/** Wellmix: completa a ficha mestre do produto (as cinco fotos obrigatórias e a cor). */
export async function completarFichaMestre(page, produtoUrl, { fotos, cor }) {
  const abrirFicha = async () => {
    await abrir(page, produtoUrl);
    // As seções vêm recolhidas: abre todas (como quem toca em cada uma).
    await page.locator("details[data-fold-section], #product-form details[data-fold-card]").evaluateAll((els) => els.forEach((el) => { el.open = true; }));
  };
  for (const [tipo, nome] of Object.entries(fotos)) {
    await abrirFicha();
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400, { timeout: 60_000 }),
      page.locator(`[data-sheet-photo="${tipo}"] input[type=file]`).first().setInputFiles(arquivo(nome)),
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});
    await pararSeErro(page, `foto ${tipo} da ficha mestre`);
  }
  await abrirFicha();
  await page.locator("#product-form input[name=color]").fill(cor);
  await concluir(page, /[?&]saved=1/, "salvar a ficha do produto", () => page.locator("#product-form button[type=submit]").last().click());
}

// --------------------------------------------------------- raia da arte (Wellmix) --

/** Wellmix: aprova a arte enviada (item "Validação da arte pela Wellmix" do pedido). */
export async function validarArte(page, pedidoUrl) {
  await abrir(page, pedidoUrl);
  const linha = itemDaEtapa(page, /Validação da arte pela Wellmix/).first();
  const aprovar = linha.locator("button[value=approve]");
  if (!(await aprovar.count())) throw new Error(`validação da arte: sem o botão de aprovar (na tela: ${(await linha.innerText().catch(() => "sem a linha")).replace(/\s+/g, " ")})`);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), aprovar.click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await pararSeErro(page, "validar a arte");
}

// ------------------------------------------------- certificação (certificadora) --

/**
 * Certificadora (OCP): os documentos do quadro do alto do cartão Certificação (memorial e selo).
 * `documentos` = { cert_memorial: { arquivo }, cert_seal: { arquivo, valor } }.
 */
export async function enviarDocumentosDaCertificacao(page, pedidoUrl, documentos) {
  const enviados = [];
  for (const [chave, doc] of Object.entries(documentos)) {
    await abrir(page, `${pedidoUrl}#certification`);
    const quadro = page.locator(`[data-import-featured="${chave}"]`);
    if (!(await quadro.count())) { enviados.push(`${chave}: o cartão Certificação não tem este documento`); continue; }
    if ((await quadro.getAttribute("data-import-featured-state")) === "sent") { enviados.push(`${chave}: já enviado`); continue; }
    if (doc.valor != null && (await quadro.locator("input[name=value]").count())) await quadro.locator("input[name=value]").fill(doc.valor);
    await quadro.locator("input[type=file]").setInputFiles(arquivo(doc.arquivo));
    await concluir(page, /[?&]certStep=submitted/, `certificação: enviar ${chave}`, () => quadro.locator(`[data-import-submit="${chave}"]`).click());
    enviados.push(`${chave}: ${doc.arquivo}${doc.valor ? ` · ${doc.valor}` : ""}`);
  }
  return enviados;
}

// --------------------------------------------- pedido de amostras e contrato --

/** Wellmix: gera o pedido de amostras (antes de assinar o contrato). Devolve o total de peças. */
export async function gerarPedidoDeAmostras(page, pedidoUrl) {
  await abrir(page, `${pedidoUrl}/samples`);
  const total = (await page.locator("[data-sample-total]").innerText()).trim();
  await concluir(page, /[?&]decided=ordered/, "gerar o pedido de amostras", () => page.locator("form[data-sample-order-create] button[type=submit]").click());
  await page.locator("[data-sample-order-status=sent]").waitFor();
  return total;
}

/** Fornecedor: aceita o pedido de amostras (nome completo e o "li e concordo"). */
export async function aceitarPedidoDeAmostras(page, pedidoUrl, nome) {
  await abrir(page, `${pedidoUrl}/samples`);
  const form = page.locator("form[data-sample-order-accept]");
  await form.locator("input[name=name]").fill(nome);
  await form.locator("input[name=agree]").check();
  await concluir(page, /[?&]accepted=1/, "aceitar o pedido de amostras", () => form.locator("button[type=submit]").click());
  await page.locator("[data-sample-order-status=accepted]").waitFor();
}

/**
 * Contrato (documento do pedido): quem está na vez sobe o arquivo assinado e carimbado.
 * Escolher o arquivo já registra a assinatura. `lado` = "wellmix" ou "supplier".
 */
export async function assinarContrato(page, pedidoUrl, lado, { nome = null, arquivo: nomeArquivo }) {
  await abrir(page, `${pedidoUrl}/purchase-order`);
  const vez = page.locator("[data-order-sign-turn]");
  if (!(await vez.count()))
    throw new Error(`contrato: não é a vez de ninguém assinar nesta tela (${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 500)})`);
  if ((await vez.getAttribute("data-order-sign-turn")) !== lado) throw new Error(`contrato: a vez é de "${await vez.getAttribute("data-order-sign-turn")}", não de "${lado}"`);
  const form = page.locator("[data-order-sign-file]");
  if (nome) await form.locator("input[name=name]").fill(nome);
  await concluir(page, /[?&]signed=1/, `contrato: assinatura (${lado})`, () => form.locator("input[type=file]").setInputFiles(arquivo(nomeArquivo)));
  await page.locator(`[data-order-signature=${lado}][data-signed=yes]`).waitFor();
  return (await page.locator("[data-order-document-status]").getAttribute("data-order-document-status"));
}

// ------------------------------------------------------ pagamento do sinal --

/**
 * Wellmix (financeiro: só o administrador): registra o pagamento da parcela que venceu com o
 * botão "Copiar dados para o banco", como no E2E. A parcela fica "solicitada".
 */
export async function registrarPagamentoDoSinal(page, pedidoUrl) {
  await abrir(page, pedidoUrl);
  const condicao = (await page.locator("[data-terms-text]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  await concluir(page, /[?&]paid=transfer_copied/, "registrar o pagamento do sinal", () => page.getByRole("button", { name: /Copiar dados para o banco/ }).click());
  const parcela = page.locator('[data-installment="1"]');
  await parcela.waitFor();
  return { condicao, situacao: await parcela.getAttribute("data-status") };
}

/** Fornecedor, Conta corrente: "Confirmar recebimento" do pagamento do pedido. */
export async function confirmarRecebimento(page, numeroPedido) {
  await abrir(page, "/app/account");
  const linha = page.locator("main tr", { has: page.locator("td", { hasText: new RegExp(`^#${numeroPedido}$`) }) })
    .filter({ has: page.getByRole("button", { name: /Confirmar recebimento/ }) });
  if ((await linha.count()) !== 1) throw new Error(`Conta corrente: esperava 1 pagamento do pedido #${numeroPedido} por confirmar, achei ${await linha.count()}`);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), linha.getByRole("button", { name: /Confirmar recebimento/ }).click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await pararSeErro(page, "confirmar o recebimento");
  await abrir(page, "/app/account");
  if (await page.locator("main tr", { has: page.locator("td", { hasText: new RegExp(`^#${numeroPedido}$`) }) }).getByRole("button", { name: /Confirmar recebimento/ }).count())
    throw new Error(`Conta corrente: o pagamento do pedido #${numeroPedido} continua por confirmar`);
}

/** Número do pedido (o "#N" do título) a partir do endereço do detalhe. */
export async function numeroDoPedido(page, pedidoUrl) {
  await abrir(page, pedidoUrl);
  const n = (await page.getByText(/Pedido #\d+/).first().textContent())?.match(/#(\d+)/)?.[1];
  if (!n) throw new Error(`não achei o número do pedido em ${pedidoUrl}`);
  return n;
}

// ------------------------------------------------------ produção e inspeção --

/**
 * Fornecedor: cartão Produção do pedido. `tipo` = "factory" (Fábrica) ou "trade". O início da
 * produção só é digitado quando o campo está aberto (no pedido de compra ele é automático: o
 * dia do contrato assinado). Devolve o que a tela mostrava e o que ficou.
 */
export async function salvarProducao(page, pedidoUrl, { tipo, inicio = null, etd, motivoEtd = null }) {
  await abrir(page, `${pedidoUrl}#production`);
  const linha = page.locator("[data-production-plan]");
  const campoInicio = linha.locator('input[name="productionStartAt"]');
  const inicioAutomatico = await campoInicio.isDisabled();
  const antes = { inicio: await campoInicio.inputValue(), inicioAutomatico, etd: await linha.locator("[data-production-etd]").inputValue(),
    fabrica: await linha.locator("[data-production-factory]").inputValue() };
  await linha.locator('select[name="mode"]').selectOption(tipo);
  if (inicio && !inicioAutomatico) await campoInicio.fill(inicio);
  await linha.locator("[data-production-etd]").fill(etd);
  if (motivoEtd && (await linha.locator('input[name="etdReason"]').count())) await linha.locator('input[name="etdReason"]').fill(motivoEtd);
  await concluir(page, /[?&]production=saved/, "salvar a produção", () => linha.locator("[data-production-save]").click());
  const depois = page.locator("[data-production-plan]");
  return { antes, depois: { tipo: await depois.locator('select[name="mode"]').inputValue(), inicio: await depois.locator('input[name="productionStartAt"]').inputValue(),
    etd: await depois.locator("[data-production-etd]").inputValue() } };
}

/**
 * Wellmix: resultado da inspeção do SKU na tela do passo Produção → Inspeção (como no E2E).
 * `resultado` = "approved" ou "rejected" (reprovar pede a observação).
 */
export async function inspecionarSku(page, pedidoUrl, resultado, observacao = null) {
  const id = semBusca(pedidoUrl).split("/").pop();
  await abrir(page, "/app/flow/production/inspection");
  const cartao = page.locator(`[data-flow-production-order="${id}"]`);
  if (!(await cartao.count())) throw new Error(`Produção → Inspeção: o pedido ${id} não aparece no passo (na tela: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400)})`);
  const sku = cartao.locator("[data-sku-item]").first();
  const antes = await sku.getAttribute("data-sku-status");
  const botao = sku.locator(resultado === "approved" ? "[data-sku-approve]" : "[data-sku-reject]");
  if (!(await botao.count())) throw new Error(`inspeção do SKU: sem o botão (situação "${antes}", na tela: ${(await sku.innerText()).replace(/\s+/g, " ")})`);
  if (observacao) await sku.locator('input[name="note"]').fill(observacao);
  await concluir(page, /[?&]production=inspected/, `inspeção do SKU (${resultado})`, () => botao.click());
  await abrir(page, pedidoUrl);
  const depois = await page.locator("[data-sku-item]").first().getAttribute("data-sku-status");
  if (depois !== resultado) throw new Error(`inspeção do SKU: ficou "${depois}" (esperava "${resultado}")`);
  return { antes, depois };
}

// ------------------------- passos dos cartões (amostras, container, embarque) --

/** Texto da linha de um passo do cartão (situação, quem faz, informado). */
async function linhaDoPasso(page, ancora, chave) {
  const linha = page.locator(`#${ancora}-step-${chave}`);
  if (!(await linha.count())) return null;
  return { situacao: await linha.getAttribute("data-import-status"), texto: (await linha.innerText()).replace(/\s+/g, " ").trim() };
}

/**
 * Envia um passo de um cartão do pedido (`ancora`: "samples-flow", "container-origin" ou
 * "import-flow"): preenche o valor (número, data, texto) e/ou escolhe o arquivo e clica "Enviar".
 */
export async function enviarPasso(page, pedidoUrl, ancora, chave, { valor = null, arquivo: nome = null } = {}) {
  await abrir(page, `${pedidoUrl}#${ancora}`);
  const linha = page.locator(`#${ancora}-step-${chave}`);
  const botao = linha.locator(`[data-import-submit="${chave}"]`);
  if (!(await botao.count()))
    throw new Error(`passo ${chave}: este login não tem o "Enviar" (na tela: ${(await linhaDoPasso(page, ancora, chave))?.texto ?? "o passo não aparece"})`);
  if (valor != null) await linha.locator('input[name="value"]').fill(valor);
  if (nome) await linha.locator("input[type=file]").setInputFiles(arquivo(nome));
  await concluir(page, /[?&]importStep=submitted/, `enviar o passo ${chave}`, () => botao.click());
  return linhaDoPasso(page, ancora, chave);
}

/** Valida um passo enviado por outro (botão "Validar" da linha). */
export async function validarPasso(page, pedidoUrl, ancora, chave) {
  await abrir(page, `${pedidoUrl}#${ancora}`);
  const botao = page.locator(`#${ancora}-step-${chave} [data-import-validate="${chave}"]`);
  if (!(await botao.count()))
    throw new Error(`passo ${chave}: este login não tem o "Validar" (na tela: ${(await linhaDoPasso(page, ancora, chave))?.texto ?? "o passo não aparece"})`);
  await concluir(page, /[?&]importStep=validated/, `validar o passo ${chave}`, () => botao.click());
  return linhaDoPasso(page, ancora, chave);
}

/** Situação de todos os passos de um cartão, como a tela mostra para quem está logado. */
export async function passosDoCartao(page, pedidoUrl, ancora) {
  await abrir(page, `${pedidoUrl}#${ancora}`);
  return page.locator(`[id^="${ancora}-step-"]`).evaluateAll((linhas) => linhas.map((tr) => ({
    chave: tr.getAttribute("data-import-step"), situacao: tr.getAttribute("data-import-status"),
    podeEnviar: !!tr.querySelector("[data-import-submit]"), podeValidar: !!tr.querySelector("[data-import-validate]"),
    texto: tr.innerText.replace(/\s+/g, " ").trim() })));
}

// ------------------------------------------- fotos e vídeos reais (amostras) --

/** Agência de marketing (ou a Wellmix): envia as fotos e vídeos reais de cada produto. */
export async function enviarFotosReais(page, pedidoUrl, arquivos) {
  await abrir(page, `${pedidoUrl}/real-media`);
  const forms = page.locator("form[data-real-media-send]");
  if (!(await forms.count())) throw new Error(`fotos reais: este login não tem o envio (na tela: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400)})`);
  let enviados = 0;
  while ((await forms.count()) > 0) {
    const form = forms.first();
    await form.locator("input[type=file]").setInputFiles(arquivos.map(arquivo));
    await concluir(page, /[?&]done=uploaded/, "enviar as fotos reais", () => form.locator("button[type=submit]").click());
    await abrir(page, `${pedidoUrl}/real-media`);
    if (++enviados > 20) throw new Error("fotos reais: o formulário de envio não some depois de enviar");
  }
  return enviados;
}

/** Wellmix (marketing): aprova as fotos reais de cada produto. */
export async function aprovarFotosReais(page, pedidoUrl) {
  await abrir(page, `${pedidoUrl}/real-media`);
  const forms = page.locator("form[data-real-media-decide]");
  if (!(await forms.count())) throw new Error(`fotos reais: este login não tem o aprovar (na tela: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400)})`);
  let aprovados = 0;
  while ((await forms.count()) > 0) {
    await concluir(page, /[?&]done=approved/, "aprovar as fotos reais", () => forms.first().locator("[data-real-media-approve]").click());
    await abrir(page, `${pedidoUrl}/real-media`);
    if (++aprovados > 20) throw new Error("fotos reais: o formulário de aprovar não some depois de aprovar");
  }
  const situacoes = await page.locator("[data-real-media-status]").evaluateAll((els) => els.map((el) => el.getAttribute("data-real-media-status")));
  if (situacoes.some((s) => s !== "approved")) throw new Error(`fotos reais: situação depois de aprovar: ${situacoes.join(", ")}`);
  return aprovados;
}

// ------------------------------------------------------ documentos do embarque --

/** Situação de um documento do embarque ("load", "packing_list", "invoice", "bl"). */
async function situacaoDoDocumento(page, tipo) {
  return page.locator(`[data-shipping-doc=${tipo}] [data-shipping-status]`).getAttribute("data-shipping-status").catch(() => null);
}

/**
 * Fornecedor: check list de carga. Marca, no único item do pedido, as caixas que subiram agora.
 * Confere o número de caixas do pedido que a tela mostra.
 */
export async function registrarCaixasCarregadas(page, pedidoUrl, caixas) {
  await abrir(page, `${pedidoUrl}/shipping-docs`);
  const form = page.locator("form[data-shipping-load-form]");
  const linhas = form.locator("[data-load-line]");
  if ((await linhas.count()) !== 1) throw new Error(`check list de carga: esperava 1 item, achei ${await linhas.count()}`);
  const faltam = (await linhas.first().locator("[data-load-remaining]").innerText()).trim();
  if (faltam !== String(caixas)) throw new Error(`check list de carga: a tela diz que faltam ${faltam} caixas (a história tem ${caixas})`);
  await linhas.first().locator('input[name^="add_"]').fill(String(caixas));
  await concluir(page, /[?&]done=load/, "registrar as caixas do check list", () => form.locator("button[type=submit]").click());
  return situacaoDoDocumento(page, "load");
}

/** Preenche a linha única de um documento (packing list ou invoice) e devolve o que veio preenchido. */
async function preencherLinhaDoDocumento(form, valores) {
  const linhas = form.locator("[data-doc-line]");
  if ((await linhas.count()) !== 1) throw new Error(`documento do embarque: esperava 1 item, achei ${await linhas.count()}`);
  const veio = {};
  for (const [campo, valor] of Object.entries(valores)) {
    const input = linhas.first().locator(`input[name^="${campo}_"]:not([type=hidden])`);
    if (!(await input.count())) { veio[campo] = "(sem campo: vem do documento anterior)"; continue; }
    veio[campo] = await input.inputValue();
    await input.fill(String(valor));
  }
  return veio;
}

/** Fornecedor: packing list (as caixas vêm do check list; arquivo opcional). */
export async function enviarPackingList(page, pedidoUrl, { pecas, pesoLiquidoKg, pesoBrutoKg, arquivo: nome = null }) {
  await abrir(page, `${pedidoUrl}/shipping-docs`);
  const form = page.locator("form[data-shipping-form=packing_list]");
  if (!(await form.count())) throw new Error(`packing list: sem o formulário (situação "${await situacaoDoDocumento(page, "packing_list")}")`);
  const veio = await preencherLinhaDoDocumento(form, { pieces: pecas, netKg: pesoLiquidoKg, grossKg: pesoBrutoKg });
  if (nome) await form.locator("input[type=file]").setInputFiles(arquivo(nome));
  await concluir(page, /[?&]done=packing_list/, "enviar o packing list", () => form.locator("button[type=submit]").click());
  return { veio, situacao: await situacaoDoDocumento(page, "packing_list") };
}

/** Fornecedor (a "trading" da invoice é o mesmo login): invoice, conferida com o packing list. */
export async function enviarInvoice(page, pedidoUrl, { numero, caixas, pecas, pesoLiquidoKg, pesoBrutoKg, precoPorPeca, arquivo: nome }) {
  await abrir(page, `${pedidoUrl}/shipping-docs`);
  const form = page.locator("form[data-shipping-form=invoice]");
  if (!(await form.count())) throw new Error(`invoice: sem o formulário (situação "${await situacaoDoDocumento(page, "invoice")}")`);
  const veio = await preencherLinhaDoDocumento(form, { cartons: caixas, pieces: pecas, netKg: pesoLiquidoKg, grossKg: pesoBrutoKg, unitPrice: precoPorPeca });
  await form.locator("input[name=number]").fill(numero);
  await form.locator("input[type=file]").setInputFiles(arquivo(nome));
  await concluir(page, /[?&]done=invoice/, "enviar a invoice", () => form.locator("button[type=submit]").click());
  const situacao = await situacaoDoDocumento(page, "invoice");
  if (situacao !== "accepted")
    throw new Error(`invoice: ficou "${situacao}" (na tela: ${(await page.locator("[data-shipping-doc=invoice]").innerText()).replace(/\s+/g, " ").slice(0, 500)})`);
  return { veio, situacao };
}

/** Situação dos quatro documentos do embarque, como a tela mostra. */
export async function situacaoDosDocumentos(page, pedidoUrl) {
  await abrir(page, `${pedidoUrl}/shipping-docs`);
  const out = {};
  for (const tipo of ["load", "packing_list", "invoice", "bl"]) out[tipo] = await situacaoDoDocumento(page, tipo);
  return out;
}

// ===========================================================================
// Acréscimos para os fluxos raros do fornecedor (`caminho-fornecedor-extras.mjs`): compra EXW
// e compra programada (pedido pai e filhos). As funções acima não mudam.
// ===========================================================================

// ------------------------------- seleção com quantidade e programação --

/**
 * Wellmix, Seleção de itens: busca, agrupa, marca o item escolhido e grava a escolha com a
 * quantidade em caixas master (`caixas`; em branco vale a quantidade da planilha) e, se
 * `programacao` vier, com a programação de compra: `{ quantas, intervaloDias, primeira }`
 * (`primeira` = AAAA-MM-DD da 1ª programação). Abre a solicitação ao fornecedor e devolve o
 * endereço dela e o que a tela mostrava ao gravar (peças, programações e o cálculo).
 */
export async function abrirSolicitacaoComQuantidade(page, { busca, codigo, precisa, caixas = null, programacao = null }) {
  await abrir(page, `/app/booking/selection?q=${encodeURIComponent(busca)}`);
  await page.locator("input[data-basket-all]").check();
  await Promise.all([page.waitForURL(/tab=selection&ids=/), page.click("[data-selection-group]")]);
  const itens = page.locator("[data-selection-item]");
  if ((await itens.count()) !== 1 || !(await itens.first().innerText()).includes(codigo))
    throw new Error(`Seleção de itens: esperava só o ${codigo} no grupo da busca "${busca}", achei ${await itens.count()} item(ns): ${(await itens.allInnerTexts()).map((x) => x.replace(/\s+/g, " ").slice(0, 60)).join(" / ")}`);
  await itens.first().locator("[data-selection-choose-button]").click();
  const gerador = page.locator("[data-rounds-generator]");
  await gerador.locator('[data-generate-item="ok"]').waitFor();
  if (caixas != null) await gerador.locator("[data-generate-total]").fill(String(caixas));
  const visto = { caixas: await gerador.locator("[data-generate-total]").inputValue(), programacoes: [] };
  if (programacao) {
    await gerador.locator("[data-generate-rounds]").fill(String(programacao.quantas));
    await gerador.locator("[data-generate-submit]").click();
    const quadro = page.locator('[data-request-schedule="on"]');
    await quadro.waitFor();
    // Intervalo: 30, 45 ou 60 dias têm botão; outro número vai no campo "Outro".
    const botao = quadro.locator(`[data-schedule-interval="${programacao.intervaloDias}"]`);
    if (await botao.count()) await botao.click();
    else await quadro.getByLabel("Outro", { exact: true }).fill(String(programacao.intervaloDias));
    await quadro.locator('input[type="date"]').fill(programacao.primeira);
    const cartoes = quadro.locator("[data-schedule-item]");
    if ((await cartoes.count()) !== programacao.quantas)
      throw new Error(`Seleção de itens: pedi ${programacao.quantas} programações e a tela ficou com ${await cartoes.count()}`);
    for (let i = 0; i < programacao.quantas; i++)
      visto.programacoes.push({ pecas: await cartoes.nth(i).locator('input[name^="schedule.qty."]').inputValue(),
        pedidoEm: (await cartoes.nth(i).locator("[data-schedule-date]").innerText()).trim() });
    visto.total = (await quadro.locator("[data-schedule-total]").innerText()).trim();
  }
  visto.pecas = await page.locator("[data-selection-quantity]").inputValue();
  visto.calculo = (await page.locator("[data-rounds-generator] [data-generate-calc]").innerText().catch(() => "")).replace(/\s*\n+\s*/g, " | ");
  await page.fill("[data-selection-needs]", precisa);
  await concluir(page, /[?&]saved=1/, `gravar a escolha do ${codigo}`, () => page.click("[data-selection-submit]"));
  await concluir(page, /\/app\/supplier-requests\/[^/?]+\?.*created=1/, `abrir a solicitação do ${codigo}`, () => page.click("[data-selection-open-all]"));
  return { url: semBusca(page.url()), visto };
}

// ------------------------------------------- pedido pai e pedidos filhos --

/**
 * Wellmix: gera o pedido de compra de uma solicitação com programação (o pedido pai). No quadro
 * "Gerar pedido de compra" a candidata programada mostra o total e as programações no lugar do
 * campo de quantidade. `confere` são trechos que a linha da candidata tem de mostrar.
 */
export async function gerarPedidoPai(page, numero, { confere = [] } = {}) {
  await abrir(page, "/app/supplier-requests");
  const linhaDe = (n) => page.locator("[data-purchase-candidate]").filter({ has: page.locator("td:nth-child(2)", { hasText: new RegExp(`^\\s*${n}\\s*$`) }) });
  const linha = linhaDe(numero);
  if ((await linha.count()) !== 1)
    throw new Error(`pedido pai: a solicitação nº ${numero} não está entre as candidatas (na tela: ${(await page.locator("[data-purchase-candidate]").allInnerTexts()).join(" / ") || "nenhuma candidata"})`);
  const grupo = page.locator("form[data-purchase-group]").filter({ has: linha });
  const candidatas = grupo.locator("[data-purchase-candidate]");
  for (let i = 0; i < (await candidatas.count()); i++) {
    const n = (await candidatas.nth(i).locator("td:nth-child(2)").innerText()).trim();
    const caixa = candidatas.nth(i).locator("input[type=checkbox]");
    if (n === String(numero)) await caixa.check(); else await caixa.uncheck();
  }
  const quadro = linha.locator("[data-purchase-rounds]");
  if (!(await quadro.count()))
    throw new Error(`pedido pai: a candidata nº ${numero} não mostra a programação (na tela: ${(await linha.innerText()).replace(/\s+/g, " ")})`);
  const texto = (await linha.innerText()).replace(/\s+/g, " ").trim();
  for (const trecho of confere)
    if (!texto.includes(trecho)) throw new Error(`pedido pai: a linha da nº ${numero} mostra "${texto}" (esperava conter "${trecho}")`);
  const programacao = (await quadro.innerText()).replace(/\s*\n+\s*/g, " · ").trim();
  const temCampoDeQuantidade = (await linha.locator("[data-purchase-qty]").count()) > 0;
  await concluir(page, /\/app\/orders\/[^/?]+\?purchase=created/, "gerar o pedido de compra (pai)", () => grupo.locator("[data-purchase-submit]").click());
  const url = semBusca(page.url());
  const numeroDoPai = (await page.getByText(/Pedido #\d+/).first().textContent())?.match(/#(\d+)/)?.[1] ?? null;
  return { url, numero: numeroDoPai, linha: texto, programacao, temCampoDeQuantidade };
}

/**
 * Cartão "Programação de compra (pedido pai)" do pedido, como a tela mostra a quem está logado:
 * uma linha por programação (data, peças e o pedido filho ou "Nasce em…") e se há o botão
 * "Gerar as programações do dia" (só a Wellmix, com programação vencida e a Preparação concluída).
 */
export async function programacoesDoPedido(page, pedidoUrl) {
  await abrir(page, pedidoUrl);
  const cartao = page.locator("[data-order-rounds]");
  if (!(await cartao.count())) return null;
  const linhas = await cartao.locator("[data-order-round]").evaluateAll((trs) => trs.map((tr) => ({
    programacao: tr.getAttribute("data-order-round"),
    texto: [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()).join(" | "),
    filho: tr.querySelector("[data-order-round-child]")?.getAttribute("href") ?? null })));
  return { linhas, podeGerar: (await page.locator("[data-order-rounds-spawn]").count()) > 0 };
}

/**
 * Lista Pedidos de quem está logado: uma entrada por pedido, com o endereço e o texto da linha
 * (a tela tem a tabela dos pedidos e, abaixo, a dos itens: vale a primeira linha de cada pedido).
 */
export async function pedidosDaLista(page) {
  await abrir(page, "/app/orders");
  const linhas = await page.locator("main table tbody tr").evaluateAll((trs) => trs.map((tr) => {
    const a = tr.querySelector('a[href^="/app/orders/"]');
    return a ? { url: a.getAttribute("href").match(/^\/app\/orders\/[^/?#]+/)[0], texto: tr.innerText.replace(/\s+/g, " ").trim() } : null;
  }).filter(Boolean));
  return linhas.filter((l, i) => linhas.findIndex((x) => x.url === l.url) === i);
}

/**
 * Wellmix, pedido pai: botão "Gerar as programações do dia" (só aparece com programação vencida
 * e a Preparação do pai concluída). Devolve o aviso que a tela mostra depois.
 */
export async function gerarProgramacoesDoDia(page, pedidoUrl) {
  await abrir(page, pedidoUrl);
  const botao = page.locator("[data-order-rounds-spawn]");
  if (!(await botao.count()))
    throw new Error(`pedido pai: sem o botão "Gerar as programações do dia" (na tela: ${(await page.locator("[data-order-rounds]").innerText().catch(() => "sem o cartão da programação")).replace(/\s+/g, " ")})`);
  await concluir(page, /[?&]rounds=\d+/, "gerar as programações do dia", () => botao.click());
  return (await page.locator('main [role="alert"]').first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}

// ------------------------------------------------ compra EXW (custos de origem) --

/**
 * Fornecedor (a trading), compra EXW: passo "Custos do transporte na origem (POP)" do cartão
 * "Container na origem": valor, moeda (USD, RMB ou BRL) e o comprovante. A Wellmix valida depois.
 * Devolve a linha como ficou e as moedas que o campo oferece.
 */
export async function enviarCustosDeOrigem(page, pedidoUrl, { valor, moeda, comprovante }) {
  await abrir(page, `${pedidoUrl}#container-origin`);
  const linha = page.locator("#container-origin-step-origin_costs");
  const botao = linha.locator('[data-import-submit="origin_costs"]');
  if (!(await botao.count()))
    throw new Error(`custos de origem: este login não tem o "Enviar" (na tela: ${(await linhaDoPasso(page, "container-origin", "origin_costs"))?.texto ?? "o passo não aparece"})`);
  const moedas = await linha.locator('select[name="currency"] option').evaluateAll((os) => os.map((o) => o.value));
  await linha.locator('input[name="amount"]').fill(String(valor));
  await linha.locator('select[name="currency"]').selectOption(moeda);
  await linha.locator("input[type=file]").setInputFiles(arquivo(comprovante));
  await concluir(page, /[?&]importStep=submitted/, "enviar os custos de origem", () => botao.click());
  return { ...(await linhaDoPasso(page, "container-origin", "origin_costs")), moedas };
}
