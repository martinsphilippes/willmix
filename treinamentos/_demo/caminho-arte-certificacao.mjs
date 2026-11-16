// Caminho de dados das trilhas da Agência de arte e da Certificadora (OCP): continua o caminho
// do Fornecedor a partir do pedido de compra #1 (ponto `forn-m4-diecut`, a mesma história: o
// pote SZ-JR15, 2.400 peças) e salva um ponto de salvamento no começo de cada cena gravada.
// Tudo é feito pela tela, como cada papel faria; se o portal recusa um passo, a etapa para.
//
//   cd treinamentos/_pipeline
//   # uma vez, antes: o caminho do Fornecedor até o pedido de compra
//   for e in m2-base m2-contra m3-base m3-reprovada m4-diecut; do TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-fornecedor.mjs $e; done
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-arte-certificacao.mjs             # tudo
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-arte-certificacao.mjs arte-final  # só essa etapa
//   TREINO_PORTA=3201 TREINO_DADOS=.data-caminho node ../_demo/caminho-arte-certificacao.mjs arte-final.. # dessa em diante
//
// As datas e os prazos na tela são relativos ao dia: rode de novo no dia da gravação.
import path from "node:path";
import { BASE, DEMO, abrirEnsaio, entrar, gravarJson, lerJson, pararServidor, restaurarPonto, salvarPonto } from "../_pipeline/lib.mjs";
import { ADMIN, AGENCIA_DE_ARTE, CERTIFICADORA, FORNECEDOR, HISTORIA as H } from "./caminho-fornecedor.mjs";
import * as P from "./preparo-pedido.mjs";

/** O que a agência e a certificadora enviam nos vídeos (arquivos de `_demo/arquivos/`). */
export const ARTE = {
  arte: "arte-caixa-pote-1500ml.pdf",
  motivoDevolucao: "A marca Wellmix precisa ficar maior na frente da caixa. Aumente a marca e envie de novo.",
  arteV2: "arte-caixa-pote-1500ml-v2.pdf",
  arteFinal: "arte-final-com-selo-pote-1500ml.pdf",
  seloAplicado: "arte-final-com-selo-pote-1500ml.pdf",
  // Sem ponto no fim: o aviso do portal acrescenta ". Corrija e envie de novo." depois do motivo.
  motivoRecusaDoSelo: "O selo ficou sobre o código de barras. Mova o selo para a lateral",
  naoConformidade: "O código de barras está sem a margem branca dos dois lados.",
  correcao: { texto: "Margem branca do código de barras ajustada dos dois lados.", arquivo: "arte-corrigida-pote-1500ml.pdf" },
};
export const CERT = {
  certificado: "certificado-de-conformidade-pote-1500ml.pdf",
  memorial: "memorial-descritivo-pote-1500ml.pdf",
  selo: { arquivo: "selo-de-certificacao-pote-1500ml.png", numero: "SELO-2026-0115" },
  seloNovo: "selo-de-certificacao-pote-1500ml-v2.png",
};

const PRODUTO = H.principal.nome;

/** Imprime o que um papel preencheu na tela do pedido. */
async function mostrar(quem, promessa) {
  const { feitos, pulados } = await promessa;
  console.log(`  ${quem} preencheu: ${feitos.join(" · ") || "nada"}${pulados.length ? ` (não mexeu em: ${pulados.join(" · ")})` : ""}`);
  return feitos;
}

/** Wellmix: confirma uma aprovação de fim de marco ("… aprovado pelo …") na tela do pedido. */
async function aprovar(page, pedido, rotulo) {
  await mostrar("Wellmix (aprovação)", P.preencherItensDoPedido(page, pedido, (r) => (rotulo.test(r) ? { confirma: true } : null)));
}

/** Wellmix: devolve a arte enviada, com o motivo (item "Validação da arte pela Wellmix"). */
async function devolverArte(page, pedido, motivo) {
  await P.abrir(page, pedido);
  const linha = P.itemDaEtapa(page, /Validação da arte pela Wellmix/).first();
  const reprovar = linha.locator("button[value=reject]");
  if (!(await reprovar.count())) throw new Error(`devolver a arte: sem o botão de reprovar (na tela: ${(await linha.innerText().catch(() => "sem a linha")).replace(/\s+/g, " ")})`);
  await linha.locator("input[name=note]").fill(motivo);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), reprovar.click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await P.pararSeErro(page, "devolver a arte");
}

