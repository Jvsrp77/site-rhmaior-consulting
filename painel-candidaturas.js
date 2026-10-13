// Candidaturas por vaga: contador em cada vaga e lista de quem se candidatou.
// Depende das funções e variáveis globais de painel.js (jobs, candidates, textElement, openCandidate etc.).
let applications = [];

async function loadApplications() {
  const { data, error } = await supabaseClient.from("candidaturas_vagas").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Falha ao consultar candidaturas:", error);
    applications = [];
  } else {
    applications = data || [];
  }
  if (jobs.length) renderJobsAdmin(false);
}

function applicationsForJob(job) {
  return applications.filter((item) => String(item.vaga_id) === String(job.id));
}

function candidateByEmail(email) {
  const target = String(email || "").toLowerCase();
  return candidates.find((candidate) => String(candidate.email || "").toLowerCase() === target);
}

const originalRenderJobsAdmin = renderJobsAdmin;
renderJobsAdmin = function (unavailable = false) {
  originalRenderJobsAdmin(unavailable);
  if (unavailable) return;
  byId("admin-jobs-list").querySelectorAll(".admin-job-card").forEach((card, index) => {
    const job = jobs[index];
    const toggle = card.querySelector(".job-toggle");
    if (!job || !toggle) return;
    const button = textElement("button", "job-applications", `Candidaturas (${applicationsForJob(job).length})`);
    button.type = "button";
    button.addEventListener("click", () => openApplications(job));
    const actions = document.createElement("div");
    actions.className = "admin-job-actions";
    actions.append(button, toggle);
    card.append(actions);
  });
};

const originalLoadWorkspace = loadWorkspace;
loadWorkspace = async function () {
  await originalLoadWorkspace();
  await loadApplications();
};
byId("refresh-button").addEventListener("click", loadApplications);

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

function applicationItem(application) {
  const candidate = candidateByEmail(application.candidato_email);
  const item = document.createElement("article");
  item.className = "application-item";

  const head = document.createElement("div");
  head.className = "application-head";
  head.append(textElement("strong", "", candidate ? candidate.nome || application.candidato_email : application.candidato_email), textElement("small", "", formatDate(application.created_at)));

  const info = document.createElement("div");
  info.className = "application-info";
  info.append(textElement("span", "", application.candidato_email));
  if (candidate && candidate.telefone) info.append(textElement("span", "", candidate.telefone));
  if (candidate) info.append(textElement("span", `stage-badge stage-${stageOf(candidate)}`, stageLabel(stageOf(candidate))));

  const actions = document.createElement("div");
  actions.className = "application-actions";
  if (candidate) {
    const profile = textElement("button", "action-link", "Ver perfil");
    profile.type = "button";
    profile.addEventListener("click", () => { closeApplications(); openCandidate(candidate); });
    actions.append(profile);
    if (candidate.url_curriculo) actions.append(actionLink("Currículo", candidate.url_curriculo));
    if (phoneDigits(candidate.telefone)) actions.append(actionLink("WhatsApp", whatsappUrl(candidate), "whatsapp"));
  }
  item.append(head, info, actions);
  return item;
}

function openApplications(job) {
  const list = applicationsForJob(job);
  byId("applications-title").textContent = job.titulo || "Vaga";
  byId("applications-meta").textContent = `${job.area || "Área"} · ${job.cidade || "Local a definir"} · ${list.length} ${list.length === 1 ? "candidatura" : "candidaturas"}`;
  const root = byId("applications-list");
  root.replaceChildren();
  if (!list.length) root.append(textElement("p", "application-empty", "Ninguém se candidatou a esta vaga ainda."));
  else list.forEach((application) => root.append(applicationItem(application)));
  const drawer = byId("applications-drawer");
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("open"));
  document.body.style.overflow = "hidden";
}

function closeApplications() {
  const drawer = byId("applications-drawer");
  drawer.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(() => { drawer.hidden = true; }, 220);
}

document.querySelectorAll("[data-app-close]").forEach((el) => el.addEventListener("click", closeApplications));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !byId("applications-drawer").hidden) closeApplications(); });
