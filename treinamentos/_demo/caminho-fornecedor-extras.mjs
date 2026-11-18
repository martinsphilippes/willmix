// Caminhos extras da trilha do Fornecedor: dois fluxos raros que o caminho principal
// (`caminho-fornecedor.mjs`: pedido FOB, sem programação) não cobre.
//
//   exw-…   compra EXW (tarefa T18): os três passos da trading antes do "container vazio".
//   prog-…  compra programada (tarefa T20): solicitação com programações, pedido pai e filhos.
//
// Cada fluxo parte do banco zerado e é independente do outro e do caminho principal: os pontos
// daqui se chamam `forn-exw-…` e `forn-prog-…` e nenhum ponto `forn-m…` é lido nem trocado.
//
// Pontos (em todos, o login é o do fornecedor A):
//   forn-exw-solicitacao   solicitação do copo por responder (a modalidade EXW entra na resposta)
//   forn-exw-diecut        pedido EXW gerado, Die Cut por fazer
//   forn-exw-contrato      contrato por assinar e pedido de amostras por aceitar
//   forn-exw-amostras      SKU aprovado, cartão Amostras por fazer (os passos EXW já aparecem, fechados)
//   forn-exw-base          booking validado: os três passos EXW por fazer (transportadora, previsão, custos)
//   forn-exw-enviado       os três enviados; custos esperando a validação da Wellmix (sem pendência dele)
//   forn-exw-custos        custos validados: abre o "Container vazio no depósito da fábrica"
//   forn-prog-solicitacao  solicitação da tigela com 2 programações, por responder
//   forn-prog-pai          pedido pai gerado, Die Cut do pai por fazer
//   forn-prog-nascido      Preparação do pai concluída: a programação 1 virou o pedido filho (só o aviso)
//   forn-prog-filhos       filho 1 com o contrato por assinar e o pedido de amostras por aceitar
//
// A 1ª programação é "hoje": o filho dela nasce quando a Preparação do pai conclui. A 2ª (hoje + 30
// dias) fica "Nasce em dd/mm": o portal só cria o filho no dia combinado, e nada aqui força isso.
//
// Rode de `_pipeline`, num servidor e numa pasta de dados à parte da gravação:
//
//   cd treinamentos/_pipeline
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor-extras.mjs            # os dois fluxos
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor-extras.mjs exw        # só o fluxo EXW
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor-extras.mjs prog       # só a compra programada
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor-extras.mjs exw-base   # só essa etapa
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor-extras.mjs exw-base.. # dessa etapa até o fim do fluxo dela
//
//   TREINO_PONTOS_PREFIXO=ensaio- …   # ensaio: lê e salva `ensaio-forn-…`, sem trocar os pontos em uso
//   TREINO_CAPTURAS=/pasta …          # guarda uma captura de tela inteira de cada tela conferida
//
// Depois de cada etapa o script entra como o fornecedor, abre /app e imprime as pendências dele,
// os endereços (solicitação e pedidos) e o que ele vê de diferente do caminho principal naquele
// ponto. Tudo é feito pela tela; se o portal recusa um passo, a etapa para com o texto da tela.
//
// As datas são relativas ao dia (a 1ª programação é "hoje"; a previsão do container, hoje + 2):
// rode de novo no dia da gravação.
import fs from "node:fs";
import path from "node:path";
import { BASE, abrirEnsaio, entrar, gravarJson, lerJson, pararServidor, restaurarPonto, salvarPonto, zerarDados } from "../_pipeline/lib.mjs";
import { PLANILHAS, cambioManual, fecharBook, idiomaPortugues, importarBook } from "./preparo.mjs";
import * as P from "./preparo-pedido.mjs";
import { ADMIN, AGENCIA_DE_ARTE, AGENCIA_DE_MARKETING, AGENTE_DE_CARGA, CERTIFICADORA, FORNECEDOR, HISTORIA, OPERADOR,
  QUEM_GERA_O_PEDIDO, QUEM_NEGOCIA } from "./caminho-fornecedor.mjs";

/** O book do fornecedor A (os três itens: pote SZ-JR15, copo SZ-CP35, tigela SZ-BW50). */
const BOOK = "book-shenzhen-supplier-a.xlsx";

/**
 * A história dos dois fluxos. Mesmo fornecedor (Shenzhen Supplier A) e itens do book dele; os
 * arquivos são os de `_demo/arquivos/` (os mesmos nomes da HISTORIA do caminho principal).
 */
export const EXTRAS = {
  // Fluxo 1: o copo de 350 ml, comprado EXW (o fornecedor responde a solicitação com EXW).
  exw: {
    codigo: "SZ-CP35", nome: "Glass cup 350ml", busca: "350", precisa: HISTORIA.aprovada.precisa,
    // 60 caixas master de 48 peças = 2.880 peças (a planilha traz 3.000, que não fecha caixas).
    caixas: 60, pecas: 2880,
    book: { preco: "1.25", moeda: "USD", moq: 1000, entrega: "FOB" },
    resposta: { preco: "1.18", moq: "1000", prazoDias: "30", entrega: "EXW", obs: "Preço EXW, retirada na fábrica em Shenzhen: USD 1,18 por peça." },
    amostragem: { arquivos: HISTORIA.amostragem.copo.rodada1.concat(HISTORIA.amostragem.copo.rodada2), obs: "Amostra do copo liso: frente e borda." },
    produto: { linha: "linha-utilidades" },
    dieCut: { faca: HISTORIA.dieCut.faca, fotoAlta: HISTORIA.dieCut.fotoAlta, moq: "1000", prazoDias: "30" },
    inspecao: { pesoKg: "0.30" },
    // Os três passos da trading (login do fornecedor) no cartão "Container na origem".
    origem: { transportadora: "Shenzhen Port Trucking", previsaoEmDias: 2, custos: { valor: "380", moeda: "USD", comprovante: "amostras-envio-china.pdf" } },
  },
  // Fluxo 2: a tigela de 500 ml em 2 programações (a 1ª hoje, a 2ª daqui a 30 dias).
  programada: {
    codigo: "SZ-BW50", nome: "Glass bowl 500ml", busca: "bowl", precisa: "Tigela lisa, em caixa parda com a marca Wellmix.",
    // 100 caixas master de 36 peças = 3.600 peças (a quantidade da planilha), 50 caixas por programação.
    caixas: 100, pecas: 3600, programacoes: 2, pecasPorProgramacao: 1800, intervaloDias: 30, primeiraEmDias: 0,
    book: { preco: "0.95", moeda: "USD", moq: 1500, entrega: "FOB" },
    resposta: { preco: "0.92", moq: "1500", prazoDias: "30", entrega: "FOB", obs: "Para as duas programações: USD 0,92 por peça." },
    amostragem: { arquivos: ["amostra-3d-frente.jpg"], obs: "Amostra da tigela lisa." },
    produto: { linha: "linha-utilidades" },
    dieCut: { faca: HISTORIA.dieCut.faca, fotoAlta: HISTORIA.dieCut.fotoAlta, moq: "1500", prazoDias: "30" },
  },
};