/** Linha de um passo do cartão Certificação, como a tela mostra. */
async function passoDaCertificacao(page, pedido, chave) {
  await P.abrir(page, `${pedido}#certification`);
  const linha = page.locator(`#certification-step-${chave}`);
  if (!(await linha.count())) return null;
  return { situacao: await linha.getAttribute("data-import-status"), texto: (await linha.innerText()).replace(/\s+/g, " ").trim() };
}

/** Quem faz a arte: envia a arte com o selo aplicado (passo "Selo aplicado na arte"). */
async function enviarSeloAplicado(page, pedido, arquivo) {
  await P.abrir(page, `${pedido}#certification`);
  const linha = page.locator("#certification-step-cert_seal_art");
  const botao = linha.locator('[data-import-submit="cert_seal_art"]');
  if (!(await botao.count())) throw new Error(`selo aplicado na arte: este login não tem o "Enviar" (na tela: ${(await passoDaCertificacao(page, pedido, "cert_seal_art"))?.texto ?? "o passo não aparece"})`);
  await linha.locator("input[type=file]").setInputFiles(P.arquivo(arquivo));
  await P.concluir(page, /[?&]certStep=submitted/, "enviar a arte com o selo aplicado", () => botao.click());
  return passoDaCertificacao(page, pedido, "cert_seal_art");
}

/** Wellmix: valida ou recusa (com o motivo) a arte com o selo aplicado. */
async function decidirSeloAplicado(page, pedido, { valida, motivo = null }) {
  await P.abrir(page, `${pedido}#certification`);
  const linha = page.locator("#certification-step-cert_seal_art");
  const botao = linha.locator(valida ? '[data-import-validate="cert_seal_art"]' : '[data-import-reject="cert_seal_art"]');
  if (!(await botao.count())) throw new Error(`selo aplicado na arte: este login não tem o botão de ${valida ? "validar" : "recusar"} (na tela: ${(await passoDaCertificacao(page, pedido, "cert_seal_art"))?.texto})`);
  if (!valida) await linha.locator('input[name="reason"]').fill(motivo);
  await P.concluir(page, /[?&]certStep=/, `${valida ? "validar" : "recusar"} a arte com o selo`, () => botao.click());
  return passoDaCertificacao(page, pedido, "cert_seal_art");
}

/** Wellmix: aponta uma não conformidade da arte num item do pedido (cartão Artes). */
async function apontarNaoConformidade(page, pedido, nota) {
  await P.abrir(page, `${pedido}#artwork`);
  const botao = page.locator("[data-artwork-report]");
  if (!(await botao.count())) throw new Error("cartão Artes: este login não tem o formulário de não conformidade");
  const form = botao.locator("xpath=ancestor::form[1]");
  // O formulário vem recolhido ("Apontar não conformidade"): abre como quem toca no título.
  await form.evaluate((el) => { for (let d = el.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true; });
  await form.locator('[name="orderItemId"]').selectOption({ index: 0 }).catch(() => {});
  await form.locator('[name="note"]').fill(nota);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), botao.click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await P.pararSeErro(page, "apontar a não conformidade");
  return (await page.locator("[data-artwork-issue]").allInnerTexts()).map((x) => x.replace(/\s+/g, " "));
}

/** Quem está logado marca os avisos como lidos (o botão "✓ N" de Notificações), como faz quem
 *  já resolveu o que eles pediam: assim o sino de cada cena mostra só o aviso novo. */
