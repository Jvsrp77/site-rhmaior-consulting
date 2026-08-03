const SUPABASE_URL = "https://qaviuelxsokbdpllqrap.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdml1ZWx4c29rYmRwbGxxcmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg4OTYsImV4cCI6MjEwMTM1NDg5Nn0.zvk7kGck96OM3kyTfLE-5Rr968ErvAYDXPKoA2f_e_s";

// O site público usa uma sessão isolada. Assim, um login feito no painel RH
// não altera o papel usado para enviar currículos e contatos.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
const siteConfig = window.MAIORH_CONFIG || {};
let activeModal = null;
let lastFocused = null;

const byId = (id) => document.getElementById(id);
const header = document.querySelector(".site-header");
const progressBar = document.querySelector(".scroll-progress i");
const hero = document.querySelector(".hero");
const backToTop = byId("back-to-top");

function updatePageChrome() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  header.classList.toggle("is-scrolled", window.scrollY > 24);
  if (backToTop) backToTop.hidden = window.scrollY < 800;
}
window.addEventListener("scroll", updatePageChrome, { passive: true });
updatePageChrome();

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateNumber(el, to, { duration = 900, prefix = "", suffix = "", pad = 0 } = {}) {
  const format = (value) => `${prefix}${String(value).padStart(pad, "0")}${suffix}`;
  if (reduceMotion) { el.textContent = format(to); el.dataset.value = String(to); return; }
  const from = Number(el.dataset.value || 0);
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    el.textContent = format(Math.round(from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(tick);
    else el.dataset.value = String(to);
  }
  requestAnimationFrame(tick);
}

function animateCounters() {
  document.querySelectorAll("[data-count-to]").forEach((el) => {
    animateNumber(el, Number(el.dataset.countTo), { duration: 1100, prefix: el.dataset.prefix || "", suffix: el.dataset.suffix || "" });
  });
}
animateCounters();

function configureExternalServices() {
  const organization = siteConfig.organization || {};
  const structuredData = { "@context": "https://schema.org", "@type": "Organization", name: organization.name || "MaioRH", description: organization.description };
  if (siteConfig.siteUrl) structuredData.url = siteConfig.siteUrl;
  if (organization.legalName) structuredData.legalName = organization.legalName;
  if (organization.logoUrl) structuredData.logo = organization.logoUrl;
  if (siteConfig.privacyEmail) structuredData.email = siteConfig.privacyEmail;
  if (organization.city || organization.state) structuredData.address = { "@type": "PostalAddress", addressLocality: organization.city, addressRegion: organization.state, addressCountry: organization.country || "BR" };
  if (organization.linkedInUrl) structuredData.sameAs = [organization.linkedInUrl];
  const schema = document.createElement("script"); schema.type = "application/ld+json"; schema.textContent = JSON.stringify(structuredData); document.head.append(schema);
  if (siteConfig.whatsappNumber) { const link=byId("quick-whatsapp");const digits=String(siteConfig.whatsappNumber).replace(/\D/g,"");link.href=`https://wa.me/${digits}?text=${encodeURIComponent("Olá! Gostaria de conversar com a MaioRH.")}`;link.hidden=false; }
  if (siteConfig.schedulingUrl) { const link=byId("quick-schedule");link.href=siteConfig.schedulingUrl;link.hidden=false; }
  if (organization.linkedInUrl) { const link=byId("footer-linkedin");link.href=organization.linkedInUrl;link.hidden=false; }
}
configureExternalServices();

backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));

// Cookies não essenciais (Google Analytics) só carregam após consentimento (LGPD).
const COOKIE_CONSENT_KEY = "maiorh_cookie_consent";