// ------------------------------------------------------------- peças comuns --

/** Prazo da negociação em Configurações → SLA: 2 dias, para a tela não nascer "Atrasada"
 *  entre o preparo e a gravação (o mesmo ajuste do caminho principal). */
async function prazoDaSolicitacao(page, minutos = 2880) {
  await entrar(page, ADMIN);
  await page.goto(`${BASE}/app/settings`);
  const campo = page.locator('input[name="supplierRequestSlaMinutes"]');
  await campo.fill(String(minutos));
  await campo.evaluate((el) => el.form.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

/** Banco zerado → câmbio, prazo, idioma do fornecedor e o book do fornecedor A fechado. */
async function prepararBook(page) {
  await cambioManual(page);
  await prazoDaSolicitacao(page);
  await idiomaPortugues(page, FORNECEDOR);
  await entrar(page, OPERADOR);
  await importarBook(page, BOOK);
  await fecharBook(page);
  await P.esvaziarCesta(page);
}

/**
 * Da solicitação nº 1 por responder até o produto criado: o fornecedor responde pela tela do
 * produto (preço, pedido mínimo, prazo e modalidade), a Wellmix aprova, o fornecedor envia a
 * amostragem, a Wellmix valida e cria o produto com as condições combinadas.
 */
async function negociarAteOProduto(page, h) {
  const r = h.resposta;
  await entrar(page, FORNECEDOR);
  await P.responderPelaTelaDoProduto(page, 1, { faz: true, preco: r.preco, moeda: h.book.moeda, moq: r.moq, prazoDias: r.prazoDias, entrega: r.entrega, obs: r.obs });
  await entrar(page, QUEM_NEGOCIA);
  await P.aprovarSolicitacao(page, 1);
  await entrar(page, FORNECEDOR);
  await P.enviarAmostragem(page, 1, h.amostragem.arquivos, h.amostragem.obs);
  await entrar(page, QUEM_NEGOCIA);
  await P.validarAmostragem(page, 1, { aprova: true });
  await entrar(page, QUEM_GERA_O_PEDIDO);
  const produto = await P.criarProdutoDaSolicitacao(page, 1, { linha: h.produto.linha,
    condicoes: [`${r.preco} ${h.book.moeda}`, r.entrega, `MOQ ${r.moq}`, `${r.prazoDias} dias`] });
  console.log(`  produto criado: ${produto.produto} · condições na tela: ${produto.combinado}`);
  return produto;
}

/** O que a linha da candidata tem de mostrar no quadro "Gerar pedido de compra". */
const confereDoPedido = (h) => [`${P.numeroPt(h.resposta.preco)} ${h.book.moeda}`, Number(h.resposta.moq).toLocaleString("pt-BR"), h.resposta.prazoDias];

/** Envia um passo de um cartão e imprime como a linha ficou. */
async function passo(page, pedido, ancora, chave, dados) {
  const linha = await P.enviarPasso(page, pedido, ancora, chave, dados);
  console.log(`  ${chave}: ${linha?.texto ?? "(a linha não aparece para este login)"}`);
  return linha;
}

/** Imprime o que um papel preencheu (e o que deixou de lado) na tela do pedido. */
async function mostrar(quem, promessa) {
  const { feitos, pulados } = await promessa;
  console.log(`  ${quem} preencheu: ${feitos.join(" · ") || "nada"}${pulados.length ? ` (não mexeu em: ${pulados.join(" · ")})` : ""}`);
  return feitos;
}

/**
 * A etapa "Preparação, arte e certificação" inteira, como no caminho principal: o fornecedor faz
 * o Die Cut; cadastro e fiscal, agência de arte e (se a linha do produto exige) a certificadora
 * concluem as raias deles. Os arquivos dos outros papéis são os de HISTORIA.outrosPapeis.
 */
async function concluirPreparacao(page, pedido, h) {
  const o = HISTORIA.outrosPapeis;
  await entrar(page, FORNECEDOR);
  const dieCut = await P.fazerDieCut(page, pedido, h.dieCut);
  console.log(`  Die Cut: campos vieram com ${dieCut.veio.moq} peças e ${dieCut.veio.prazoDias} dias · confirmado: ${dieCut.confirmado}`);
  // Cadastro e fiscal (Wellmix): NCM validado e ficha mestre completa.
  await entrar(page, QUEM_GERA_O_PEDIDO);
  const fiscal = await P.validarNcmDoProduto(page, pedido, o.ncm);
  if (fiscal.feito) await P.completarFichaMestre(page, fiscal.produto, o.fichaMestre);
  // Aprovações do mapa (GP: cadastro e fiscal; Comprador: material de arte): sem elas a Arte não abre.
  console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
  // Agência de arte: a arte (sobre a faca e a foto em alta). Wellmix: valida a arte.
  await entrar(page, AGENCIA_DE_ARTE);
  await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/^Arte ·/.test(r) ? { arquivo: o.arte } : null)));
  await entrar(page, QUEM_GERA_O_PEDIDO);
  await P.validarArte(page, pedido);
  // Certificadora e arte final com o selo: só quando a linha do produto exige certificação.
  await entrar(page, CERTIFICADORA);
  const certificados = await mostrar("certificadora", P.preencherItensDoPedido(page, pedido, (r) => (/^Certificado/.test(r) ? { arquivo: o.certificado } : null)));
  if (certificados.length) {
    const docs = await P.enviarDocumentosDaCertificacao(page, pedido, { cert_memorial: { arquivo: o.memorial }, cert_seal: { arquivo: o.selo.arquivo, valor: o.selo.numero } });
    console.log(`  certificação: ${docs.join(" · ")}`);
    // GP aprova a certificação (libera o selo na arte).
    await entrar(page, QUEM_GERA_O_PEDIDO);
    console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
    await entrar(page, AGENCIA_DE_ARTE);
    await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/Arte final com o selo/.test(r) ? { arquivo: o.arteFinal } : null)));
    // Arte com o selo aplicado (cartão Certificação): o marco Certificação só conclui com ela.
    console.log(`  selo aplicado na arte: ${(await P.enviarSeloAplicado(page, pedido, o.arteFinal))?.texto}`);
    await entrar(page, QUEM_GERA_O_PEDIDO);
    console.log(`  selo aplicado na arte, depois da Wellmix: ${(await P.decidirSeloAplicado(page, pedido, { valida: true }))?.texto}`);
  } else console.log("  certificação: a linha do produto não exige certificado (sem a raia da certificadora nem a arte final com o selo)");
}

