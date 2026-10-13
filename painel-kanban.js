// Visão em kanban do banco de talentos + exportação para planilha.
// Depende das funções e variáveis globais de painel.js (candidates, textElement, personBlock etc.).
const KANBAN_STAGES = ["novo", "triagem", "entrevista", "finalista", "contratado"];
const BOARD_STORAGE_KEY = "painel-modo-talentos";
let boardMode = "list";
try { if (localStorage.getItem(BOARD_STORAGE_KEY) === "kanban") boardMode = "kanban"; } catch { /* sem armazenamento */ }

function box(tag, className) { const el = document.createElement(tag); el.className = className; return el; }

function kanbanCandidates() {
  const term = normalize(byId("search-input").value), area = byId("area-filter").value;
  return candidates.filter((candidate) =>
    (!term || normalize(`${candidate.nome} ${candidate.email}`).includes(term)) &&
    (!area || areaOf(candidate) === area));
}

function setKanbanStatus(message, isError = false) {
  const status = byId("kanban-status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function moveCandidate(id, stage) {
  const candidate = candidates.find((item) => String(item.id) === String(id));
  if (!candidate || stageOf(candidate) === stage) return;
  const previous = candidate.status_processo;
  const name = candidate.nome || "Candidato";
  candidate.status_processo = stage;
  renderCandidates();
  updateMetrics();
  setKanbanStatus(`Movendo ${name} para ${stageLabel(stage)}...`);
  const { error } = await supabaseClient.from("candidatos").update({ status_processo: stage }).eq("id", candidate.id);
  if (error) {
    console.error("Falha ao mover candidato:", error);
    candidate.status_processo = previous;
    renderCandidates();
    updateMetrics();
    setKanbanStatus(`Não foi possível mover ${name}. Tente novamente.`, true);
    return;
  }
  setKanbanStatus(`${name} movido para ${stageLabel(stage)}.`);
}

function kanbanCard(candidate) {
  const card = box("article", "kanban-card");
  card.draggable = true;
  card.dataset.id = candidate.id;
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", String(candidate.id));
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));

  const meta = box("div", "kanban-meta");
  meta.append(textElement("span", "area-badge", areaOf(candidate)));
  if (candidate.telefone) meta.append(textElement("small", "", candidate.telefone));

  const actions = box("div", "kanban-actions");
  const profile = textElement("button", "action-link", "Ver perfil");
  profile.type = "button";
  profile.addEventListener("click", () => openCandidate(candidate));
  actions.append(profile);
  if (phoneDigits(candidate.telefone)) actions.append(actionLink("WhatsApp", whatsappUrl(candidate), "whatsapp"));

  const move = document.createElement("select");
  move.className = "kanban-move";
  move.setAttribute("aria-label", `Mover ${candidate.nome || "candidato"} para outra etapa`);
  KANBAN_STAGES.forEach((stage) => {
    const option = textElement("option", "", stageLabel(stage));
    option.value = stage;
    move.append(option);
  });
  move.value = stageOf(candidate);
  move.addEventListener("change", () => moveCandidate(candidate.id, move.value));

  card.append(personBlock(candidate), meta, actions, move);
  return card;
}

function renderKanban() {
  const board = byId("kanban");
  if (!board || board.hidden) return;
  board.replaceChildren();
  const list = kanbanCandidates();
  byId("result-count").textContent = `${list.length} ${list.length === 1 ? "profissional" : "profissionais"} no quadro`;
  KANBAN_STAGES.forEach((stage) => {
    const items = list.filter((candidate) => stageOf(candidate) === stage);
    const column = box("section", "kanban-col");
    column.dataset.stage = stage;
    const head = box("header", "kanban-head");
    head.append(textElement("span", `stage-badge stage-${stage}`, stageLabel(stage)), textElement("strong", "", items.length));
    const body = box("div", "kanban-body");
    if (items.length) items.forEach((candidate) => body.append(kanbanCard(candidate)));
    else body.append(textElement("p", "kanban-empty", "Nenhum candidato"));
    column.append(head, body);
    column.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; column.classList.add("drag-over"); });
    column.addEventListener("dragleave", (event) => { if (!column.contains(event.relatedTarget)) column.classList.remove("drag-over"); });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      moveCandidate(event.dataTransfer.getData("text/plain"), stage);
    });
    board.append(column);
  });
}

function applyBoardMode(mode, render = true) {
  boardMode = mode;
  const kanban = mode === "kanban";
  byId("kanban").hidden = !kanban;
  byId("kanban-status").hidden = !kanban;
  document.querySelector("#view-talents .table-scroll").hidden = kanban;
  byId("mobile-candidates").hidden = kanban;
  byId("stage-filter").closest("label").hidden = kanban;
  byId("view-list").classList.toggle("active", !kanban);
  byId("view-list").setAttribute("aria-pressed", String(!kanban));
  byId("view-kanban").classList.toggle("active", kanban);
  byId("view-kanban").setAttribute("aria-pressed", String(kanban));
  try { localStorage.setItem(BOARD_STORAGE_KEY, mode); } catch { /* ignora */ }
  if (render) renderCandidates();
}

// Planilha: abre direto no Excel, e células que começam com = + - @ são neutralizadas (injeção de fórmula).
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCandidatesCsv() {
  const list = boardMode === "kanban" ? kanbanCandidates() : filteredCandidates();
  const header = ["Nome", "E-mail", "Telefone", "Área", "Etapa", "Tags", "Observações", "Currículo anexado", "Cadastro"];
  const rows = list.map((candidate) => [
    candidate.nome, candidate.email, candidate.telefone, areaOf(candidate), stageLabel(stageOf(candidate)),
    candidate.tags, candidate.observacoes, candidate.url_curriculo ? "Sim" : "Não", candidate.created_at ? String(candidate.created_at).slice(0, 10) : ""
  ]);
  const csv = "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `candidatos-rhmaior-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

byId("view-list").addEventListener("click", () => applyBoardMode("list"));
byId("view-kanban").addEventListener("click", () => applyBoardMode("kanban"));
byId("export-csv").addEventListener("click", exportCandidatesCsv);
applyBoardMode(boardMode, false);