async function lerAvisos(page) {
  await P.abrir(page, "/app/notifications");
  const botao = page.locator('button[aria-label^="Marcar todas como lidas"]');
  if (!(await botao.count())) return;
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), botao.first().click()]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Pedidos que o login atual enxerga (endereços do detalhe). */
async function pedidosDaLista(page) {
  await P.abrir(page, "/app/orders");
  return page.locator('main a[href^="/app/orders/"]').evaluateAll((links) =>
    [...new Set(links.map((a) => a.getAttribute("href").match(/^\/app\/orders\/[^/?#]+/)?.[0]).filter(Boolean))]);
}

/** Endereço do pedido único, visto por quem está logado. */
const pedidoDe = async (page, email) => {
  await entrar(page, email);
  const pedidos = await pedidosDaLista(page);
  if (pedidos.length !== 1) throw new Error(`esperava 1 pedido na lista de ${email}, achei ${pedidos.length}`);
  return `${BASE}${pedidos[0]}`;
};

export const ETAPAS = [
  { nome: "cert-base", de: "forn-m4-diecut", salva: "cert-base",
    // O pedido de compra acabou de nascer, com a certificadora designada. O cadastro da Wellmix
    // valida o NCM e completa a ficha do produto (as fotos que a certificadora vê nos itens do
    // pedido). Ponto: o certificado do produto, o memorial e o selo esperando a certificadora.
    async faz(page) {
      const pedido = await pedidoDe(page, CERTIFICADORA);
      await entrar(page, ADMIN);
      const fiscal = await P.validarNcmDoProduto(page, pedido, H.outrosPapeis.ncm);
      if (fiscal.feito) await P.completarFichaMestre(page, fiscal.produto, H.outrosPapeis.fichaMestre);
    } },
  { nome: "arte-base", de: "forn-m4-diecut", salva: "arte-base",
    // O fornecedor faz o Die Cut (faca, foto em alta, pedido mínimo e prazo); o cadastro da
    // Wellmix valida o NCM e completa a ficha. Ponto: a arte liberada para a agência; o
    // certificado, o selo e o memorial esperando a certificadora desde que o pedido nasceu.
    async faz(page) {
      const pedido = await pedidoDe(page, FORNECEDOR);
      const dieCut = await P.fazerDieCut(page, pedido, H.dieCut);
      console.log(`  Die Cut confirmado: ${dieCut.confirmado}`);
      await entrar(page, ADMIN);
      const fiscal = await P.validarNcmDoProduto(page, pedido, H.outrosPapeis.ncm);
      if (fiscal.feito) await P.completarFichaMestre(page, fiscal.produto, H.outrosPapeis.fichaMestre);
      // As aprovações do fim dos marcos (docs/MILESTONES.md): o cadastro, pelo GP, e o material
      // de arte, pelo Comprador. Sem a segunda, o marco Arte não libera para a agência.
      await aprovar(page, pedido, /^Cadastro e fiscal aprovados/);
      await aprovar(page, pedido, /^Material de arte aprovado/);
    } },
  { nome: "arte-devolvida", de: "arte-base", salva: "arte-devolvida",
    // A agência envia a primeira versão da arte e a Wellmix devolve com o motivo.
    // Ponto: a arte reprovada, com o motivo, esperando a agência.
    async faz(page) {
      const pedido = await pedidoDe(page, AGENCIA_DE_ARTE);
      await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/^Arte ·/.test(r) ? { arquivo: ARTE.arte } : null)));
      await lerAvisos(page);
      await entrar(page, ADMIN);
      await devolverArte(page, pedido, ARTE.motivoDevolucao);
    } },
  { nome: "arte-final", de: "arte-devolvida", salva: "arte-final",
    // A agência envia a versão 2 e a Wellmix valida. A certificadora envia o certificado do
    // produto, o memorial e o selo; o GP aprova a certificação. Ponto: a agência com a arte
    // final com o selo e o "Selo aplicado na arte" para enviar.
    async faz(page) {
      const pedido = await pedidoDe(page, AGENCIA_DE_ARTE);
      await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/^Arte ·/.test(r) ? { arquivo: ARTE.arteV2 } : null)));
      await lerAvisos(page);
      await entrar(page, ADMIN);
      await P.validarArte(page, pedido);
      await entrar(page, CERTIFICADORA);
      await mostrar("certificadora", P.preencherItensDoPedido(page, pedido, (r) => (/^Certificado/.test(r) ? { arquivo: CERT.certificado } : null)));
      const docs = await P.enviarDocumentosDaCertificacao(page, pedido, { cert_memorial: { arquivo: CERT.memorial }, cert_seal: { arquivo: CERT.selo.arquivo, valor: CERT.selo.numero } });
      console.log(`  certificação: ${docs.join(" · ")}`);
      await entrar(page, ADMIN);
      await aprovar(page, pedido, /^Certificação aprovada/);
    } },
  { nome: "arte-selo-recusado", de: "arte-final", salva: "arte-selo-recusado",
    // A agência envia a arte final (item do marco Arte) e a arte com o selo aplicado (cartão
    // Certificação); a Wellmix recusa a segunda, com o motivo. Ponto: "Recusado" esperando a agência.
    async faz(page) {
      const pedido = await pedidoDe(page, AGENCIA_DE_ARTE);
      await mostrar("agência de arte", P.preencherItensDoPedido(page, pedido, (r) => (/Arte final com o selo/.test(r) ? { arquivo: ARTE.arteFinal } : null)));
      console.log(`  selo aplicado na arte: ${(await enviarSeloAplicado(page, pedido, ARTE.seloAplicado))?.texto}`);
      await lerAvisos(page);
      await entrar(page, ADMIN);
      console.log(`  depois da recusa: ${(await decidirSeloAplicado(page, pedido, { valida: false, motivo: ARTE.motivoRecusaDoSelo }))?.texto}`);
    } },
  { nome: "arte-correcao", de: "arte-selo-recusado", salva: "arte-correcao",
    // A agência reenvia a arte com o selo e a Wellmix valida; depois a Wellmix aponta uma não
    // conformidade na arte do item (cartão Artes). Ponto: "Corrigir a arte" esperando a agência.
    async faz(page) {
      const pedido = await pedidoDe(page, AGENCIA_DE_ARTE);
      console.log(`  selo aplicado na arte (de novo): ${(await enviarSeloAplicado(page, pedido, ARTE.seloAplicado))?.texto}`);
      await lerAvisos(page);
      await entrar(page, ADMIN);
      console.log(`  depois de validar: ${(await decidirSeloAplicado(page, pedido, { valida: true }))?.texto}`);
      console.log(`  não conformidades na tela: ${(await apontarNaoConformidade(page, pedido, ARTE.naoConformidade)).join(" / ")}`);
    } },
];