/** Wellmix: gera o pedido de amostras e sobe o contrato assinado por ela (a vez passa ao fornecedor). */
async function amostrasEContratoDaWellmix(page, pedido) {
  await entrar(page, QUEM_GERA_O_PEDIDO);
  console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
  console.log(`  pedido de amostras gerado: ${await P.gerarPedidoDeAmostras(page, pedido)} peças`);
  console.log(`  contrato depois da assinatura da Wellmix: ${await P.assinarContrato(page, pedido, "wellmix", { arquivo: HISTORIA.outrosPapeis.contratoWellmix })}`);
}

// ------------------------------------------- o que o fornecedor vê (relatório) --

/** Texto de um trecho da tela numa linha só (nulo se o trecho não está na tela). */
const textoDe = async (page, seletor) => {
  const alvo = page.locator(seletor).first();
  return (await alvo.count()) ? (await alvo.innerText()).replace(/\s*\n+\s*/g, " | ").replace(/[ \t]+/g, " ").trim() : null;
};

/** Imprime o texto de um trecho da tela, com o seletor dele. */
async function ver(page, rotulo, seletor) {
  const texto = await textoDe(page, seletor);
  console.log(`    ${rotulo} (${seletor}): ${texto ?? "não aparece nesta tela"}`);
  return texto;
}

/** Imprime os campos e botões à vista dentro de um trecho, com os atributos que servem de seletor. */
async function campos(page, rotulo, seletor) {
  const lista = await page.locator(`${seletor} input:not([type=hidden]), ${seletor} select, ${seletor} textarea, ${seletor} button, ${seletor} a[href]`).evaluateAll((els) =>
    els.filter((el) => el.offsetParent !== null || el.type === "file").map((el) => {
      const attrs = [...el.attributes].filter((a) => a.name.startsWith("data-") || ["name", "type", "placeholder", "aria-label"].includes(a.name))
        .map((a) => (a.value && a.value !== "true" ? `${a.name}="${a.value.slice(0, 60)}"` : a.name)).join(" ");
      const opcoes = el.tagName === "SELECT" ? ` [${[...el.options].map((o) => o.textContent.trim()).join(" / ")}]` : "";
      const texto = el.tagName === "SELECT" ? "" : (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 50);
      return `<${el.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ""}>${texto ? ` "${texto}"` : ""}${opcoes}`;
    }));
  console.log(`    ${rotulo} (${seletor}):${lista.length ? "" : " nenhum campo à vista"}`);
  for (const campo of lista) console.log(`      ${campo}`);
  return lista;
}

/** Imprime os trechos da tela aberta que citam um termo (FOB, EXW, Incoterm…). */
async function citacoes(page, rotulo, expr) {
  const texto = (await page.locator("main").innerText()).replace(/\s*\n+\s*/g, " | ").replace(/[ \t]+/g, " ");
  const achados = [...texto.matchAll(new RegExp(`.{0,60}(?:${expr.source}).{0,60}`, "g"))].map((m) => m[0].trim());
  console.log(`    ${rotulo}: ${achados.length ? achados.map((a) => `"…${a}…"`).join(" · ") : `nenhuma menção a ${expr.source}`}`);
  return achados;
}

/** Passos de um cartão do pedido, um por linha: seletor, situação e o que o login pode fazer. */
async function mostrarPassos(page, pedido, ancora) {
  const passos = await P.passosDoCartao(page, pedido, ancora);
  if (!passos.length) console.log(`    (o cartão #${ancora} não tem passos para este login)`);
  for (const p of passos)
    console.log(`    #${ancora}-step-${p.chave} [${p.situacao}]${p.podeEnviar ? " (Enviar)" : ""}${p.podeValidar ? " (Validar)" : ""}: ${p.texto}`);
  return passos;
}

/** Cartão "Container na origem" como o fornecedor vê: os passos e os campos dos que ele pode enviar. */
async function verContainerNaOrigem(page, pedido, capturar, destaque) {
  console.log(`  cartão "Container na origem" (${pedido}#container-origin), como o fornecedor vê:`);
  const passos = await mostrarPassos(page, pedido, "container-origin");
  for (const p of passos.filter((x) => x.podeEnviar)) await campos(page, `campos de ${p.chave}`, `#container-origin-step-${p.chave}`);
  await capturar("pedido", `#container-origin-step-${destaque}`);
  return passos;
}

/** O pedido pai (o que tem o cartão das programações) e os filhos já nascidos, pela lista Pedidos. */
async function paiEFilhos(page) {
  for (const p of await P.pedidosDaLista(page)) {
    const r = await P.programacoesDoPedido(page, p.url);
    if (r) return { pai: p.url, filhos: Object.fromEntries(r.linhas.filter((l) => l.filho).map((l) => [l.programacao, l.filho])), linhas: r.linhas };
  }
  throw new Error("não achei nenhum pedido pai (com o cartão das programações) na lista Pedidos");
}

/** Documento do pedido aberto: a linha do produto e o total, como a tela mostra. */
async function linhaDoDocumento(page) {
  const texto = (await textoDe(page, "main")) ?? "";
  return texto.match(/Produto Quantidade [^|]*\| ([^|]+\| Total [^|]+)/)?.[1]?.trim() ?? "(sem a tabela do produto)";
}

