// "Novos" no painel: faixa com o que chegou desde a última visita + selo "Novo" nos cadastros recentes.
// Depende das variáveis e funções globais de painel.js, painel-kanban.js e painel-candidaturas.js.
(function () {
  "use strict";

  const VISIT_KEY = "painel-ultima-visita";
  const RECENT_DAYS = 7;
  const DAY_MS = 24 * 60 * 60 * 1000;

  let lastVisit = null;
  try { lastVisit = Number(localStorage.getItem(VISIT_KEY)) || null; } catch { /* sem armazenamento */ }
  let dismissed = false;
  let dataLoaded = false;
  let signature = "";

  function createdAt(record) {
    const time = new Date(record.created_at || record.criado_em || "").getTime();
    return Number.isNaN(time) ? null : time;
  }

  function isRecentNew(record, statusValue) {
    const time = createdAt(record);
    return time !== null && Date.now() - time <= RECENT_DAYS * DAY_MS && (statusValue || "novo") === "novo";
  }

  const isNewCandidate = (candidate) => isRecentNew(candidate, stageOf(candidate));
  const isNewLead = (lead) => isRecentNew(lead, lead.status);

  function sinceVisit(list) {
    if (!lastVisit) return [];
    return list.filter((record) => { const time = createdAt(record); return time !== null && time > lastVisit; });
  }

  function plural(count, one, many) { return `${count} ${count === 1 ? one : many}`; }

  function badge() { return textElement("span", "new-badge", "Novo"); }

  function saveVisit(timestamp) {
    lastVisit = timestamp;
    try { localStorage.setItem(VISIT_KEY, String(timestamp)); } catch { /* ignora */ }
  }

  // Faixa no topo do painel
  const banner = document.createElement("section");
  banner.className = "novos-banner";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  const header = document.querySelector(".dash-header");
  if (header) header.after(banner);

  function bannerButton(label, handler, className = "") {
    const button = textElement("button", `novos-action ${className}`, label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }

  function goToCandidates() {
    switchView("talents");
    const stage = byId("stage-filter");
    if (stage && boardMode !== "kanban") stage.value = "novo";
    renderCandidates();
  }

  function renderBanner(newCandidates, newLeads, newApplications) {
    banner.replaceChildren();
    const parts = [];
    if (newCandidates.length) parts.push(plural(newCandidates.length, "candidato", "candidatos"));
    if (newLeads.length) parts.push(plural(newLeads.length, "contato de empresa", "contatos de empresas"));
    if (newApplications.length) parts.push(plural(newApplications.length, "candidatura em vaga", "candidaturas em vagas"));
    if (!parts.length || dismissed) { banner.hidden = true; return; }

    const when = new Date(lastVisit).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const text = document.createElement("div");
    text.append(textElement("strong", "", `Novidades desde sua última visita (${when})`), textElement("span", "", parts.join(" · ")));
    const actions = document.createElement("div");
    actions.className = "novos-actions";
    if (newCandidates.length) actions.append(bannerButton("Ver candidatos novos", goToCandidates));
    if (newLeads.length) actions.append(bannerButton("Ver empresas", () => switchView("leads")));
    actions.append(bannerButton("Marcar como visto", () => { dismissed = true; saveVisit(Date.now()); refresh(true); }, "novos-dismiss"));
    banner.append(text, actions);
    banner.hidden = false;
  }

  function addNavPill(id, count) {
    const counter = byId(id);
    if (!counter) return;
    let pill = counter.parentElement.querySelector(".new-pill");
    if (!count) { if (pill) pill.remove(); return; }
    if (!pill) { pill = textElement("i", "new-pill"); counter.before(pill); }
    pill.textContent = `+${count}`;
    pill.title = `${plural(count, "novo", "novos")} nos últimos ${RECENT_DAYS} dias`;
  }

  // Selos "Novo" nas listas (tabela, celular, kanban). Mesmo esquema do painel-remocao.js: casa as linhas pela ordem dos filtros.
  function markCandidates() {
    const list = filteredCandidates();
    const rows = [...byId("lista-candidatos").querySelectorAll("tr")].filter((row) => row.querySelector(".action-cell"));
    const cards = [...byId("mobile-candidates").querySelectorAll(".mobile-card")];
    [rows, cards].forEach((items) => {
      if (items.length !== list.length) return;
      items.forEach((item, index) => {
        const name = item.querySelector(".person strong");
        if (!name || name.querySelector(".new-badge") || !isNewCandidate(list[index])) return;
        name.append(badge());
      });
    });
    const board = byId("kanban");
    if (board && !board.hidden) {
      board.querySelectorAll(".kanban-card").forEach((card) => {
        const candidate = candidates.find((item) => String(item.id) === card.dataset.id);
        const name = card.querySelector(".person strong");
        if (candidate && name && !name.querySelector(".new-badge") && isNewCandidate(candidate)) name.append(badge());
      });
    }
  }

  function markLeads() {
    const list = filteredLeads();
    const rows = [...byId("lista-leads").querySelectorAll("tr")].filter((row) => row.querySelectorAll("td").length > 1);
    const cards = [...byId("mobile-leads").children];
    [rows, cards].forEach((items) => {
      if (items.length !== list.length) return;
      items.forEach((item, index) => {
        const name = item.querySelector("strong");
        if (!name || name.querySelector(".new-badge") || !isNewLead(list[index])) return;
        name.append(badge());
      });
    });
  }

  function refresh(force = false) {
    if (!dataLoaded && !candidates.length && !leads.length) return;
    const newCandidates = sinceVisit(candidates.filter((item) => stageOf(item) !== "arquivado"));
    const newLeads = sinceVisit(leads);
    const newApplications = sinceVisit(applications);
    const recentCandidates = candidates.filter(isNewCandidate).length;
    const recentLeads = leads.filter(isNewLead).length;
    const next = [candidates.length, leads.length, applications.length, lastVisit, dismissed, recentCandidates, recentLeads].join("|");
    if (!force && next === signature) return;
    signature = next;
    dataLoaded = true;
    renderBanner(newCandidates, newLeads, newApplications);
    addNavPill("nav-talents-count", recentCandidates);
    addNavPill("nav-leads-count", recentLeads);
    markCandidates();
    markLeads();
  }

  [["lista-candidatos", markCandidates], ["mobile-candidates", markCandidates], ["kanban", markCandidates], ["lista-leads", markLeads], ["mobile-leads", markLeads]].forEach(([id, handler]) => {
    const target = byId(id);
    if (target) new MutationObserver(handler).observe(target, { childList: true });
  });

  // Os dados chegam por várias chamadas independentes; conferimos de tempos em tempos (só redesenha se algo mudou).
  setInterval(refresh, 1500);

  // Na primeira visita não há "última visita": só começa a contar daqui para frente.
  if (!lastVisit) saveVisit(Date.now());
  // Ao sair do painel, as novidades que você já viu deixam de aparecer como "desde a última visita".
  window.addEventListener("pagehide", () => { if (dataLoaded) saveVisit(Date.now()); });
})();
