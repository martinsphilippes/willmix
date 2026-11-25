// Caminho de dados da trilha do Fornecedor: percorre o fluxo real do portal de treino
// (modo memória, dados fictícios) pelos dois lados, Wellmix e fornecedor, mais os parceiros do
// pedido, e salva um ponto de salvamento no começo de cada cena gravada. Cada etapa parte do
// ponto anterior (`de`), então dá para refazer só uma. Rode de `_pipeline`, num servidor e numa
// pasta de dados à parte da gravação:
//
//   cd treinamentos/_pipeline
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor.mjs               # tudo, do zero
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor.mjs m2-contra     # só essa etapa
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor.mjs m2-contra..   # dessa etapa até o fim
//
//   TREINO_PONTOS_PREFIXO=ensaio- …   # ensaio: lê e salva `ensaio-forn-…`, sem trocar os pontos em uso
//
// Depois de cada etapa o script entra como o fornecedor, abre /app e imprime as pendências dele
// e os endereços das solicitações e do pedido (também anotados em caminho-fornecedor.enderecos.json;
// os ids mudam a cada corrida do zero). Tudo é feito pela tela (`preparo.mjs` e
// `preparo-pedido.mjs`); se o portal recusa um passo, a etapa para com o texto da tela.
//
// As datas e os prazos na tela são relativos ao dia: rode de novo no dia da gravação.
// A história (item, preços, respostas) fica em HISTORIA e tem de bater com o que os vídeos
// mostram: mudou o roteiro de um módulo, mude aqui e refaça dali em diante.
import path from "node:path";
import { BASE, abrirEnsaio, entrar, gravarJson, lerJson, pararServidor, restaurarPonto, salvarPonto, zerarDados } from "../_pipeline/lib.mjs";
import { PLANILHAS, abrirSolicitacao, cambioManual, convidarParaBook, fecharBook, idiomaPortugues, importarBook } from "./preparo.mjs";
import * as P from "./preparo-pedido.mjs";

export const FORNECEDOR = "supplier.a@china.com";
export const OPERADOR = "operador@wellmix.com";
export const ADMIN = "admin@wellmix.com";
/** Quem abriu as solicitações (o Comprador): negocia, aprova e valida a amostragem. */
export const QUEM_NEGOCIA = OPERADOR;
/** Quem cria o produto, gera o pedido de compra, valida e paga (o E2E usa o administrador). */
export const QUEM_GERA_O_PEDIDO = ADMIN;
// Parceiros do pedido (contas de demonstração; mesma senha).
export const AGENCIA_DE_ARTE = "agencia@design.com";
export const CERTIFICADORA = "ocp@certifica.com";
export const AGENCIA_DE_MARKETING = "agencia@marketing.cn";
export const AGENTE_DE_CARGA = "agente@cargo.com";

