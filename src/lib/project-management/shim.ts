/*
 * Ponte da Plataforma Wellmix v2 com o portal (docs/PROJECT_MANAGEMENT.md).
 * A plataforma foi feita como artifact do claude.ai e fala com
 * `window.claude.use("db" | "user" | "assets" | "downloads")`. Dentro do
 * portal ela roda num iframe do mesmo endereço, e este script (posto no
 * <head> dela) responde a essas chamadas pedindo cada leitura e escrita à
 * página do portal por postMessage; a página chama as Server Actions
 * (src/app/app/actions/project-management.ts). O quadro relê a cada 20 s e
 * logo depois de cada escrita, para o que outra pessoa mudou aparecer.
 */
export const PM_SHIM = String.raw`(function () {
  if (window.parent === window) return;
  var seq = 0, waiting = {}, subs = {}, me = null;
  function call(op, args) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      waiting[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({ wmPm: 1, id: id, op: op, args: args || {} }, location.origin);
    });
  }
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || ev.source !== window.parent) return;
    var m = ev.data || {};
    if (m.wmPmGo) {
      if (location.hash.slice(1) !== m.wmPmGo) location.hash = m.wmPmGo;
      return;
    }
    if (!m.wmPmReply) return;
    var w = waiting[m.id];
    if (!w) return;
    delete waiting[m.id];
    if (m.ok) w.resolve(m.value);
    else { var e = new Error(m.error || "failed"); e.code = m.error || "failed"; w.reject(e); }
  });
  window.addEventListener("hashchange", function () {
    window.parent.postMessage({ wmPmTab: location.hash.slice(1) }, location.origin);
  });
  function snap(rows) {
    return {
      docs: rows.map(function (r) {
        return { id: r.id, exists: true, data: function () { return JSON.parse(JSON.stringify(r.data || {})); } };
      }),
      metadata: { fromCache: false },
      empty: rows.length === 0,
      size: rows.length
    };
  }
  function refresh(c) {
    var list = subs[c] || [];
    if (!list.length) return Promise.resolve();
    return call("list", { collection: c }).then(function (rows) {
      (subs[c] || []).forEach(function (s) { try { s.next(snap(rows)); } catch (e) { console.error(e); } });
    }, function (e) {
      (subs[c] || []).forEach(function (s) { if (s.err) try { s.err(e); } catch (x) {} });
    });
  }
  setInterval(function () { if (!document.hidden) Object.keys(subs).forEach(refresh); }, 20000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) Object.keys(subs).forEach(refresh); });
  function collection(c) {
    function after(p) { return p.then(function () { return refresh(c); }).then(function () { return undefined; }); }
    return {
      onSnapshot: function (next, err) {
        var s = { next: next, err: err };
        (subs[c] = subs[c] || []).push(s);
        refresh(c);
        return function () { subs[c] = (subs[c] || []).filter(function (x) { return x !== s; }); };
      },
      doc: function (id) {
        return {
          set: function (data) { return after(call("set", { collection: c, id: id, data: data })); },
          update: function (patch) { return after(call("update", { collection: c, id: id, patch: patch })); },
          delete: function () { return after(call("delete", { collection: c, id: id })); }
        };
      }
    };
  }
  function whoami() { return me || (me = call("me")); }
  var api = {
    db: { collection: collection },
    user: {
      id: function () { return whoami().then(function (u) { return u.id; }); },
      can: function () { return whoami().then(function () { return true; }, function () { return false; }); },
      profiles: function (ids) { return call("profiles", { ids: ids || [] }); }
    },
    assets: {
      upload: function (file, opts) {
        var f = file;
        if (opts && opts.type && !file.type) f = new File([file], file.name || "anexo", { type: opts.type });
        return call("upload", { file: f });
      }
    },
    downloads: {
      save: function (o) {
        var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: o.mimeType || "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = o.filename || "arquivo";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        return Promise.resolve();
      }
    }
  };
  window.claude = {
    use: function (name) {
      return api[name] ? Promise.resolve(api[name]) : Promise.reject(Object.assign(new Error("unavailable"), { code: "unavailable" }));
    }
  };
})();`;

/** A plataforma com a ponte no <head> e os anexos servidos pelo portal. */
export function withPortalBridge(html: string, filePath: string): string {
  return html
    .replace("<head>", `<head>\n<script>${PM_SHIM}</script>`)
    .replaceAll(
      "/_blob/${esc(x.id)}",
      `${filePath}?k=\${esc(encodeURIComponent(x.id))}`,
    );
}