/** Registra no log um comportamento do portal diferente do documentado (nada é contornado). */
const divergencia = (texto) => console.log(`  DIVERGÊNCIA: ${texto}`);

/** Etapas na ordem. `de`: ponto de partida (null = banco zerado). `salva`: ponto que deixa pronto.
 *  `ve`: o que o fornecedor vê de diferente do caminho principal naquele ponto (só leitura). */
export const ETAPAS = [
  // ------------------------------------------------------------ compra EXW --
  { nome: "exw-solicitacao", fluxo: "exw", de: null, salva: "forn-exw-solicitacao",
    // Book do fornecedor A e a solicitação do copo (60 caixas). Ponto: solicitação por responder
    // (é na resposta que o fornecedor escolhe a modalidade EXW).
    async faz(page) {
      const h = EXTRAS.exw;
      await prepararBook(page);
      const s = await P.abrirSolicitacaoComQuantidade(page, { busca: h.busca, codigo: h.codigo, precisa: h.precisa, caixas: h.caixas });
      console.log(`  solicitação do ${h.codigo}: ${s.url} · ${s.visto.caixas} caixas = ${s.visto.pecas} peças`);
      if (s.visto.pecas !== String(h.pecas)) throw new Error(`Seleção: ${h.caixas} caixas viraram ${s.visto.pecas} peças (a história tem ${h.pecas})`);
    },
    async ve(page, onde, capturar) {
      await P.abrirProdutoDaSolicitacao(page, 1);
      console.log("  tela do produto da solicitação: a modalidade (FOB ou EXW) é um campo da resposta");
      await campos(page, 'cartão "Resposta do fornecedor"', "[data-supplier-answer-form]");
      await capturar("solicitacao-produto", "[data-supplier-answer-form]");
    } },
  { nome: "exw-diecut", fluxo: "exw", de: "forn-exw-solicitacao", salva: "forn-exw-diecut",
    // O fornecedor responde com a modalidade EXW; aprovação, amostragem, produto e o pedido de
    // compra (nasce EXW, pela ficha do produto). Ponto: Die Cut esperando o fornecedor.
    async faz(page) {
      const h = EXTRAS.exw;
      await negociarAteOProduto(page, h);
      const pedido = await P.gerarPedidoDeCompra(page, [1], { quantidades: { 1: h.pecas }, confere: { 1: confereDoPedido(h) } });
      console.log(`  pedido de compra #${pedido.numero}: ${pedido.url} · ${pedido.marcadas.join(" / ")}`);
      const parceiros = await P.designarParceiros(page, pedido.url);
      console.log(`  parceiros do pedido: ${Object.entries(parceiros).map(([tipo, quem]) => `${tipo}: ${quem}`).join(" · ")}`);
    },
    async ve(page, onde, capturar) {
      console.log("  onde o EXW aparece para o fornecedor neste ponto:");
      await P.abrirProdutoDaSolicitacao(page, 1);
      await citacoes(page, "tela do produto da solicitação", /EXW/);
      await capturar("solicitacao-produto");
      await P.abrir(page, onde.pedidos[0]);
      await citacoes(page, "tela do pedido", /EXW|FOB|Incoterm/);
      await capturar("pedido");
    } },
  { nome: "exw-contrato", fluxo: "exw", de: "forn-exw-diecut", salva: "forn-exw-contrato",
    // Die Cut e as raias dos outros papéis; a Wellmix gera o pedido de amostras e assina o
    // contrato. Ponto: o fornecedor com o contrato para assinar e o pedido de amostras para aceitar.
    async faz(page) {
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await concluirPreparacao(page, pedido, EXTRAS.exw);
      await amostrasEContratoDaWellmix(page, pedido);
    },
    async ve(page, onde, capturar) {
      await P.abrir(page, `${onde.pedidos[0]}/purchase-order`);
      console.log("  documento do pedido (o que o fornecedor assina) numa compra EXW:");
      const achados = await citacoes(page, "menções à modalidade", /EXW|FOB|Incoterm/);
      if (achados.some((a) => /Incoterm: \| FOB|Total FOB/.test(a)) && !achados.some((a) => /EXW/.test(a)))
        divergencia('o documento do pedido de uma compra negociada em EXW diz "Total FOB" e "Incoterm: FOB" e não cita EXW');
      await capturar("contrato");
    } },
  { nome: "exw-amostras", fluxo: "exw", de: "forn-exw-contrato", salva: "forn-exw-amostras",
    // O fornecedor assina o contrato e aceita o pedido de amostras; sinal pago e recebido;
    // produção e inspeção enviadas; a Wellmix aprova o SKU. Ponto: cartão Amostras esperando o
    // fornecedor (o mesmo momento do `forn-m6-amostras` do caminho principal).
    async faz(page) {
      const h = EXTRAS.exw, i = HISTORIA.inspecao;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      console.log(`  contrato depois da assinatura do fornecedor: ${await P.assinarContrato(page, pedido, "supplier", { nome: HISTORIA.contrato.quemAssina, arquivo: HISTORIA.contrato.arquivo })}`);
      await P.aceitarPedidoDeAmostras(page, pedido, HISTORIA.contrato.quemAssina);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const sinal = await P.registrarPagamentoDoSinal(page, pedido);
      console.log(`  sinal: condição "${sinal.condicao}" · parcela 1 ficou "${sinal.situacao}"`);
      await entrar(page, FORNECEDOR);
      await P.confirmarRecebimento(page, await P.numeroDoPedido(page, pedido));
      // Sinal (Diretoria de compras) e pré-produção (Planner): sem elas a Inspeção não abre.
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
      await entrar(page, FORNECEDOR);
      const producao = await P.salvarProducao(page, pedido, { tipo: "factory", inicio: P.dataEmDias(HISTORIA.producao.inicioEmDias), etd: P.dataEmDias(Number(h.resposta.prazoDias)) });
      console.log(`  produção: início ${producao.antes.inicioAutomatico ? "automático (campo fechado)" : "digitado"} ${producao.depois.inicio} · ETD ${producao.depois.etd} · ${producao.depois.tipo}`);
      const respostas = [
        [/^Foto sem embalagem/, { arquivo: i.semEmbalagem }], [/^Foto com embalagem/, { arquivo: i.comEmbalagem }],
        [/^Foto na balança/, { arquivo: i.naBalanca }], [/^Peso medido/, { valor: h.inspecao.pesoKg }],
        [/^Vídeo da produção/, { arquivo: i.video }], [/^Produto conforme o pedido/, { confirma: true }],
      ];
      // Item obrigatório fora da lista (não esperado): para aqui, para a história não ganhar valor inventado.
      await mostrar("fornecedor (inspeção)", P.preencherItensDoPedido(page, pedido, (r) => {
        const achou = respostas.find(([rotulo]) => rotulo.test(r));
        if (!achou) throw new Error(`inspeção: item obrigatório sem valor na história: "${r}"`);
        return achou[1];
      }));
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const sku = await P.inspecionarSku(page, pedido, "approved");
      console.log(`  SKU: ${sku.antes} → ${sku.depois}`);
    },
    async ve(page, onde, capturar) {
      // Os três passos EXW já estão no cartão, fechados até o booking ser validado.
      await verContainerNaOrigem(page, onde.pedidos[0], capturar, "origin_carrier");
    } },
  { nome: "exw-base", fluxo: "exw", de: "forn-exw-amostras", salva: "forn-exw-base",
    // Amostras do pedido (retirada, envios, fotos reais, devolução validada) e o booking do agente
    // de carga validado pela Wellmix. Ponto: a vez do fornecedor de fazer os três passos da
    // compra EXW, antes do "container vazio".
    async faz(page) {
      const a = HISTORIA.amostras, o = HISTORIA.outrosPapeis;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await passo(page, pedido, "samples-flow", "samples_picked", { valor: P.dataEmDias(0) });
      await passo(page, pedido, "samples-flow", "samples_brazil", { valor: a.rastreioBrasil, arquivo: a.comprovanteBrasil });
      await passo(page, pedido, "samples-flow", "samples_china", { valor: a.rastreioChina, arquivo: a.comprovanteChina });
      await entrar(page, AGENCIA_DE_MARKETING);
      await passo(page, pedido, "samples-flow", "samples_china_received", { valor: P.dataEmDias(0) });
      console.log(`  fotos reais enviadas pela agência: ${await P.enviarFotosReais(page, pedido, o.fotosReais)} produto(s)`);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  fotos reais aprovadas pela Wellmix: ${await P.aprovarFotosReais(page, pedido)} produto(s)`);
      await entrar(page, AGENCIA_DE_MARKETING);
      await passo(page, pedido, "samples-flow", "samples_returned", { valor: o.devolucaoDaAmostra });
      await entrar(page, FORNECEDOR);
      console.log(`  samples_returned: ${(await P.validarPasso(page, pedido, "samples-flow", "samples_returned")).texto}`);
      await entrar(page, AGENTE_DE_CARGA);
      await passo(page, pedido, "import-flow", "booking", { valor: o.booking });
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  booking: ${(await P.validarPasso(page, pedido, "import-flow", "booking")).texto}`);
      // O ponto só vale se o pedido é mesmo EXW: o primeiro passo EXW tem de estar aberto para o fornecedor.
      await entrar(page, FORNECEDOR);
      const passos = await P.passosDoCartao(page, pedido, "container-origin");
      if (!passos.find((p) => p.chave === "origin_carrier")?.podeEnviar)
        throw new Error(`compra EXW: depois do booking validado o fornecedor não tem o "Enviar" da transportadora (passos na tela: ${passos.map((p) => `${p.chave}[${p.situacao}]${p.podeEnviar ? "(Enviar)" : ""}`).join(", ") || "nenhum"})`);
    },
    async ve(page, onde, capturar) {
      const passos = await verContainerNaOrigem(page, onde.pedidos[0], capturar, "origin_carrier");
      if (passos.find((p) => p.chave === "container_at_factory")?.podeEnviar)
        divergencia('o "Container vazio no depósito da fábrica" está aberto antes dos custos de origem validados');
    } },
  { nome: "exw-enviado", fluxo: "exw", de: "forn-exw-base", salva: "forn-exw-enviado",
    // O fornecedor (a trading) faz os três passos da compra EXW: transportadora, previsão do
    // container e custos de origem com o comprovante. Ponto: custos esperando a validação da
    // Wellmix; o "container vazio" continua fechado para o fornecedor.
    async faz(page) {
      const o = EXTRAS.exw.origem;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      const pendencia = async (quando) => console.log(`    em /app ${quando}: ${(await P.linhasDePendencias(page)).join(" || ") || "(nenhuma pendência)"}`);
      await passo(page, pedido, "container-origin", "origin_carrier", { valor: o.transportadora });
      await pendencia("depois da transportadora");
      await passo(page, pedido, "container-origin", "origin_carrier_eta", { valor: P.dataEmDias(o.previsaoEmDias) });
      await pendencia("depois da previsão");
      await P.abrir(page, `${pedido}#container-origin`);
      await campos(page, "campos de origin_costs antes de enviar", "#container-origin-step-origin_costs");
      const custos = await P.enviarCustosDeOrigem(page, pedido, o.custos);
      console.log(`  origin_costs: ${custos.texto} · moedas do campo: ${custos.moedas.join(", ")}`);
    },
    async ve(page, onde, capturar) {
      const passos = await verContainerNaOrigem(page, onde.pedidos[0], capturar, "origin_costs");
      if (passos.find((p) => p.chave === "container_at_factory")?.podeEnviar)
        divergencia('o "Container vazio no depósito da fábrica" abriu antes de a Wellmix validar os custos de origem');
    } },
  { nome: "exw-custos", fluxo: "exw", de: "forn-exw-enviado", salva: "forn-exw-custos",
    // A Wellmix valida os custos de origem. Ponto: abre para o fornecedor o "Container vazio no
    // depósito da fábrica" (dali em diante o cartão segue como no caminho principal).
    async faz(page) {
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const pedido = await P.pedidoUnico(page);
      console.log('  cartão "Container na origem", como a Wellmix vê antes de validar:');
      await mostrarPassos(page, pedido, "container-origin");
      console.log(`  origin_costs: ${(await P.validarPasso(page, pedido, "container-origin", "origin_costs")).texto}`);
    },
    async ve(page, onde, capturar) {
      const passos = await verContainerNaOrigem(page, onde.pedidos[0], capturar, "container_at_factory");
      if (!passos.find((p) => p.chave === "container_at_factory")?.podeEnviar)
        divergencia('com os custos de origem validados, o "Container vazio no depósito da fábrica" não abriu para o fornecedor');
    } },
  // ------------------------------------------------------ compra programada --
  { nome: "prog-solicitacao", fluxo: "prog", de: null, salva: "forn-prog-solicitacao",
    // Book do fornecedor A e a solicitação da tigela em 2 programações. Ponto: solicitação com
    // programações, por responder.
    async faz(page) {
      const h = EXTRAS.programada;
      await prepararBook(page);
      const s = await P.abrirSolicitacaoComQuantidade(page, { busca: h.busca, codigo: h.codigo, precisa: h.precisa, caixas: h.caixas,
        programacao: { quantas: h.programacoes, intervaloDias: h.intervaloDias, primeira: P.dataEmDias(h.primeiraEmDias) } });
      console.log(`  solicitação do ${h.codigo}: ${s.url} · ${s.visto.caixas} caixas = ${s.visto.pecas} peças · ${s.visto.total}`);
      for (const [i, p] of s.visto.programacoes.entries()) console.log(`    programação ${i + 1}: ${p.pecas} peças · pedido em ${p.pedidoEm}`);
      console.log(`    cálculo na tela: ${s.visto.calculo}`);
      if (s.visto.programacoes.some((p) => p.pecas !== String(h.pecasPorProgramacao)))
        throw new Error(`Seleção: as programações ficaram com ${s.visto.programacoes.map((p) => p.pecas).join(" e ")} peças (a história tem ${h.pecasPorProgramacao} em cada)`);
    },
    async ve(page, onde, capturar) {
      console.log("  lista Solicitações ao fornecedor:");
      await P.abrir(page, "/app/supplier-requests");
      await ver(page, "linha de resumo sob a quantidade", "[data-supplier-request-rounds]");
      await capturar("lista-de-solicitacoes");
      console.log("  tabela da solicitação (as colunas ficam à direita: a tabela rola para o lado):");
      await P.abrirSolicitacaoNumero(page, 1);
      const cabecalhos = await page.locator("main table thead th").evaluateAll((ths) => ths.map((th) => th.innerText.replace(/\s+/g, " ").trim()));
      console.log(`    colunas com "programação": ${cabecalhos.filter((c) => /programa/i.test(c)).map((c) => `"${c}"`).join(" e ") || "nenhuma"} (entre "${cabecalhos[cabecalhos.findIndex((c) => /programa/i.test(c)) - 1]}" e "${cabecalhos[cabecalhos.findIndex((c) => /por programa/i.test(c)) + 1]}")`);
      await ver(page, 'coluna "Programações"', "[data-supplier-table-rounds]");
      await ver(page, 'coluna "Peças por programação"', "[data-supplier-table-per-round]");
      console.log(`    ao passar o mouse nas duas: "${await page.locator("[data-supplier-table-rounds] span").first().getAttribute("title")}"`);
      await capturar("solicitacao-tabela", "[data-supplier-table-per-round]");
      // A caixa do ✓ "Aprovar oferta" (abre e cancela: nada é enviado).
      await page.locator("[data-supplier-table-confirm]").first().click();
      await ver(page, 'caixa do ✓ "Aprovar oferta"', "dialog[open]");
      await page.locator("dialog[open] [data-supplier-table-confirm-cancel]").click();
      console.log("  tela do produto da solicitação:");
      await P.abrirProdutoDaSolicitacao(page, 1);
      await ver(page, 'quadro "Programação de compra"', "[data-purchase-schedule]");
      await campos(page, 'cartão "Resposta do fornecedor"', "[data-supplier-answer-form]");
      await capturar("solicitacao-produto", "[data-purchase-schedule]");
    } },
  { nome: "prog-pai", fluxo: "prog", de: "forn-prog-solicitacao", salva: "forn-prog-pai",
    // O fornecedor responde; aprovação, amostragem, produto e o pedido de compra, que nasce como
    // pedido pai (guarda o total e as programações). Ponto: Die Cut do pai esperando o fornecedor.
    async faz(page) {
      const h = EXTRAS.programada;
      await negociarAteOProduto(page, h);
      const pedido = await P.gerarPedidoPai(page, 1, { confere: confereDoPedido(h) });
      console.log(`  pedido pai #${pedido.numero}: ${pedido.url}`);
      console.log(`    candidata na tela: ${pedido.linha}`);
      console.log(`    programação na candidata: ${pedido.programacao} · campo de quantidade: ${pedido.temCampoDeQuantidade ? "sim" : "não (a quantidade não se ajusta ali)"}`);
      const parceiros = await P.designarParceiros(page, pedido.url);
      console.log(`  parceiros do pedido: ${Object.entries(parceiros).map(([tipo, quem]) => `${tipo}: ${quem}`).join(" · ")}`);
      const r = await P.programacoesDoPedido(page, pedido.url);
      if (r?.linhas.length !== h.programacoes) throw new Error(`pedido pai: esperava ${h.programacoes} programações no cartão, a tela mostra ${r?.linhas.length ?? "nenhum cartão"}`);
    },
    async ve(page, onde, capturar) {
      const pai = onde.pedidos[0];
      console.log(`  pedido pai (${pai}):`);
      await P.abrir(page, pai);
      await ver(page, 'cartão "Programação de compra (pedido pai)"', "[data-order-rounds]");
      await campos(page, "atalho do Die Cut", "[data-die-cut-link]");
      await capturar("pedido-pai", "[data-order-rounds]");
      await P.abrir(page, `${pai}/die-cut`);
      await ver(page, "quadro Die Cut do pai", "[data-die-cut-product]");
      await capturar("die-cut-do-pai");
      await P.abrir(page, `${pai}/purchase-order`);
      const situacao = await page.locator("[data-order-document-status]").getAttribute("data-order-document-status").catch(() => null);
      console.log(`    documento do pedido do pai (${pai}/purchase-order): situação "${situacao}" · ${await linhaDoDocumento(page)}`);
      await capturar("documento-do-pai");
      return { pai };
    } },
  { nome: "prog-nascido", fluxo: "prog", de: "forn-prog-pai", salva: "forn-prog-nascido",
    // O fornecedor faz o Die Cut do pai e os outros papéis concluem as raias: a Preparação do pai
    // conclui e a programação de hoje nasce como pedido filho. Ponto: o filho recém-nascido,
    // antes de a Wellmix gerar o pedido de amostras e assinar o contrato dele (o fornecedor
    // recebe o aviso; não há pendência dele).
    async faz(page) {
      await entrar(page, FORNECEDOR);
      const pai = await P.pedidoUnico(page);
      await concluirPreparacao(page, pai, EXTRAS.programada);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      let r = await P.programacoesDoPedido(page, pai);
      for (const l of r.linhas) console.log(`  pedido pai, programação ${l.programacao}: ${l.texto}${l.filho ? ` → ${l.filho}` : ""}`);
      console.log(`  botão "Gerar as programações do dia" na tela da Wellmix: ${r.podeGerar ? "sim" : "não"}`);
      // A de hoje nasce sozinha quando a Preparação conclui. Se não nasceu e o botão está na
      // tela, a Wellmix clica (é o caminho que o portal oferece); sem botão, para aqui.
      if (!r.linhas[0].filho) {
        if (!r.podeGerar) throw new Error(`pedido pai: a programação 1 não virou pedido e não há o botão de gerar (na tela: ${r.linhas.map((l) => l.texto).join(" / ")})`);
        console.log(`  "Gerar as programações do dia": ${await P.gerarProgramacoesDoDia(page, pai)}`);
        r = await P.programacoesDoPedido(page, pai);
        if (!r.linhas[0].filho) throw new Error(`pedido pai: a programação 1 continua sem pedido filho (na tela: ${r.linhas.map((l) => l.texto).join(" / ")})`);
      }
    },
    async ve(page, onde, capturar) {
      const { pai, filhos, linhas } = await paiEFilhos(page);
      console.log("  lista Pedidos (pai e filho são duas linhas; nada na linha diz qual é qual):");
      for (const p of await P.pedidosDaLista(page)) console.log(`    ${p.url}: ${p.texto}`);
      await capturar("lista-de-pedidos");
      console.log(`  pedido pai (${pai}):`);
      for (const l of linhas) console.log(`    programação ${l.programacao}: ${l.texto}${l.filho ? ` → ${l.filho}` : ""}`);
      await P.abrir(page, pai);
      await capturar("pedido-pai", "[data-order-rounds]");
      console.log(`  pedido filho da programação 1 (${filhos[1]}):`);
      await P.abrir(page, filhos[1]);
      await ver(page, "aviso no alto do filho", "[data-order-round-of]");
      console.log(`    título e etapa: ${(await textoDe(page, "main"))?.match(/Pedido #\d+ \| [^|]+\| [^|]+/)?.[0]}`);
      await capturar("pedido-filho", "[data-order-round-of]");
      await P.abrir(page, `${filhos[1]}/die-cut`);
      await ver(page, "quadro Die Cut do filho (cópia do pai)", "[data-die-cut-product]");
      console.log("  Notificações (sino):");
      await P.abrir(page, "/app/notifications");
      const avisos = await page.locator("main table tbody tr").evaluateAll((trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, " ").trim()).filter((t) => /programação/i.test(t)));
      for (const aviso of avisos) console.log(`    ${aviso}`);
      if (!avisos.length) console.log("    (nenhum aviso cita a programação)");
      await capturar("avisos");
      console.log("  Conta corrente:");
      await P.abrir(page, "/app/account");
      const conta = (await textoDe(page, "main")) ?? "";
      console.log(`    ${conta.match(/TOTAL \| [^|]+\| RECEBIDO \| [^|]+\| SALDO \| [^|]+/)?.[0] ?? "(sem os totais)"}`);
      console.log(`    ${conta.match(/Resumo por pedido.*?(?= \| Histórico)/)?.[0] ?? "(sem o resumo por pedido)"}`);
      await capturar("conta-corrente");
      return { pai, filhos };
    } },
  { nome: "prog-filhos", fluxo: "prog", de: "forn-prog-nascido", salva: "forn-prog-filhos",
    // A Wellmix gera o pedido de amostras do filho e assina o contrato dele. Ponto: o fornecedor
    // com o contrato do primeiro filho para assinar e o pedido de amostras dele para aceitar.
    async faz(page) {
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const { filhos } = await paiEFilhos(page);
      if (!filhos[1]) throw new Error("o pedido filho da programação 1 não está no cartão do pedido pai");
      await amostrasEContratoDaWellmix(page, `${BASE}${filhos[1]}`);
    },
    async ve(page, onde, capturar) {
      const { pai, filhos } = await paiEFilhos(page);
      const filho = filhos[1];
      console.log(`  pedido filho da programação 1 (${filho}):`);
      await P.abrir(page, filho);
      await ver(page, "aviso no alto do filho", "[data-order-round-of]");
      await capturar("pedido-filho", "[data-order-round-of]");
      console.log(`  documento do pedido do filho (${filho}/purchase-order):`);
      await P.abrir(page, `${filho}/purchase-order`);
      console.log(`    vez de assinar: "${await page.locator("[data-order-sign-turn]").getAttribute("data-order-sign-turn").catch(() => null)}" · ${await linhaDoDocumento(page)}`);
      await campos(page, "envio do documento assinado", "[data-order-sign-file]");
      await capturar("contrato-do-filho", "[data-order-sign-file]");
      console.log(`  pedido de amostras do filho (${filho}/samples):`);
      await P.abrir(page, `${filho}/samples`);
      await campos(page, "aceite do pedido de amostras", "form[data-sample-order-accept]");
      await capturar("amostras-do-filho", "form[data-sample-order-accept]");
      console.log(`  pedido pai (${pai}), para comparar:`);
      await P.abrir(page, `${pai}/purchase-order`);
      console.log(`    documento do pedido do pai: situação "${await page.locator("[data-order-document-status]").getAttribute("data-order-document-status").catch(() => null)}" · vez de assinar: ${(await page.locator("[data-order-sign-turn]").count()) ? await page.locator("[data-order-sign-turn]").getAttribute("data-order-sign-turn") : "de ninguém"} · ${await linhaDoDocumento(page)}`);
      await capturar("documento-do-pai");
      return { pai, filhos };
    } },
];