/** A história da trilha. Os vídeos mostram exatamente estes valores. */
export const HISTORIA = {
  // Solicitação nº 1: o item que vai até o embarque.
  principal: { codigo: "SZ-JR15", nome: "Glass jar 1.5L with lid", busca: "jar", pecas: 2400,
    precisa: "Caixa com a marca Wellmix e tampa na cor preta.",
    book: { preco: "2.10", moeda: "USD", moq: 1200, entrega: "FOB" },
    // Módulo 2: o fornecedor responde pela tela do produto…
    resposta: { preco: "2.25", moq: "1200", prazoDias: "35", obs: "Tampa preta e caixa com a marca: USD 2,25 por peça." },
    // …a Wellmix devolve com contraproposta e o fornecedor aceita.
    contraproposta: { preco: "2.18", prazoDias: "35", comentario: "Fechamos em USD 2,18 com a tampa preta?" } },
  // Solicitação nº 2: o fornecedor aprova a oferta do book como está (ícone ✓).
  aprovada: { codigo: "SZ-CP35", nome: "Glass cup 350ml", busca: "350", precisa: "Copo liso, em caixa colorida com a marca Wellmix." },
  // Solicitação nº 3: o fornecedor recusa (ícone ✕).
  recusada: { codigo: "SZ-BW50", nome: "Glass bowl 500ml", busca: "bowl", precisa: "Tigela com tampa de bambu." },
  convite: { busca: "handle", codigo: "GZ-C300", parceiro: "fornecedor-a", mensagem: "Copo de 300 ml com alça, em caixa colorida.",
    planilha: "book-convite-copo-com-alca.xlsx" },
  // Módulo 2: mensagem do fornecedor na conversa da solicitação nº 1 (com foto).
  mensagem: { texto: "Bom dia! A tampa preta é a deste modelo? Segue a foto de referência.", arquivo: "tampa-preta-referencia.jpg" },
  // Módulo 3: amostragem. A nº 1 é aprovada de primeira; a nº 2 é reprovada e ganha a rodada 2.
  amostragem: {
    principal: { arquivos: ["amostra-3d-frente.jpg", "amostra-3d-tampa.jpg", "amostra-3d-video.mp4"], obs: "Amostra em impressora 3D, com a tampa preta." },
    copo: { rodada1: ["amostra-copo-frente.jpg"], motivoReprovacao: "A foto não mostra a borda do copo. Envie fotos da borda e do fundo.",
      rodada2: ["amostra-copo-borda.jpg"] } },
  // Módulo 4: pedido de compra só com o item principal. Produto criado pela Wellmix com o nome
  // que a tela sugere (o do item do book). Linha do produto: a do E2E do caminho principal
  // (Brinquedos, que exige Inmetro: abre as raias do certificado e da arte final com o selo).
  // "linha-utilidades" é a linha natural de um pote de vidro e não tem essas duas raias.
  produto: { linha: "linha-brinquedos" },
  dieCut: { faca: "faca-caixa-pote-1500ml.pdf", fotoAlta: "foto-alta-pote-1500ml.jpg", moq: "1200", prazoDias: "35" },
  contrato: { arquivo: "contrato-assinado-e-carimbado.pdf", quemAssina: "Li Wei" },
  // O que os outros papéis enviam para o pedido andar (não é cena do fornecedor). Os arquivos
  // saem da mesma pasta: não há arte nem certificado próprios, então vão os que fazem sentido.
  outrosPapeis: {
    ncm: "7013.37.00",
    fichaMestre: { cor: "Transparente", fotos: { weight_scale: "inspecao-na-balanca.jpg", dimension_scale: "inspecao-sem-embalagem.jpg",
      dimension_side: "amostra-3d-frente.jpg", angle: "amostra-3d-tampa.jpg", original: "foto-alta-pote-1500ml.jpg" } },
    arte: "faca-caixa-pote-1500ml.pdf", arteFinal: "faca-caixa-pote-1500ml.pdf",
    certificado: "certificado-iso-9001.pdf", memorial: "certificado-iso-9001.pdf",
    selo: { arquivo: "certificado-iso-9001.pdf", numero: "SELO-2026-0115" },
    contratoWellmix: "contrato-assinado-e-carimbado.pdf",
    // Módulo 6: fotos reais da agência de marketing, o texto da devolução e o número do booking.
    fotosReais: ["foto-alta-pote-1500ml.jpg", "inspecao-sem-embalagem.jpg"],
    devolucaoDaAmostra: "Amostra devolvida à trading", booking: "BKG-2026-0115" },
  // Módulo 5: produção e inspeção (peso igual ao do book: 0,62 kg por peça).
  producao: { tipo: "Fábrica", inicioEmDias: 0, etdEmDias: 35 },
  inspecao: { semEmbalagem: "inspecao-sem-embalagem.jpg", comEmbalagem: "inspecao-com-embalagem.jpg", naBalanca: "inspecao-na-balanca.jpg",
    pesoKg: "0.62", video: "producao-video.mp4",
    reprovacao: { motivo: "Tampa com rebarba em 3 das 20 peças conferidas.", correcao: "Trocamos o molde da tampa e refizemos as peças com rebarba.",
      foto: "inspecao-tampa-corrigida.jpg" } },
  // Módulo 6: amostras do pedido e container na origem.
  amostras: { rastreioBrasil: "784-5521 9034", comprovanteBrasil: "amostras-envio-brasil.pdf",
    rastreioChina: "SF 1029 3847 5566", comprovanteChina: "amostras-envio-china.pdf" },
  container: { numero: "WMXU4829135", vazioFoto: "container-vazio.jpg", vazioVideo: "container-vazio-video.mp4",
    carregamentoFoto: "container-carregamento.jpg", checkDeCarga: "200 caixas, sem avarias.", lacreFoto: "container-lacre.jpg",
    motivoRecusa: "Foto escura: não dá para ver as caixas do fundo." },
  // Módulo 7: documentos de carga (2.400 peças ÷ 12 por caixa = 200 caixas).
  documentos: { caixas: 200, pecas: 2400, pesoLiquidoKg: "1488.00", pesoBrutoKg: "1680.00",
    packingList: "packing-list-PL-2026-0115.pdf", invoiceNumero: "INV-2026-0115", invoice: "invoice-INV-2026-0115.pdf", precoPorPeca: "2.18" },
};