function loadAnalytics() {
  if (!siteConfig.analyticsId) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(siteConfig.analyticsId)}`;
  document.head.append(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", siteConfig.analyticsId, { anonymize_ip: true });
}

function setupCookieConsent() {
  const banner = byId("cookie-consent");
  if (!banner) return;
  const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (stored === "accepted") { loadAnalytics(); return; }
  if (stored === "rejected" || !siteConfig.analyticsId) return;
  banner.hidden = false;
  byId("cookie-accept")?.addEventListener("click", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    banner.hidden = true;
    loadAnalytics();
  });
  byId("cookie-reject")?.addEventListener("click", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    banner.hidden = true;
  });
}
setupCookieConsent();

async function loadPublicSignals() {
  const { data: jobs, error } = await supabaseClient.from("vagas").select("id,titulo,resumo,area,modalidade,cidade,created_at").eq("ativa", true).order("created_at", { ascending: false });
  if (error) { renderOpportunityDashboard([]); renderFeaturedJobs([]); byId("dashboard-status").textContent = "O painel será atualizado quando o módulo de vagas estiver disponível."; return; }
  const count = jobs?.length || 0;
  if (count > 0) animateNumber(byId("hero-job-count"), count, { pad: 2 });
  renderOpportunityDashboard(jobs || []);
  renderFeaturedJobs((jobs || []).slice(0, 3));
}
loadPublicSignals();

function renderFeaturedJobs(jobs) {
  const section = byId("featured-jobs"); const grid = byId("featured-jobs-grid");
  if (!section || !grid) return;
  if (!jobs.length) { section.hidden = true; return; }
  grid.replaceChildren();
  jobs.forEach((job) => {
    const card = document.createElement("article"); card.className = "job-card";
    const content = document.createElement("div");
    const meta = document.createElement("div"); meta.className = "job-meta";
    [job.area || "Oportunidade", job.modalidade || "A combinar", job.cidade || "Local a definir"].forEach((text) => {
      const span = document.createElement("span"); span.textContent = text; meta.append(span);
    });
    const title = document.createElement("h3"); title.textContent = job.titulo;
    const summary = document.createElement("p"); summary.textContent = job.resumo || "Conheça os detalhes desta oportunidade.";
    content.append(meta, title, summary);
    const actions = document.createElement("div"); actions.className = "job-card-actions";
    const details = document.createElement("a"); details.className = "button button-ghost-dark"; details.textContent = "Ver detalhes";
    details.href = `vaga.html?id=${encodeURIComponent(job.id)}`;
    actions.append(details);
    card.append(content, actions);
    attachTilt(card);
    grid.append(card);
  });
  section.hidden = false;
}

function grouped(items, field, fallback) {
  return Object.entries(items.reduce((result, item) => {
    const key = String(item[field] || fallback).trim() || fallback;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {})).sort((a, b) => b[1] - a[1]);
}

const EMPTY_STATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 2"/></svg>';

function chartEmptyState(message) {
  const wrap = document.createElement("div");
  wrap.className = "chart-empty";
  wrap.innerHTML = `<span class="chart-empty-icon">${EMPTY_STATE_ICON}</span><span>${message}</span>`;
  return wrap;
}

function renderOpportunityDashboard(jobs) {
  const total = jobs.length;
  const totalEl = byId("dashboard-total"); const donut = byId("mode-donut"); const donutStrong = donut.querySelector("strong");
  if (total) { animateNumber(totalEl, total, { pad: 2 }); animateNumber(donutStrong, total, { pad: 2 }); }
  else { totalEl.textContent = "—"; donutStrong.textContent = "—"; }
  const areasRoot = byId("area-bars"); const modesRoot = byId("mode-legend"); const locationsRoot = byId("location-ranking");
  areasRoot.replaceChildren(); modesRoot.replaceChildren(); locationsRoot.replaceChildren();
  if (!total) {
    areasRoot.append(chartEmptyState("As vagas publicadas aparecerão aqui, organizadas por área."));
    modesRoot.append(chartEmptyState("As modalidades de trabalho aparecerão aqui assim que houver vagas ativas."));
    locationsRoot.append(chartEmptyState("As localidades com mais vagas aparecerão aqui."));
    donut.style.setProperty("--donut", "#27364a 0 100%");
    return;
  }
  const areas = grouped(jobs, "area", "Outras áreas").slice(0, 5); const maxArea = areas[0][1];
  areas.forEach(([name, value]) => {
    const row = document.createElement("div"); row.className = "area-row";
    const meta = document.createElement("div"); const label = document.createElement("span"); label.textContent = name; const number = document.createElement("strong"); number.textContent = value; meta.append(label, number);
    const track = document.createElement("div"); track.className = "area-track"; const fill = document.createElement("i"); fill.style.setProperty("--value", `${Math.max(12, value / maxArea * 100)}%`); track.append(fill); row.append(meta, track); areasRoot.append(row);
  });
  const palette = ["#ff6b2c", "#4fd0a0", "#5f83b5", "#ffd0bd"]; const modes = grouped(jobs, "modalidade", "A combinar").slice(0, 4); let cursor = 0; const stops = [];
  modes.forEach(([name, value], index) => {
    const percentage = value / total * 100; stops.push(`${palette[index]} ${cursor}% ${cursor + percentage}%`); cursor += percentage;
    const item = document.createElement("div"); item.className = "legend-item"; const dot = document.createElement("i"); dot.style.background = palette[index]; const label = document.createElement("span"); label.textContent = name; const number = document.createElement("strong"); number.textContent = `${Math.round(percentage)}%`; item.append(dot, label, number); modesRoot.append(item);
  });
  donut.style.setProperty("--donut", stops.join(","));
  grouped(jobs, "cidade", "Local a definir").slice(0, 4).forEach(([name, value], index) => {
    const item = document.createElement("div"); item.className = "location-item"; const rank = document.createElement("span"); rank.textContent = String(index + 1).padStart(2, "0"); const label = document.createElement("strong"); label.textContent = name; const number = document.createElement("small"); number.textContent = `${value} ${value === 1 ? "vaga" : "vagas"}`; item.append(rank, label, number); locationsRoot.append(item);
  });
}

const fitProfiles = {
  lideranca: { title: "Perfil de liderança", caption: "Equilíbrio entre visão, influência e capacidade de execução.", values: [78, 96, 86, 91, 88] },
  especialista: { title: "Perfil especialista", caption: "Profundidade técnica conectada à colaboração e à evolução contínua.", values: [97, 68, 84, 78, 82] },
  operacoes: { title: "Perfil de operações", caption: "Disciplina, adaptabilidade e consistência para ambientes dinâmicos.", values: [88, 73, 95, 86, 79] }
};
const fitLabels = ["Conhecimento", "Liderança", "Adaptabilidade", "Comunicação", "Contexto cultural"];
const fitCanvas = byId("fit-chart"); const fitContext = fitCanvas.getContext("2d"); let fitValues = [...fitProfiles.lideranca.values]; let fitAnimation = 0;

function fitPoint(index, value, radius, centerX, centerY) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / fitLabels.length;
  return [centerX + Math.cos(angle) * radius * value / 100, centerY + Math.sin(angle) * radius * value / 100];
}

function drawFitChart(values) {
  const bounds = fitCanvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2); const width = bounds.width; const height = bounds.height;
  fitCanvas.width = Math.round(width * ratio); fitCanvas.height = Math.round(height * ratio); fitContext.setTransform(ratio, 0, 0, ratio, 0, 0); fitContext.clearRect(0, 0, width, height);
  const centerX = width / 2; const centerY = height / 2; const radius = Math.min(width, height) * .35;
  for (let level = 1; level <= 4; level += 1) {
    fitContext.beginPath();
    fitLabels.forEach((_, index) => { const [x, y] = fitPoint(index, level * 25, radius, centerX, centerY); index ? fitContext.lineTo(x, y) : fitContext.moveTo(x, y); });
    fitContext.closePath(); fitContext.strokeStyle = "rgba(255,255,255,.11)"; fitContext.lineWidth = 1; fitContext.stroke();
  }
  fitLabels.forEach((_, index) => { const [x, y] = fitPoint(index, 100, radius, centerX, centerY); fitContext.beginPath(); fitContext.moveTo(centerX, centerY); fitContext.lineTo(x, y); fitContext.strokeStyle = "rgba(255,255,255,.08)"; fitContext.stroke(); });
  const gradient = fitContext.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius); gradient.addColorStop(0, "rgba(255,143,94,.55)"); gradient.addColorStop(1, "rgba(255,107,44,.16)");
  fitContext.beginPath(); values.forEach((value, index) => { const [x, y] = fitPoint(index, value, radius, centerX, centerY); index ? fitContext.lineTo(x, y) : fitContext.moveTo(x, y); }); fitContext.closePath(); fitContext.fillStyle = gradient; fitContext.fill(); fitContext.strokeStyle = "#ff7b43"; fitContext.lineWidth = 2; fitContext.stroke();
  values.forEach((value, index) => { const [x, y] = fitPoint(index, value, radius, centerX, centerY); fitContext.beginPath(); fitContext.arc(x, y, 4, 0, Math.PI * 2); fitContext.fillStyle = "#fff"; fitContext.fill(); fitContext.strokeStyle = "#ff6b2c"; fitContext.lineWidth = 3; fitContext.stroke(); });
}

function renderFitLegend(values) {
  const root = byId("fit-legend"); root.replaceChildren();
  fitLabels.forEach((label, index) => { const item = document.createElement("div"); const marker = document.createElement("i"); const text = document.createElement("span"); text.textContent = label; const level = document.createElement("strong"); level.textContent = values[index] >= 90 ? "Essencial" : values[index] >= 82 ? "Alta" : "Relevante"; item.append(marker, text, level); root.append(item); });
}

function selectFitProfile(key) {
  const profile = fitProfiles[key]; const start = [...fitValues]; const startTime = performance.now(); cancelAnimationFrame(fitAnimation);
  byId("fit-profile-title").textContent = profile.title; byId("fit-profile-caption").textContent = profile.caption; fitCanvas.setAttribute("aria-label", `Gráfico demonstrativo dos critérios de avaliação para ${profile.title.toLowerCase()}`); renderFitLegend(profile.values);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = (time) => { const progress = reduceMotion ? 1 : Math.min(1, (time - startTime) / 520); const eased = 1 - Math.pow(1 - progress, 3); fitValues = start.map((value, index) => value + (profile.values[index] - value) * eased); drawFitChart(fitValues); if (progress < 1) fitAnimation = requestAnimationFrame(animate); };
  fitAnimation = requestAnimationFrame(animate);
}

document.querySelectorAll("[data-fit-profile]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-fit-profile]").forEach(item => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-pressed", String(selected)); });
  selectFitProfile(button.dataset.fitProfile);
}));
renderFitLegend(fitValues); drawFitChart(fitValues); window.addEventListener("resize", () => drawFitChart(fitValues), { passive: true });

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compactMoneyFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });

function updateVacancyCost() {
  const salaryInput = byId("cost-salary"); const daysInput = byId("cost-days"); const factorInput = byId("cost-factor");
  const salary = Math.min(100000, Math.max(1500, Number(salaryInput.value) || 1500)); const days = Number(daysInput.value); const factor = Number(factorInput.value);
  const estimate = salary / 30 * days * factor;
  byId("cost-days-output").textContent = `${days} dias`; byId("cost-result-value").textContent = moneyFormatter.format(estimate); byId("cost-result-caption").textContent = `para ${days} dias de posição em aberto`;
  const scenarios = [30, 60, 90, 120].map(period => ({ period, value: salary / 30 * period * factor })); const maximum = scenarios[scenarios.length - 1].value;
  const root = byId("cost-bars"); root.replaceChildren();
  scenarios.forEach(({ period, value }) => {
    const column = document.createElement("div"); column.className = "cost-column"; column.setAttribute("aria-label", `${period} dias: ${moneyFormatter.format(value)}`);
    const valueLabel = document.createElement("strong"); valueLabel.textContent = compactMoneyFormatter.format(value);
    const track = document.createElement("div"); const bar = document.createElement("i"); bar.style.setProperty("--height", `${Math.max(12, value / maximum * 100)}%`); track.append(bar);
    const periodLabel = document.createElement("span"); periodLabel.textContent = `${period}d`; column.append(valueLabel, track, periodLabel); root.append(column);
  });
}
["cost-salary", "cost-days", "cost-factor"].forEach(id => byId(id).addEventListener("input", updateVacancyCost));
updateVacancyCost();

hero.addEventListener("pointermove", (event) => {
  const bounds = hero.getBoundingClientRect();
  hero.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
  hero.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
});

const canTilt = !reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
function attachTilt(card) {
  if (!canTilt) return;
  card.addEventListener("pointermove", (event) => {
    const bounds = card.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width - 0.5;
    const py = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.transform = `translateY(-6px) perspective(700px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) scale(1.015)`;
  });
  card.addEventListener("pointerleave", () => { card.style.transform = ""; });
}
document.querySelectorAll(".service-card, .case-card, .signal-card, .insight-card").forEach(attachTilt);

function openModal(modal) {
  if (!modal) return;
  lastFocused = document.activeElement;
  activeModal = modal;
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("is-open"));
  document.body.classList.add("modal-open");
  modal.querySelector("button, input, select, textarea, a")?.focus();
}

function closeModal() {
  if (!activeModal) return;
  const modal = activeModal;
  modal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  activeModal = null;
  window.setTimeout(() => { modal.hidden = true; }, 220);
  lastFocused?.focus();
}

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.open === "empresa") {
      byId("empServico").value = button.dataset.service || "Geral";
      openModal(byId("modalEmpresa"));
    } else { resetCandidateModal(); openModal(byId("modalCandidato")); }
  });
});
document.querySelectorAll("[data-article]").forEach((button) => button.addEventListener("click", () => openModal(byId(button.dataset.article))));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
  if (event.key === "Tab" && activeModal) {
    const focusable = [...activeModal.querySelectorAll("button:not([disabled]), input, select, textarea, a[href]")];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
menuButton.addEventListener("click", () => {
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  nav.classList.toggle("is-open", !expanded);
});
nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => { nav.classList.remove("is-open"); menuButton.setAttribute("aria-expanded", "false"); }));

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
}), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

function setFormState(button, status, loading, message = "", error = false) {
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function resetCandidateModal() {
  const modal = byId("modalCandidato");
  const panel = modal.querySelector(".modal-panel");
  panel.querySelector(":scope > .eyebrow").hidden = false;
  byId("cand-title").hidden = false;
  panel.querySelector(":scope > p").hidden = false;
  byId("formCandidato").hidden = false;
  const success = byId("candidate-success");
  if (success) success.hidden = true;
}

function showCandidateSuccess(name) {
  const modal = byId("modalCandidato");
  const panel = modal.querySelector(".modal-panel");
  panel.querySelector(":scope > .eyebrow").hidden = true;
  byId("cand-title").hidden = true;
  panel.querySelector(":scope > p").hidden = true;
  byId("formCandidato").hidden = true;

  let success = byId("candidate-success");
  if (!success) {
    success = document.createElement("section");
    success.id = "candidate-success";
    success.className = "candidate-success";
    success.setAttribute("aria-live", "polite");

    const seal = document.createElement("div"); seal.className = "success-seal"; seal.textContent = "✓";
    const label = document.createElement("span"); label.className = "eyebrow"; label.textContent = "Cadastro concluído";
    const title = document.createElement("h2"); title.textContent = "Currículo enviado com sucesso.";
    const message = document.createElement("p"); message.className = "success-message";
    const steps = document.createElement("div"); steps.className = "success-steps";
    [
      ["01", "Recebido", "Seu currículo foi armazenado com segurança."],
      ["02", "Em avaliação", "Nossa equipe analisará seu perfil e suas experiências."],
      ["03", "Próximo contato", "Se houver aderência a uma oportunidade, retornaremos assim que possível."]
    ].forEach(([number, heading, copy]) => {
      const item = document.createElement("article");
      const index = document.createElement("span"); index.textContent = number;
      const content = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = heading;
      const text = document.createElement("p"); text.textContent = copy;
      content.append(strong, text); item.append(index, content); steps.append(item);
    });
    const actions = document.createElement("div"); actions.className = "success-actions";
    const jobs = document.createElement("a"); jobs.className = "button button-primary"; jobs.href = "vagas.html"; jobs.textContent = "Ver vagas abertas →";
    const finish = document.createElement("button"); finish.className = "button button-dark"; finish.type = "button"; finish.textContent = "Concluir"; finish.addEventListener("click", closeModal);
    actions.append(jobs, finish);
    success.append(seal, label, title, message, steps, actions);
    panel.append(success);
  }
  const firstName = name.trim().split(/\s+/)[0] || "";
  success.querySelector(".success-message").textContent = `${firstName ? `${firstName}, seu perfil` : "Seu perfil"} agora faz parte do nosso banco de talentos. Obrigado por confiar sua trajetória à MaioRH.`;
  success.hidden = false;
  panel.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  success.querySelector("a, button")?.focus();
}

byId("formCandidato").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = byId("btnCandEnviar"); const status = byId("candStatus"); const file = byId("candArquivo").files[0];
  if (!file || (file.type && file.type !== "application/pdf") || !file.name.toLowerCase().endsWith(".pdf")) {
    setFormState(button, status, false, "Selecione um arquivo PDF válido.", true); return;
  }
  if (file.size > 10 * 1024 * 1024) { setFormState(button, status, false, "O arquivo deve ter no máximo 10 MB.", true); return; }
  setFormState(button, status, true, "Enviando seu currículo com segurança...");
  try {
    await window.MaioRHCandidates.submit({
      client: supabaseClient,
      file,
      candidate: {
        nome: byId("candNome").value.trim(),
        email: byId("candEmail").value.trim().toLowerCase(),
        telefone: byId("candTelefone").value.trim(),
        vaga_interesse: byId("candVaga").value
      }
    });
    const candidateName = byId("candNome").value;
    event.target.reset(); setFormState(button, status, false, "");
    showCandidateSuccess(candidateName);
  } catch (error) {
    console.error("Falha ao cadastrar candidato:", error?.cause || error); setFormState(button, status, false, window.MaioRHCandidates.message(error), true);
  }
});

byId("formEmpresa").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = byId("btnEmpEnviar"); const status = byId("empStatus");
  setFormState(button, status, true, "Registrando sua solicitação...");
  try {
    const coreLead = { nome_contato: byId("empContato").value.trim(), empresa: byId("empNome").value.trim(), email_corporativo: byId("empEmail").value.trim().toLowerCase(), telefone_empresa: byId("empTelefone").value.trim(), servico_interesse: byId("empServico").value, mensagem: byId("empMensagem").value.trim() };
    const qualifiedLead = { ...coreLead, quantidade_vagas: Number(byId("empQuantidade").value) || null, urgencia: byId("empUrgencia").value, localidade: byId("empLocalidade").value.trim(), modalidade: byId("empModalidade").value };
    let { error } = await supabaseClient.from("leads_empresas").insert([qualifiedLead]);
    if (error && /column|schema cache/i.test(error.message || "")) ({ error } = await supabaseClient.from("leads_empresas").insert([coreLead]));
    if (error) throw error;
    event.target.reset(); setFormState(button, status, false, "Solicitação recebida. Nossa equipe entrará em contato.");
    window.setTimeout(closeModal, 1800);
  } catch (error) {
    console.error("Falha ao cadastrar lead:", error); setFormState(button, status, false, "Não foi possível enviar agora. Tente novamente.", true);
  }
});
