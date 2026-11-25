// Estado inicial do Módulo 1 do Fornecedor, criado do zero (datas de hoje):
// fornecedor A em português, uma solicitação aberta para ele e um convite de book.
//   node _demo/preparar-fornecedor-m1.mjs
import { abrirEnsaio, entrar, salvarPonto, zerarDados } from "../_pipeline/lib.mjs";
import { abrirSolicitacao, cambioManual, convidarParaBook, fecharBook, idiomaPortugues, importarBook } from "./preparo.mjs";

await zerarDados();
const e = await abrirEnsaio();
try {
  const { page } = e;
  await cambioManual(page);
  await idiomaPortugues(page, "supplier.a@china.com");
  await entrar(page, "operador@wellmix.com");
  await importarBook(page, "book-guangzhou-supplier-b.xlsx");
  await fecharBook(page);
  await importarBook(page, "book-shenzhen-supplier-a.xlsx");
  await fecharBook(page);
  await abrirSolicitacao(page, "jar", "SZ-JR15", "Caixa com a marca Wellmix e tampa na cor preta.");
  await convidarParaBook(page, "handle", "GZ-C300", "fornecedor-a", "Copo de 300 ml com alça, em caixa colorida.");
  salvarPonto("forn-m1-base");
  console.log("ponto forn-m1-base salvo");
} finally { await e.fechar(); }