/** "Fornecedor é" do cartão Produção: o texto da HISTORIA → o valor do campo. */
const TIPO_DE_PRODUCAO = { "Fábrica": "factory", "Trade (revenda)": "trade" };

/** Arquivos fictícios enviados nos vídeos (gerados por `_demo/arquivos/gerar_arquivos.py`). */
export const ARQUIVOS = path.join(path.dirname(PLANILHAS), "arquivos");

/** Prazo da negociação em Configurações → SLA: 2 dias, para a tela não nascer "Atrasada"
 *  entre o preparo e a gravação (o padrão do portal é 30 minutos). */
async function prazoDaSolicitacao(page, minutos = 2880) {
  await entrar(page, ADMIN);
  await page.goto(`${BASE}/app/settings`);
  const campo = page.locator('input[name="supplierRequestSlaMinutes"]');
  await campo.fill(String(minutos));
  await campo.evaluate((el) => el.form.requestSubmit());
  await page.waitForURL(/\/app\/settings\?ok=1/);
}

/** O fornecedor envia o book do convite (o que o Módulo 1 mostra). */
async function responderConvite(page) {
  await entrar(page, FORNECEDOR);
  await page.goto(`${BASE}/app/supplier-requests/invites`);
  await page.locator("main table tbody tr a").first().click();
  await page.waitForURL(/\/app\/supplier-requests\/invites\/[^/?]+/);
  await page.locator("[data-booking-invite-answer-form] input[type=file]").setInputFiles(path.join(PLANILHAS, HISTORIA.convite.planilha));
  await page.click("[data-booking-invite-answer-submit]");
  await page.waitForURL(/answered=1/);
}