// ------------------------------------------------------------------ execução --

const PREFIXO = process.env.TREINO_PONTOS_PREFIXO ?? "";
const ponto = (nome) => (nome ? `${PREFIXO}${nome}` : nome);
export const ARQUIVO_ENDERECOS = path.join(DEMO, `caminho-arte-certificacao.${PREFIXO}enderecos.json`);
export const lerEnderecos = () => lerJson(ARQUIVO_ENDERECOS, {});

/** Conferência do ponto: as pendências da agência e da certificadora e o endereço do pedido. */
async function conferirPonto(page, etapa) {
  const visto = {};
  for (const [quem, email] of [["agência", AGENCIA_DE_ARTE], ["certificadora", CERTIFICADORA]]) {
    await entrar(page, email);
    const linhas = await P.linhasDePendencias(page);
    console.log(`  pendências da ${quem} em ${ponto(etapa.salva) ?? etapa.nome} (${linhas.length}):`);
    for (const linha of linhas) console.log(`    · ${linha}`);
    visto[quem] = linhas;
  }
  const pedidos = await pedidosDaLista(page);
  console.log(`  pedidos: ${pedidos.join(" · ") || "—"}`);
  return { pendencias: visto, pedidos };
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
    await restaurarPonto(ponto(etapa.de));
    const e = await abrirEnsaio();
    try {
      await etapa.faz(e.page);
      if (etapa.salva) salvarPonto(ponto(etapa.salva));
      console.log(`etapa ${etapa.nome} ok · ponto ${ponto(etapa.salva) ?? "(nenhum)"} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      const conferido = await conferirPonto(e.page, etapa);
      if (etapa.salva) gravarJson(ARQUIVO_ENDERECOS, { ...lerEnderecos(), [ponto(etapa.salva)]: { em: new Date().toISOString(), ...conferido } });
    } catch (erro) {
      const foto = path.join(DEMO, `falha-${etapa.nome}.png`);
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