// ------------------------------------------------------------------ execução --

/**
 * Ensaio sem tocar nos pontos em uso: com TREINO_PONTOS_PREFIXO=ensaio- a corrida lê e salva
 * `ensaio-forn-…` no lugar de `forn-…`.
 */
const PREFIXO = process.env.TREINO_PONTOS_PREFIXO ?? "";
const ponto = (nome) => (nome ? `${PREFIXO}${nome}` : nome);

/** Pasta das capturas de tela da conferência (TREINO_CAPTURAS); sem ela, nenhuma é guardada. */
const CAPTURAS = process.env.TREINO_CAPTURAS ? path.resolve(process.env.TREINO_CAPTURAS) : null;

/** Onde ficam anotados os endereços de cada ponto (ids mudam a cada corrida do zero). */
export const ARQUIVO_ENDERECOS = path.join(path.dirname(PLANILHAS), `caminho-fornecedor-extras.${PREFIXO}enderecos.json`);

/** Endereços anotados na última corrida: `{ "<ponto>": { pendencias, solicitacoes, pedidos } }`. */
export const lerEnderecos = () => lerJson(ARQUIVO_ENDERECOS, {});

/**
 * Conferência do ponto: entra como o fornecedor, abre /app e imprime as linhas da tabela de
 * pendências (uma por linha, com o destino do "Abrir") e os endereços da solicitação e dos
 * pedidos. Depois a etapa mostra o que ele vê de diferente do caminho principal (`ve`).
 */