/** Etapas na ordem. `de`: ponto de partida (null = banco zerado). `salva`: ponto que deixa pronto. */
export const ETAPAS = [
  { nome: "m2-base", de: null, salva: "forn-m2-base",
    // Fim do Módulo 1 (convite respondido) + as três solicitações que o Módulo 2 responde.
    async faz(page) {
      await cambioManual(page);
      await prazoDaSolicitacao(page);
      await idiomaPortugues(page, FORNECEDOR);
      await entrar(page, OPERADOR);
      await importarBook(page, "book-guangzhou-supplier-b.xlsx");
      await fecharBook(page);
      await importarBook(page, "book-shenzhen-supplier-a.xlsx");
      await fecharBook(page);
      const h = HISTORIA;
      await abrirSolicitacao(page, h.principal.busca, h.principal.codigo, h.principal.precisa);
      await convidarParaBook(page, h.convite.busca, h.convite.codigo, h.convite.parceiro, h.convite.mensagem);
      await responderConvite(page);
      await entrar(page, OPERADOR);
      // A cesta da Seleção de itens fica guardada na aba e não esvazia depois de "Agrupar":
      // sem o "Limpar", a nº 2 nascia com os potes de alternativa e a nº 3 com os potes e o copo.
      for (const item of [h.aprovada, h.recusada]) {
        const sobrava = await P.esvaziarCesta(page);
        await abrirSolicitacao(page, item.busca, item.codigo, item.precisa);
        console.log(`  solicitação do ${item.codigo}: a cesta guardava ${sobrava} item(ns) do grupo anterior (limpa antes) · alternativas na tela: ${await page.locator("[data-supplier-request-alternative]").count()}`);
      }
    } },
  { nome: "m2-contra", de: "forn-m2-base", salva: "forn-m2-contra",
    // Módulo 2: o fornecedor responde as três solicitações e conversa; a Wellmix devolve a nº 1
    // com contraproposta. Ponto: a contraproposta esperando o fornecedor.
    async faz(page) {
      const h = HISTORIA;
      await entrar(page, FORNECEDOR);
      await P.responderPelaTelaDoProduto(page, 1, { faz: true, ...h.principal.resposta, moeda: h.principal.book.moeda, entrega: h.principal.book.entrega });
      await P.mandarMensagemNaConversa(page, 1, h.mensagem.texto, h.mensagem.arquivo);
      await P.aprovarOfertaNaTabela(page, 2);
      await P.recusarOfertaNaTabela(page, 3);
      await entrar(page, QUEM_NEGOCIA);
      await P.devolverComContraproposta(page, 1, { ...h.principal.contraproposta, entrega: h.principal.book.entrega });
    } },
  { nome: "m3-base", de: "forn-m2-contra", salva: "forn-m3-base",
    // O fornecedor aceita a contraproposta; a Wellmix aprova a nº 1 e a nº 2. Ponto: amostragem
    // das duas esperando o fornecedor.
    async faz(page) {
      await entrar(page, FORNECEDOR);
      await P.aceitarContraproposta(page, 1);
      await entrar(page, QUEM_NEGOCIA);
      await P.aprovarSolicitacao(page, 1);
      await P.aprovarSolicitacao(page, 2);
    } },
  { nome: "m3-reprovada", de: "forn-m3-base", salva: "forn-m3-reprovada",
    // Módulo 3: o fornecedor envia as duas amostragens; a Wellmix aprova a da nº 1 e reprova a
    // da nº 2. Ponto: rodada 2 da nº 2 por enviar.
    async faz(page) {
      const a = HISTORIA.amostragem;
      await entrar(page, FORNECEDOR);
      await P.enviarAmostragem(page, 1, a.principal.arquivos, a.principal.obs);
      await P.enviarAmostragem(page, 2, a.copo.rodada1);
      await entrar(page, QUEM_NEGOCIA);
      await P.validarAmostragem(page, 1, { aprova: true });
      await P.validarAmostragem(page, 2, { aprova: false, motivo: a.copo.motivoReprovacao });
    } },
  { nome: "m4-diecut", de: "forn-m3-reprovada", salva: "forn-m4-diecut",
    // O fornecedor envia a rodada 2 da nº 2 (fica esperando a validação). A Wellmix cria o
    // produto da nº 1 e gera o pedido de compra só com ele. Ponto: Die Cut esperando o fornecedor.
    async faz(page) {
      const h = HISTORIA;
      await entrar(page, FORNECEDOR);
      await P.enviarAmostragem(page, 2, h.amostragem.copo.rodada2);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      // O combinado (contraproposta aceita) tem de estar na tela do produto e na linha do pedido.
      const c = { preco: h.principal.contraproposta.preco, moeda: h.principal.book.moeda, entrega: h.principal.book.entrega,
        moq: h.principal.resposta.moq, prazo: h.principal.contraproposta.prazoDias };
      const produto = await P.criarProdutoDaSolicitacao(page, 1, { linha: h.produto.linha,
        condicoes: [`${c.preco} ${c.moeda}`, c.entrega, `MOQ ${c.moq}`, `${c.prazo} dias`] });
      console.log(`  produto criado: ${produto.produto} · condições na tela: ${produto.combinado}`);
      for (const item of produto.ligados) console.log(`    item de book ligado: ${item}`);
      const pedido = await P.gerarPedidoDeCompra(page, [1], { quantidades: { 1: h.principal.pecas },
        confere: { 1: [`${P.numeroPt(c.preco)} ${c.moeda}`, Number(c.moq).toLocaleString("pt-BR"), c.prazo] } });
      console.log(`  pedido de compra #${pedido.numero}: ${pedido.url} · ${pedido.marcadas.join(" / ")}`);
      const parceiros = await P.designarParceiros(page, pedido.url);
      console.log(`  parceiros do pedido: ${Object.entries(parceiros).map(([tipo, quem]) => `${tipo}: ${quem}`).join(" · ")}`);
    } },
  { nome: "m4-contrato", de: "forn-m4-diecut", salva: "forn-m4-contrato",
    // O fornecedor faz o Die Cut; cadastro, agência de arte e certificadora concluem as raias; a
    // Wellmix gera o pedido de amostras e sobe o contrato assinado por ela. Ponto: o fornecedor
    // com o contrato para assinar e o pedido de amostras para aceitar.
    async faz(page) {
      const h = HISTORIA, o = h.outrosPapeis;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      const dieCut = await P.fazerDieCut(page, pedido, h.dieCut);
      console.log(`  Die Cut: campos vieram com ${dieCut.veio.moq} peças e ${dieCut.veio.prazoDias} dias · confirmado: ${dieCut.confirmado}`);
      // Cadastro e fiscal (Wellmix): NCM validado e ficha mestre completa.
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const fiscal = await P.validarNcmDoProduto(page, pedido, o.ncm);
      if (fiscal.feito) await P.completarFichaMestre(page, fiscal.produto, o.fichaMestre);
      // Aprovações do mapa (GP: cadastro e fiscal; Comprador: material de arte): sem elas a Arte não abre.
      console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
      // Agência de arte: a arte (sobre a faca e a foto em alta).
      await entrar(page, AGENCIA_DE_ARTE);
      await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/^Arte ·/.test(r) ? { arquivo: o.arte } : null)));
      // Wellmix: valida a arte.
      await entrar(page, QUEM_GERA_O_PEDIDO);
      await P.validarArte(page, pedido);
      // Certificadora: certificado das raias e, no cartão Certificação, o memorial e o selo.
      await entrar(page, CERTIFICADORA);
      const certificados = await mostrar("certificadora", P.preencherItensDoPedido(page, pedido, (r) => (/^Certificado/.test(r) ? { arquivo: o.certificado } : null)));
      if (certificados.length) {
        const docs = await P.enviarDocumentosDaCertificacao(page, pedido, { cert_memorial: { arquivo: o.memorial }, cert_seal: { arquivo: o.selo.arquivo, valor: o.selo.numero } });
        console.log(`  certificação: ${docs.join(" · ")}`);
      } else console.log("  certificação: a linha do produto não exige certificado; memorial e selo não foram enviados");
      // GP aprova a certificação (libera o selo na arte).
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
      // Agência de arte: a arte final com o selo.
      await entrar(page, AGENCIA_DE_ARTE);
      await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/Arte final com o selo/.test(r) ? { arquivo: o.arteFinal } : null)));
      // Agência de arte: a arte com o selo aplicado (cartão Certificação); a Wellmix valida. Desde a
      // Fase 5g dos marcos o marco Certificação só conclui com esse passo, e o contrato espera por ele.
      console.log(`  selo aplicado na arte: ${(await P.enviarSeloAplicado(page, pedido, o.arteFinal))?.texto}`);
      // Wellmix: pedido de amostras e a assinatura dela no contrato.
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  selo aplicado na arte, depois da Wellmix: ${(await P.decidirSeloAplicado(page, pedido, { valida: true }))?.texto}`);
      console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
      console.log(`  pedido de amostras gerado: ${await P.gerarPedidoDeAmostras(page, pedido)} peças`);
      console.log(`  contrato depois da assinatura da Wellmix: ${await P.assinarContrato(page, pedido, "wellmix", { arquivo: o.contratoWellmix })}`);
    } },
  { nome: "m4-pagamento", de: "forn-m4-contrato", salva: "forn-m4-pagamento",
    // O fornecedor assina o contrato e aceita o pedido de amostras; a Wellmix registra o
    // pagamento do sinal. Ponto: "Confirmar recebimento" esperando o fornecedor na Conta corrente.
    async faz(page) {
      const h = HISTORIA;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      console.log(`  contrato depois da assinatura do fornecedor: ${await P.assinarContrato(page, pedido, "supplier", { nome: h.contrato.quemAssina, arquivo: h.contrato.arquivo })}`);
      await P.aceitarPedidoDeAmostras(page, pedido, h.contrato.quemAssina);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const sinal = await P.registrarPagamentoDoSinal(page, pedido);
      console.log(`  sinal: condição "${sinal.condicao}" · parcela 1 ficou "${sinal.situacao}"`);
      console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
    } },
  { nome: "m5-base", de: "forn-m4-pagamento", salva: "forn-m5-base",
    // O fornecedor confirma o recebimento do sinal; a Wellmix confirma as aprovações liberadas: o
    // sinal (Diretoria de compras) e a pré-produção (Planner). Desde a Fase 5g dos marcos, sem elas
    // a Inspeção não abre; a do Planner não espera dado nenhum do fornecedor. Ponto: a pendência
    // "Inspeção" do fornecedor e o cartão Produção por preencher.
    async faz(page) {
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await P.confirmarRecebimento(page, await P.numeroDoPedido(page, pedido));
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  aprovações da Wellmix: ${(await P.confirmarAprovacoes(page, pedido)).join(" · ") || "nenhuma liberada"}`);
    } },
  { nome: "m5-enviado", de: "forn-m5-base", salva: "forn-m5-enviado",
    // Módulo 5 (ponto intermediário, sem cena): o fornecedor preenche o cartão Produção, envia
    // as fotos, o peso e o vídeo da inspeção e faz a declaração de conformidade.
    async faz(page) {
      const h = HISTORIA, i = h.inspecao;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      const producao = await P.salvarProducao(page, pedido, { tipo: TIPO_DE_PRODUCAO[h.producao.tipo],
        inicio: P.dataEmDias(h.producao.inicioEmDias), etd: P.dataEmDias(h.producao.etdEmDias) });
      console.log(`  produção: início ${producao.antes.inicioAutomatico ? "automático (campo fechado)" : "digitado"} ${producao.depois.inicio} · ETD ${producao.depois.etd} · ${producao.depois.tipo}`);
      const respostas = [
        [/^Foto sem embalagem/, { arquivo: i.semEmbalagem }], [/^Foto com embalagem/, { arquivo: i.comEmbalagem }],
        [/^Foto na balança/, { arquivo: i.naBalanca }], [/^Peso medido/, { valor: i.pesoKg }],
        [/^Vídeo da produção/, { arquivo: i.video }], [/^Produto conforme o pedido/, { confirma: true }],
      ];
      // Item obrigatório fora da lista (não esperado): para aqui, para a história não ganhar valor inventado.
      await mostrar("fornecedor (inspeção)", P.preencherItensDoPedido(page, pedido, (r) => {
        const achou = respostas.find(([rotulo]) => rotulo.test(r));
        if (!achou) throw new Error(`inspeção: item obrigatório sem valor na HISTORIA: "${r}"`);
        return achou[1];
      }));
    } },
  { nome: "m5-reprovado", de: "forn-m5-enviado", salva: "forn-m5-reprovado",
    // Ramo lateral (termina aqui): a Wellmix reprova o SKU. Ponto: "Corrigir SKU reprovado".
    async faz(page) {
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const sku = await P.inspecionarSku(page, pedido, "rejected", HISTORIA.inspecao.reprovacao.motivo);
      console.log(`  SKU: ${sku.antes} → ${sku.depois}`);
    } },
  { nome: "m6-amostras", de: "forn-m5-enviado", salva: "forn-m6-amostras",
    // Caminho principal: a Wellmix aprova o SKU. Ponto: cartão Amostras esperando o fornecedor.
    async faz(page) {
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await entrar(page, QUEM_GERA_O_PEDIDO);
      const sku = await P.inspecionarSku(page, pedido, "approved");
      console.log(`  SKU: ${sku.antes} → ${sku.depois}`);
    } },
  { nome: "m6-devolucao", de: "forn-m6-amostras", salva: "forn-m6-devolucao",
    // Módulo 6: o fornecedor registra a retirada e os dois envios das amostras; a agência de
    // marketing recebe, manda as fotos reais (a Wellmix aprova) e devolve a amostra. Ponto: o
    // fornecedor com "Amostra devolvida à trading" para validar.
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
    } },
  { nome: "m6-container", de: "forn-m6-devolucao", salva: "forn-m6-container",
    // O fornecedor valida a devolução; o agente de carga envia o booking (reserva no navio) e a
    // Wellmix valida. Ponto: "Container vazio no depósito da fábrica" esperando o fornecedor.
    async faz(page) {
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      console.log(`  samples_returned: ${(await P.validarPasso(page, pedido, "samples-flow", "samples_returned")).texto}`);
      await entrar(page, AGENTE_DE_CARGA);
      await passo(page, pedido, "import-flow", "booking", { valor: HISTORIA.outrosPapeis.booking });
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  booking: ${(await P.validarPasso(page, pedido, "import-flow", "booking")).texto}`);
    } },
  { nome: "m7-base", de: "forn-m6-container", salva: "forn-m7-base",
    // O fornecedor registra o container vazio na fábrica e as fotos dele. Ponto: documentos do
    // embarque abertos (check list de carga por fazer) e o passo Carregamento esperando.
    async faz(page) {
      const c = HISTORIA.container;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await passo(page, pedido, "container-origin", "container_at_factory", { valor: P.dataEmDias(0) });
      // O passo guarda um arquivo só ("Enviar de novo" troca o anterior): vai a foto. O vídeo
      // (c.vazioVideo) fica para a cena mostrar o "Enviar de novo", se o roteiro quiser.
      await passo(page, pedido, "container-origin", "container_empty", { arquivo: c.vazioFoto });
    } },
  { nome: "m6-lacre", de: "forn-m7-base", salva: "forn-m6-lacre",
    // Ramo lateral para a cena do lacre (Módulo 6): o fornecedor envia o carregamento e a
    // Wellmix valida. Ponto: lacre e container no porto por enviar; documentos ainda por fazer.
    async faz(page) {
      const c = HISTORIA.container;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await passo(page, pedido, "container-origin", "container_loaded", { valor: c.checkDeCarga, arquivo: c.carregamentoFoto });
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  container_loaded: ${(await P.validarPasso(page, pedido, "container-origin", "container_loaded")).texto}`);
    } },
  { nome: "m6-recusado", de: "forn-m7-base", salva: "forn-m6-recusado",
    // Ramo lateral para a cena "Cuidado" do carregamento (Módulo 6): o fornecedor envia o
    // carregamento e a Wellmix recusa com o motivo. Ponto: carregamento recusado, por reenviar.
    async faz(page) {
      const c = HISTORIA.container;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      await passo(page, pedido, "container-origin", "container_loaded", { valor: c.checkDeCarga, arquivo: c.carregamentoFoto });
      await entrar(page, QUEM_GERA_O_PEDIDO);
      await P.abrir(page, `${pedido}#container-origin`);
      const linha = page.locator("#container-origin-step-container_loaded");
      await linha.locator('input[name="reason"]').fill(c.motivoRecusa);
      await P.concluir(page, /[?&]importStep=/, "recusar o carregamento", () => linha.locator('[data-import-reject="container_loaded"]').click());
      console.log(`  container_loaded (Wellmix): ${(await page.locator("#container-origin-step-container_loaded").innerText()).replace(/\s+/g, " ").trim()}`);
    } },
  { nome: "fim", de: "forn-m7-base", salva: "forn-fim",
    // Módulo 7 e o fim do Módulo 6: check list de carga, packing list e invoice; carregamento
    // (a Wellmix valida), lacre e container no porto. Ponto: tudo do fornecedor feito até o embarque.
    async faz(page) {
      const c = HISTORIA.container, d = HISTORIA.documentos;
      await entrar(page, FORNECEDOR);
      const pedido = await P.pedidoUnico(page);
      console.log(`  check list de carga: ${await P.registrarCaixasCarregadas(page, pedido, d.caixas)}`);
      const packing = await P.enviarPackingList(page, pedido, { pecas: d.pecas, pesoLiquidoKg: d.pesoLiquidoKg, pesoBrutoKg: d.pesoBrutoKg, arquivo: d.packingList });
      console.log(`  packing list: ${packing.situacao} · os campos vieram com ${JSON.stringify(packing.veio)}`);
      const invoice = await P.enviarInvoice(page, pedido, { numero: d.invoiceNumero, caixas: d.caixas, pecas: d.pecas, pesoLiquidoKg: d.pesoLiquidoKg,
        pesoBrutoKg: d.pesoBrutoKg, precoPorPeca: d.precoPorPeca, arquivo: d.invoice });
      console.log(`  invoice: ${invoice.situacao} · os campos vieram com ${JSON.stringify(invoice.veio)}`);
      await passo(page, pedido, "container-origin", "container_loaded", { valor: c.checkDeCarga, arquivo: c.carregamentoFoto });
      await entrar(page, QUEM_GERA_O_PEDIDO);
      console.log(`  container_loaded: ${(await P.validarPasso(page, pedido, "container-origin", "container_loaded")).texto}`);
      await entrar(page, FORNECEDOR);
      await passo(page, pedido, "container-origin", "container_sealed", { valor: c.numero, arquivo: c.lacreFoto });
      await passo(page, pedido, "container-origin", "container_at_port", { valor: P.dataEmDias(0) });
      console.log(`  documentos do embarque: ${JSON.stringify(await P.situacaoDosDocumentos(page, pedido))}`);
    } },
];

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

