// Proteção básica contra robôs nos formulários públicos:
// 1) campo-isca escondido (só robôs preenchem) e 2) limite de envios seguidos por navegador.
// Não substitui regras no banco, mas barra a maior parte dos envios automáticos sem pedir nada ao visitante.
(function () {
  "use strict";

  const WINDOW_MS = 10 * 60 * 1000;
  const LIMITS = { candidato: 3, empresa: 3, candidatura: 5, alerta: 3 };
  const FORMS = ["formCandidato", "formEmpresa", "application-form", "alert-form"];
  const limitMessage = "Recebemos vários envios seguidos deste aparelho. Aguarde alguns minutos e tente novamente.";

  function readLog(kind) {
    try {
      const list = JSON.parse(localStorage.getItem(`envios-${kind}`) || "[]");
      return Array.isArray(list) ? list.filter((time) => typeof time === "number" && Date.now() - time < WINDOW_MS) : [];
    } catch { return []; }
  }

  function writeLog(kind, list) {
    try { localStorage.setItem(`envios-${kind}`, JSON.stringify(list)); } catch { /* sem armazenamento */ }
  }

  function attach(form) {
    if (!form || form.querySelector(".hp-field")) return;
    const wrap = document.createElement("div");
    wrap.className = "hp-field";
    wrap.setAttribute("aria-hidden", "true");
    const label = document.createElement("label");
    label.textContent = "Não preencha este campo";
    const input = document.createElement("input");
    input.type = "text";
    input.name = "ref_codigo";
    input.tabIndex = -1;
    input.autocomplete = "off";
    label.append(input);
    wrap.append(label);
    form.append(wrap);
  }

  // "ok" pode enviar · "bot" campo-isca preenchido · "limit" muitos envios seguidos
  function check(form, kind) {
    const trap = form && form.querySelector(".hp-field input");
    if (trap && trap.value.trim() !== "") return "bot";
    if (readLog(kind).length >= (LIMITS[kind] || 3)) return "limit";
    return "ok";
  }

  function record(kind) {
    const list = readLog(kind);
    list.push(Date.now());
    writeLog(kind, list);
  }

  FORMS.forEach((id) => attach(document.getElementById(id)));
  window.AntiSpam = Object.freeze({ check, record, limitMessage });
})();
