/* Player do treinamento: vídeo com capítulos e legendas, pausa "Sua vez", simulação
 * clicável e quiz. Funciona direto do disco (file://) e por servidor: os dados vêm
 * de assets/dados.js (sem fetch) e as legendas são criadas por script (sem <track>). */
(function () {
  "use strict";
  var T = window.TREINO, $ = function (id) { return document.getElementById(id); };
  var video = $("video"), modulo = null, trilha = null, pausasFeitas = {}, simAtual = null, saltoPedido = null;
  var W = 1920, H = 1080;

  function mmss(t) { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }
  function guardar(chave, valor) { try { localStorage.setItem("treino:" + T.papel + ":" + chave, JSON.stringify(valor)); } catch (e) {} }
  function ler(chave, padrao) { try { var v = localStorage.getItem("treino:" + T.papel + ":" + chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } }

  // ------------------------------------------------------------------ abas --
  function aba(nome) {
    ["video", "pratica", "quiz"].forEach(function (a) {
      $("painel-" + a).hidden = a !== nome;
      $("aba-" + a).setAttribute("aria-selected", a === nome ? "true" : "false");
    });
    if (nome !== "video") video.pause();
  }
  Array.prototype.forEach.call(document.querySelectorAll(".abas button"), function (b) {
    b.addEventListener("click", function () { aba(b.dataset.aba); });
  });

  // ---------------------------------------------------------------- módulo --
  function abrirModulo(m) {
    modulo = m; pausasFeitas = {};
    var fin = !!m.final; // o quiz final do papel é um "módulo" só com perguntas
    $("titulo").textContent = T.titulo + (fin ? " · " + m.titulo : " · Módulo " + m.id + " · " + m.titulo);
    Array.prototype.forEach.call($("modulos").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.id === String(m.id))); });
    $("aba-video").hidden = fin; $("aba-pratica").hidden = fin;
    if (fin) { video.pause(); montarPraticas(); montarQuiz(); aba("quiz"); return; }
    // Servidor que não atende pedido por faixa (Range) não deixa saltar de trecho:
    // nesse caso o vídeo é baixado inteiro e tocado da memória (uma vez por módulo).
    video.src = m.naMemoria || m.video; saltoPedido = null;
    if (m.naMemoria) video.dataset.memoria = "1"; else delete video.dataset.memoria;
    if (!m.naMemoria && /^https?:$/.test(location.protocol) && window.fetch) {
      fetch(m.video, { headers: { Range: "bytes=0-1" } }).then(function (r) {
        return r.status === 206 ? null : r.blob();
      }).then(function (b) {
        if (!b) return;
        m.naMemoria = URL.createObjectURL(b);
        if (modulo !== m) return;
        // O salto pedido enquanto o vídeo baixava (um capítulo, o "Rever no vídeo") vale agora.
        var t = saltoPedido != null ? saltoPedido : video.currentTime, tocando = !video.paused;
        video.src = m.naMemoria; video.dataset.memoria = "1"; saltoPedido = null;
        if (t > 0) video.currentTime = t;
        if (tocando) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
      }).catch(function () {});
    }
    // Legendas por script: valem também abrindo o arquivo direto do disco.
    if (trilha) trilha.mode = "disabled";
    trilha = video.addTextTrack("subtitles", "Português", "pt-BR");
    m.legendas.forEach(function (l) { trilha.addCue(new (window.VTTCue || window.TextTrackCue)(l[0], l[1], l[2])); });
    trilha.mode = $("legendas").checked ? "showing" : "hidden";
    var ol = $("capitulos"); ol.innerHTML = "";
    m.capitulos.forEach(function (c, i) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.innerHTML = "<time>" + mmss(c.inicio) + "</time><span></span>"; b.lastChild.textContent = c.titulo;
      b.dataset.i = i; b.addEventListener("click", function () { irPara(c.inicio); });
      li.appendChild(b); ol.appendChild(li);
    });
    montarPraticas(); montarQuiz(); aba("video");
  }
  function irPara(t) {
    aba("video"); $("suavez").hidden = true;
    // Por servidor (http), o salto fica guardado até dar certo: se o vídeo ainda está sendo
    // baixado inteiro (servidor sem Range), ele é refeito quando o download termina.
    saltoPedido = /^https?:$/.test(location.protocol) && video.dataset.memoria !== "1" ? t + 0.05 : null;
    video.currentTime = t + 0.05; var p = video.play(); if (p && p.catch) p.catch(function () {});
  }
  $("legendas").addEventListener("change", function () { if (trilha) trilha.mode = this.checked ? "showing" : "hidden"; });

  video.addEventListener("timeupdate", function () {
    if (!modulo) return;
    var t = video.currentTime, atual = 0;
    modulo.capitulos.forEach(function (c, i) { if (t >= c.inicio - 0.05) atual = i; });
    Array.prototype.forEach.call($("capitulos").querySelectorAll("button"), function (b) { b.classList.toggle("atual", +b.dataset.i === atual); });
    // "Sua vez": o vídeo para sozinho e só segue com "Continuar".
    modulo.pausas.forEach(function (p, i) {
      if (!pausasFeitas[i] && !video.seeking && t >= p.t && t < p.t + 1.2) { pausasFeitas[i] = true; mostrarSuaVez(p); }
      if (t < p.t - 1.5) pausasFeitas[i] = false; // voltou o vídeo: a pausa vale de novo
    });
  });
  function mostrarSuaVez(p) {
    video.pause();
    $("suavez-titulo").textContent = p.titulo;
    var ol = $("suavez-itens"); ol.innerHTML = "";
    p.itens.forEach(function (it) { var li = document.createElement("li"); li.textContent = it; ol.appendChild(li); });
    $("suavez-praticar").hidden = !p.sim;
    $("suavez-praticar").onclick = function () { $("suavez").hidden = true; abrirSim(p.sim); };
    $("suavez").hidden = false; $("suavez-continuar").focus();
  }
  $("suavez-continuar").addEventListener("click", function () { $("suavez").hidden = true; var p = video.play(); if (p && p.catch) p.catch(function () {}); });

  // ------------------------------------------------------------- simulação --
  function montarPraticas() {
    var lista = $("sim-lista"); lista.innerHTML = ""; $("sim").hidden = true; lista.hidden = false;
    var feitas = ler("praticas", {});
    modulo.simulacoes.forEach(function (s) {
      var a = document.createElement("article");
      a.innerHTML = "<h3></h3><p></p><p class='feito'></p><div class='acoes' style='justify-content:flex-start'><button class='primario'>Praticar</button></div>";
      a.children[0].textContent = s.titulo; a.children[1].textContent = s.passos.length + " passos na tela real, parada. Clique no lugar certo para avançar.";
      a.children[2].textContent = feitas[s.id] ? "Concluída ✓" : "";
      a.querySelector("button").addEventListener("click", function () { abrirSim(s.id); });
      lista.appendChild(a);
    });
    if (!modulo.simulacoes.length) lista.innerHTML = "<p>Este módulo não tem prática.</p>";
  }
  function abrirSim(id) {
    var s = modulo.simulacoes.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    aba("pratica"); simAtual = { s: s, i: 0, erros: 0, digitando: false };
    $("sim-lista").hidden = true; $("sim").hidden = false; passoSim();
  }
  function passoSim() {
    var s = simAtual.s, i = simAtual.i, fim = i >= s.passos.length;
    $("sim-marca").hidden = true; $("sim-digitar").hidden = true; simAtual.erros = 0; simAtual.digitando = false;
    $("sim-dica").className = "dica"; $("sim-dica").textContent = "";
    if (fim) {
      $("sim-img").src = s.fim; $("sim-passo").textContent = "Concluído";
      $("sim-instrucao").textContent = "Pronto! Você fez a tarefa inteira: " + s.titulo + ".";
      $("sim-dica").className = "dica ok"; $("sim-dica").textContent = "Volte às práticas ou ao vídeo quando quiser.";
      var f = ler("praticas", {}); f[s.id] = true; guardar("praticas", f); return;
    }
    var p = s.passos[i];
    $("sim-img").src = p.img; $("sim-passo").textContent = "Passo " + (i + 1) + " de " + s.passos.length;
    $("sim-instrucao").textContent = p.instrucao;
  }
  function marcar(caixa, certo) {
    var m = $("sim-marca"), tela = $("sim-tela"), k = tela.clientWidth / W;
    m.style.left = (caixa.x - 6) * k + "px"; m.style.top = (caixa.y - 6) * k + "px";
    m.style.width = (caixa.w + 12) * k + "px"; m.style.height = (caixa.h + 12) * k + "px";
    m.className = "sim-marca" + (certo ? " certo" : ""); m.hidden = false;
  }
  $("sim-tela").addEventListener("click", function (ev) {
    if (!simAtual || simAtual.i >= simAtual.s.passos.length || simAtual.digitando) return;
    if (ev.target.closest && ev.target.closest("#sim-digitar")) return;
    var r = $("sim-img").getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
    var p = simAtual.s.passos[simAtual.i], c = p.caixa, f = 14;
    var dentro = x >= c.x - f && x <= c.x + c.w + f && y >= c.y - f && y <= c.y + c.h + f;
    if (!dentro) {
      simAtual.erros++;
      $("sim-dica").className = "dica"; $("sim-dica").textContent = "Ainda não. Dica: " + p.dica;
      if (simAtual.erros >= 2) marcar(c, false); // na segunda tentativa, mostra onde é
      return;
    }
    marcar(c, true);
    if (p.tipo === "digitar") {
      simAtual.digitando = true;
      var fm = $("sim-digitar"), k = $("sim-tela").clientWidth / W;
      $("sim-rotulo").textContent = "Digite: " + p.valor; $("sim-campo").value = "";
      fm.hidden = false; fm.style.left = Math.max(8, Math.min(c.x * k, $("sim-tela").clientWidth - 380)) + "px";
      fm.style.top = (c.y + c.h + 14) * k + "px"; $("sim-campo").focus();
      $("sim-dica").className = "dica ok"; $("sim-dica").textContent = "Isso. Agora digite o valor pedido.";
      return;
    }
    $("sim-dica").className = "dica ok"; $("sim-dica").textContent = "Isso mesmo!";
    setTimeout(function () { simAtual.i++; passoSim(); }, 650);
  });
  $("sim-digitar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var p = simAtual.s.passos[simAtual.i], limpa = function (v) { return String(v).trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, ""); };
    if (limpa($("sim-campo").value) === limpa(p.valor)) {
      $("sim-dica").className = "dica ok"; $("sim-dica").textContent = "Isso mesmo!";
      setTimeout(function () { simAtual.i++; passoSim(); }, 500);
    } else { $("sim-dica").className = "dica"; $("sim-dica").textContent = "Confira o texto: é preciso digitar exatamente “" + p.valor + "”."; }
  });
  $("sim-voltar").addEventListener("click", montarPraticas);

  // ------------------------------------------------------------------ quiz --
  var Q = null;
  function montarQuiz() {
    var qs = modulo.quiz.perguntas.map(function (q, i) { return i; });
    Q = { fila: qs.slice(), primeira: {}, total: qs.length, rodada: 1 };
    var raiz = $("quiz"); raiz.innerHTML = "";
    var c = document.createElement("div"); c.className = "q";
    var ult = ler("quiz-" + modulo.id, null);
    c.innerHTML = "<p class='conta'></p><h2></h2><p></p><p></p><div class='acoes' style='justify-content:flex-start'><button class='primario'>Começar</button></div>";
    c.children[0].textContent = Q.total + " perguntas · nota mínima " + Math.round(modulo.quiz.corte * 100) + "%";
    c.children[1].textContent = modulo.final ? "Quiz final: todos os módulos" : "Quiz do módulo";
    c.children[2].textContent = modulo.final
      ? "Situações que juntam o que você viu em todos os módulos. Depois de cada resposta você vê o porquê. As que você errar voltam no fim, e o resultado mostra o que rever, com o trecho do vídeo."
      : "São situações do dia a dia. Depois de cada resposta você vê o porquê e pode rever o trecho do vídeo. As que você errar voltam no fim.";
    c.children[3].textContent = ult ? "Sua última nota: " + ult.nota + "%." : "";
    c.querySelector("button").addEventListener("click", pergunta); raiz.appendChild(c);
  }
  function pergunta() {
    var raiz = $("quiz"); raiz.innerHTML = "";
    if (!Q.fila.length) return resultado();
    var idx = Q.fila[0], q = modulo.quiz.perguntas[idx], c = document.createElement("div"); c.className = "q";
    var feitas = Q.total - Q.fila.length;
    c.innerHTML = "<p class='conta'></p><h2></h2><div class='corpo'></div><div class='retorno' hidden></div>";
    c.children[0].textContent = (Q.rodada > 1 ? "Revisão · " : "") + "Pergunta " + (Q.rodada > 1 ? (Q.totalRodada - Q.fila.length + 1) + " de " + Q.totalRodada : (feitas + 1) + " de " + Q.total);
    c.children[1].textContent = q.enunciado;
    var corpo = c.children[2];
    function responder(certa) {
      if (!(idx in Q.primeira)) Q.primeira[idx] = certa;
      Q.fila.shift(); if (!certa) Q.erradas.push(idx);
      var r = c.children[3]; r.hidden = false; r.className = "retorno " + (certa ? "ok" : "nao");
      r.innerHTML = "<p><strong></strong> <span></span></p><div class='acoes'></div>";
      r.querySelector("strong").textContent = certa ? "Certo." : "Ainda não.";
      r.querySelector("span").textContent = q.feedback;
      var ac = r.querySelector(".acoes");
      // No quiz final o trecho fica em outro módulo: o atalho aparece só no resultado, para não perder as respostas.
      if (q.rever != null && typeof q.rever !== "object") { var v = document.createElement("button"); v.className = "secundario"; v.textContent = "Rever no vídeo (" + mmss(q.rever) + ")"; v.addEventListener("click", function () { irPara(q.rever); }); ac.appendChild(v); }
      var n = document.createElement("button"); n.className = "primario"; n.textContent = Q.fila.length || Q.erradas.length ? "Próxima" : "Ver resultado";
      n.addEventListener("click", function () {
        if (!Q.fila.length && Q.erradas.length) { Q.fila = Q.erradas; Q.erradas = []; Q.rodada++; Q.totalRodada = Q.fila.length; }
        pergunta();
      });
      ac.appendChild(n); n.focus();
    }
    if (q.tipo === "cenario") {
      var d = document.createElement("div"); d.className = "alternativas";
      q.alternativas.forEach(function (a, i) {
        var b = document.createElement("button"); b.textContent = String.fromCharCode(65 + i) + ") " + a;
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(d.children, function (x, j) { x.disabled = true; if (j === q.correta) x.classList.add("certa"); });
          if (i !== q.correta) b.classList.add("errada"); responder(i === q.correta);
        });
        d.appendChild(b);
      });
      corpo.appendChild(d);
    } else if (q.tipo === "clique") {
      var tela = document.createElement("div"); tela.className = "sim-tela";
      tela.innerHTML = "<img alt='Tela do portal'><div class='sim-marca' hidden></div>"; tela.firstChild.src = q.img;
      var feito = false;
      tela.addEventListener("click", function (ev) {
        if (feito) return; feito = true;
        var r = tela.firstChild.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H, cx = q.caixa, f = 14;
        var certa = x >= cx.x - f && x <= cx.x + cx.w + f && y >= cx.y - f && y <= cx.y + cx.h + f;
        var m = tela.lastChild, k = tela.clientWidth / W;
        m.style.left = (cx.x - 6) * k + "px"; m.style.top = (cx.y - 6) * k + "px"; m.style.width = (cx.w + 12) * k + "px"; m.style.height = (cx.h + 12) * k + "px";
        m.className = "sim-marca certo"; m.hidden = false; tela.style.cursor = "default"; responder(certa);
      });
      corpo.appendChild(tela);
    } else if (q.tipo === "ordenar") {
      var ordem = q.embaralhado.slice(), ol = document.createElement("ol"); ol.className = "ordem";
      function desenhar() {
        ol.innerHTML = "";
        ordem.forEach(function (ix, pos) {
          var li = document.createElement("li"); li.innerHTML = "<span></span><button aria-label='Subir'>↑</button><button aria-label='Descer'>↓</button>";
          li.firstChild.textContent = q.itens[ix];
          li.children[1].disabled = pos === 0; li.children[2].disabled = pos === ordem.length - 1;
          li.children[1].addEventListener("click", function () { ordem.splice(pos - 1, 0, ordem.splice(pos, 1)[0]); desenhar(); });
          li.children[2].addEventListener("click", function () { ordem.splice(pos + 1, 0, ordem.splice(pos, 1)[0]); desenhar(); });
          ol.appendChild(li);
        });
      }
      desenhar(); corpo.appendChild(ol);
      var ok = document.createElement("button"); ok.className = "primario"; ok.textContent = "Conferir a ordem";
      ok.addEventListener("click", function () {
        ok.disabled = true; Array.prototype.forEach.call(ol.querySelectorAll("button"), function (b) { b.disabled = true; });
        var certa = ordem.every(function (ix, pos) { return ix === pos; });
        if (!certa) { ordem = q.itens.map(function (_, i) { return i; }); desenhar(); Array.prototype.forEach.call(ol.querySelectorAll("button"), function (b) { b.disabled = true; }); }
        responder(certa);
      });
      corpo.appendChild(ok);
    }
    raiz.appendChild(c);
  }
  function resultado() {
    var raiz = $("quiz"); raiz.innerHTML = "";
    var certas = 0, rever = [];
    modulo.quiz.perguntas.forEach(function (q, i) { if (Q.primeira[i]) certas++; else rever.push(q); });
    var nota = Math.round(certas / Q.total * 100), passou = nota >= modulo.quiz.corte * 100;
    guardar("quiz-" + modulo.id, { nota: nota, quando: new Date().toISOString() });
    var c = document.createElement("div"); c.className = "q";
    c.innerHTML = "<p class='conta'>Resultado</p><p class='nota'></p><h2></h2><p></p><ul class='rever'></ul><div class='acoes' style='justify-content:flex-start'><button class='secundario'>Refazer o quiz</button></div>";
    c.children[1].textContent = nota + "%"; c.children[1].style.color = passou ? "var(--ok)" : "var(--erro)";
    c.children[2].textContent = passou ? "Aprovado: você acertou " + certas + " de " + Q.total + " na primeira tentativa." : "Ainda não: você acertou " + certas + " de " + Q.total + " na primeira tentativa. A nota mínima é " + Math.round(modulo.quiz.corte * 100) + "%.";
    c.children[3].textContent = rever.length ? "Vale rever estes pontos:" : (modulo.final ? "Você não errou nenhuma. Treinamento concluído!" : "Você não errou nenhuma. Pode seguir para o próximo módulo.");
    rever.forEach(function (q) {
      var li = document.createElement("li"); li.innerHTML = "<span></span> "; li.firstChild.textContent = q.tema + ".";
      if (q.rever != null) { var b = document.createElement("button"); b.textContent = rotuloRever(q.rever); b.addEventListener("click", function () { verTrecho(q.rever); }); li.appendChild(b); }
      c.children[4].appendChild(li);
    });
    c.querySelector(".acoes button").addEventListener("click", montarQuiz); raiz.appendChild(c);
  }
  function rotuloRever(r) { return "Rever no vídeo (" + (typeof r === "object" ? "Módulo " + r.modulo + ", " + mmss(r.t) : mmss(r)) + ")"; }
  function verTrecho(r) {
    if (typeof r !== "object") return irPara(r);
    var m = T.modulos.filter(function (x) { return x.id === r.modulo; })[0];
    if (m) { abrirModulo(m); irPara(r.t); }
  }
  var montarQuizBase = montarQuiz;
  montarQuiz = function () { montarQuizBase(); Q.erradas = []; Q.totalRodada = Q.total; };

  // ---------------------------------------------------------------- início --
  document.title = T.titulo;
  var nav = $("modulos");
  T.modulos.forEach(function (m) {
    var b = document.createElement("button"); b.textContent = m.final ? m.titulo : "Módulo " + m.id + " · " + m.titulo; b.dataset.id = m.id;
    b.addEventListener("click", function () { abrirModulo(m); }); nav.appendChild(b);
  });
  nav.hidden = T.modulos.length < 2;
  abrirModulo(T.modulos[0]);
  window.__treinoTeste = { irPara: irPara, abrirSim: abrirSim, aba: aba, // usado pelo teste do pacote
    abrirModulo: function (id) { abrirModulo(T.modulos.filter(function (x) { return String(x.id) === String(id); })[0]); } };
})();