// ------------------------------------------------------------------ execução --

/**
 * Ensaio sem tocar nos pontos em uso: com TREINO_PONTOS_PREFIXO=ensaio- a corrida lê e salva
 * `ensaio-forn-…` no lugar de `forn-…` (a gravação de outro módulo segue com os pontos dela).
 */
const PREFIXO = process.env.TREINO_PONTOS_PREFIXO ?? "";
const ponto = (nome) => (nome ? `${PREFIXO}${nome}` : nome);

/** Onde ficam anotados os endereços de cada ponto (ids mudam a cada corrida do zero). */
export const ARQUIVO_ENDERECOS = path.join(path.dirname(PLANILHAS), `caminho-fornecedor.${PREFIXO}enderecos.json`);

/** Endereços anotados na última corrida: `{ "<ponto>": { solicitacoes: { "1": "/app/…" }, pedidos: [...] } }`. */
export const lerEnderecos = () => lerJson(ARQUIVO_ENDERECOS, {});

/**
 * Conferência do ponto: entra como o fornecedor, abre /app e imprime as linhas da tabela de
 * pendências (uma por linha) e os endereços das solicitações e do pedido.
 */
async function conferirPonto(page, etapa) {
  await entrar(page, FORNECEDOR);
  const linhas = await P.linhasDePendencias(page);
  console.log(`  pendências do fornecedor em ${ponto(etapa.salva) ?? etapa.nome} (${linhas.length}):`);
  for (const linha of linhas) console.log(`    · ${linha}`);
  if (!linhas.length) console.log("    (nenhuma linha na tabela de pendências)");
  const onde = await P.enderecos(page);
  console.log(`  endereços: solicitações ${Object.entries(onde.solicitacoes).map(([n, u]) => `nº ${n} ${u}`).join(" · ") || "—"}`);
  console.log(`             pedidos ${onde.pedidos.join(" · ") || "—"}`);
  return { pendencias: linhas, ...onde };
}

async function rodar(pedido) {
  let lista = ETAPAS;
  if (pedido) {
    const ate = pedido.endsWith("..");
    const i = ETAPAS.findIndex((e) => e.nome === pedido.replace(/\.\.$/, ""));
    if (i < 0) throw new Error(`etapa desconhecida: ${pedido} (existem: ${ETAPAS.map((e) => e.nome).join(", ")})`);
    lista = ate ? ETAPAS.slice(i) : [ETAPAS[i]];
  }
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