async function conferirPonto(page, etapa) {
  const nome = ponto(etapa.salva) ?? etapa.nome;
  // Captura de tela inteira da tela aberta (do topo, para o cabeçalho fixo não sair no meio) e,
  // com `seletor`, mais uma do cartão (ou da tabela) que contém aquele elemento, legível.
  const capturar = async (tela, seletor = null) => {
    if (!CAPTURAS) return;
    fs.mkdirSync(CAPTURAS, { recursive: true });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(CAPTURAS, `${nome}--${tela}.png`), fullPage: true });
    if (!seletor) return;
    const alvo = page.locator(seletor).first();
    if (!(await alvo.count())) { console.log(`    (captura: "${seletor}" não está na tela ${tela})`); return; }
    // Coluna de tabela larga, que rola para o lado dentro de uma caixa: traz para a vista.
    await alvo.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await page.waitForTimeout(300);
    const cartao = alvo.locator("xpath=ancestor::*[self::section or self::fieldset or contains(@class,'rounded-xl') or contains(@class,'rounded-lg')][1]");
    await ((await cartao.count()) ? cartao : alvo).screenshot({ path: path.join(CAPTURAS, `${nome}--${tela}--detalhe.png`) });
  };
  await entrar(page, FORNECEDOR);
  const linhas = await P.linhasDePendencias(page);
  console.log(`  pendências do fornecedor em ${nome} (${linhas.length}):`);
  for (const linha of linhas) console.log(`    · ${linha}`);
  if (!linhas.length) console.log("    (nenhuma linha na tabela de pendências)");
  await capturar("pendencias");
  const onde = await P.enderecos(page);
  console.log(`  endereços: solicitações ${Object.entries(onde.solicitacoes).map(([n, u]) => `nº ${n} ${u}`).join(" · ") || "—"}`);
  console.log(`             pedidos ${onde.pedidos.join(" · ") || "—"}`);
  const visto = etapa.ve ? await etapa.ve(page, onde, capturar) : null;
  return { pendencias: linhas, ...onde, ...(visto ?? {}) };
}

