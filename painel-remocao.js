// Retirar candidatos: arquivar (reversível) e excluir definitivamente (cadastro, candidaturas e currículo).
// Depende das funções e variáveis globais de painel.js, painel-kanban.js e painel-candidaturas.js.

function toast(message, isError = false) {
  const box = document.createElement("div");
  box.className = `panel-toast${isError ? " error" : ""}`;
  box.setAttribute("role", "status");
  box.textContent = message;
  document.body.append(box);
  setTimeout(() => box.remove(), 5000);
}

function refreshAfterChange() {
  populateAreas();
  renderCandidates();
  updateMetrics();
  if (jobs.length) renderJobsAdmin(false);
}

function closeCandidateDrawer() {
  if (typeof closeDrawer === "function" && !byId("candidate-drawer").hidden) closeDrawer();
}

async function archiveCandidate(candidate, restore = false) {
  const next = restore ? "novo" : "arquivado";
  const name = candidate.nome || candidate.email || "Candidato";
  const { error } = await supabaseClient.from("candidatos").update({ status_processo: next }).eq("id", candidate.id);
  if (error) {
    console.error("Falha ao atualizar candidato:", error);
    toast(`Não foi possível ${restore ? "restaurar" : "arquivar"} ${name}. Tente novamente.`, true);
    return;
  }
  candidate.status_processo = next;
  closeCandidateDrawer();
  refreshAfterChange();
  toast(restore ? `${name} voltou para o banco de talentos (etapa Novo).` : `${name} foi arquivado. Para ver, filtre por "Arquivados".`);
}

async function deleteCandidate(candidate) {
  const name = candidate.nome || candidate.email || "este candidato";
  const confirmed = window.confirm(`Excluir definitivamente ${name}?\n\nIsso apaga o cadastro, as candidaturas em vagas e o currículo. Não dá para desfazer.\n\nSe quiser só tirar do quadro, use "Arquivar".`);
  if (!confirmed) return;
  const email = String(candidate.email || "").toLowerCase();

  const { error: applicationsError } = await supabaseClient.from("candidaturas_vagas").delete().eq("candidato_email", email);
  if (applicationsError) {
    console.error("Falha ao apagar candidaturas:", applicationsError);
    toast(`Não foi possível excluir ${name}. Nada foi apagado. Tente novamente.`, true);
    return;
  }
  const { error: rowError } = await supabaseClient.from("candidatos").delete().eq("id", candidate.id);
  if (rowError) {
    console.error("Falha ao apagar candidato:", rowError);
    toast(`Não foi possível excluir ${name}. Tente novamente.`, true);
    return;
  }
  let fileRemoved = true;
  if (candidate.url_curriculo) {
    const { error: fileError } = await supabaseClient.storage.from("curriculos").remove([resumePath(candidate.url_curriculo)]);
    if (fileError) { console.error("Falha ao apagar currículo:", fileError); fileRemoved = false; }
  }

  candidates = candidates.filter((item) => String(item.id) !== String(candidate.id));
  applications = applications.filter((item) => String(item.candidato_email || "").toLowerCase() !== email);
  closeCandidateDrawer();
  refreshAfterChange();
  toast(fileRemoved ? `${name} foi excluído definitivamente.` : `${name} foi excluído, mas o arquivo do currículo não pôde ser removido. Avise o suporte.`, !fileRemoved);
}

function updateDrawerActions(candidate) {
  const archive = byId("drawer-archive");
  const archived = stageOf(candidate) === "arquivado";
  archive.textContent = archived ? "Restaurar" : "Arquivar";
  archive.onclick = () => archiveCandidate(candidate, archived);
  byId("drawer-delete").onclick = () => deleteCandidate(candidate);
}

const originalOpenCandidate = openCandidate;
openCandidate = function (candidate) {
  originalOpenCandidate(candidate);
  updateDrawerActions(candidate);
};

// Botões "Arquivar/Restaurar" e "Excluir" direto nas linhas da lista (tabela e versão do celular).
function rowButton(label, className, handler) {
  const button = textElement("button", `action-link ${className}`, label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function decorateRows() {
  const list = filteredCandidates();
  const rows = [...byId("lista-candidatos").querySelectorAll("tr")].filter((row) => row.querySelector(".action-cell"));
  const cards = [...byId("mobile-candidates").querySelectorAll(".mobile-card")];
  [[rows, (row) => row.querySelector(".action-cell")], [cards, (card) => card.querySelector(".mobile-actions")]].forEach(([items, holder]) => {
    if (items.length !== list.length) return;
    items.forEach((item, index) => {
      const container = holder(item);
      if (!container || container.querySelector(".row-remove")) return;
      const candidate = list[index];
      const archived = stageOf(candidate) === "arquivado";
      container.append(
        rowButton(archived ? "Restaurar" : "Arquivar", "row-remove", () => archiveCandidate(candidate, archived)),
        rowButton("Excluir", "row-remove row-delete", () => deleteCandidate(candidate))
      );
    });
  });
}

new MutationObserver(decorateRows).observe(byId("lista-candidatos"), { childList: true });
new MutationObserver(decorateRows).observe(byId("mobile-candidates"), { childList: true });
decorateRows();

// Gestão de vagas: botão "Excluir" em cada vaga (apaga a vaga e as candidaturas dela; os candidatos continuam no banco de talentos).
async function deleteJob(job) {
  const count = applicationsForJob(job).length;
  const detail = count
    ? `As ${count} ${count === 1 ? "candidatura" : "candidaturas"} a esta vaga também ${count === 1 ? "será apagada" : "serão apagadas"} (os candidatos continuam no banco de talentos).`
    : "Esta vaga não tem candidaturas.";
  const confirmed = window.confirm(`Excluir a vaga "${job.titulo}"?

${detail}

Não dá para desfazer. Se quiser só tirar do site, desative a vaga no botão "Ativa".`);
  if (!confirmed) return;
  const { error } = await supabaseClient.from("vagas").delete().eq("id", job.id);
  if (error) {
    console.error("Falha ao apagar vaga:", error);
    toast(`Não foi possível excluir a vaga "${job.titulo}". Tente novamente.`, true);
    return;
  }
  jobs = jobs.filter((item) => String(item.id) !== String(job.id));
  applications = applications.filter((item) => String(item.vaga_id) !== String(job.id));
  renderJobsAdmin(false);
  updateMetrics();
  toast(`A vaga "${job.titulo}" foi excluída.`);
}

const previousRenderJobsAdmin = renderJobsAdmin;
renderJobsAdmin = function (unavailable = false) {
  previousRenderJobsAdmin(unavailable);
  if (unavailable) return;
  byId("admin-jobs-list").querySelectorAll(".admin-job-card").forEach((card, index) => {
    const job = jobs[index];
    const actions = card.querySelector(".admin-job-actions");
    if (!job || !actions || actions.querySelector(".job-delete")) return;
    const button = textElement("button", "job-delete", "Excluir");
    button.type = "button";
    button.addEventListener("click", () => deleteJob(job));
    actions.append(button);
  });
};
if (jobs.length) renderJobsAdmin(false);