/** Etapas pedidas: nada = todas; `exw` ou `prog` = o fluxo; `nome` = só ela; `nome..` = dela até o fim do fluxo dela. */
function escolherEtapas(pedido) {
  if (!pedido) return ETAPAS;
  if (ETAPAS.some((e) => e.fluxo === pedido)) return ETAPAS.filter((e) => e.fluxo === pedido);
  const ate = pedido.endsWith("..");
  const i = ETAPAS.findIndex((e) => e.nome === pedido.replace(/\.\.$/, ""));
  if (i < 0) throw new Error(`etapa desconhecida: ${pedido} (existem: ${ETAPAS.map((e) => e.nome).join(", ")}; ou um fluxo inteiro: exw, prog)`);
  return ate ? ETAPAS.slice(i).filter((e) => e.fluxo === ETAPAS[i].fluxo) : [ETAPAS[i]];
}

async function rodar(pedido) {
  const lista = escolherEtapas(pedido);
  const inicio = Date.now();
  for (const etapa of lista) {
    const t0 = Date.now();
    if (etapa.de) await restaurarPonto(ponto(etapa.de)); else await zerarDados();
    const e = await abrirEnsaio();
    try {
      await etapa.faz(e.page);
      if (etapa.salva) salvarPonto(ponto(etapa.salva));
      console.log(`etapa ${etapa.nome} ok · ponto ${ponto(etapa.salva) ?? "(nenhum)"} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      // Conferência só de leitura, depois de salvar: o ponto não leva nada dela.
      const conferido = await conferirPonto(e.page, etapa);
      if (etapa.salva) gravarJson(ARQUIVO_ENDERECOS, { ...lerEnderecos(), [ponto(etapa.salva)]: { em: new Date().toISOString(), ...conferido } });
    } catch (erro) {
      const foto = path.join(path.dirname(new URL(import.meta.url).pathname), `falha-${etapa.nome}.png`);
      await e.page.screenshot({ path: foto, fullPage: true }).catch(() => {});
      console.error(`etapa ${etapa.nome} FALHOU em ${e.page.url()} (tela em ${foto})`);
      throw erro;
    } finally { await e.fechar(); }
  }
  console.log(`${lista.length} etapa(s) em ${((Date.now() - inicio) / 1000).toFixed(0)} s · endereços em ${ARQUIVO_ENDERECOS}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  try { await rodar(process.argv[2]); } finally { pararServidor(); }
}
