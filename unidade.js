const SUPABASE_URL = "https://qaviuelxsokbdpllqrap.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdml1ZWx4c29rYmRwbGxxcmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg4OTYsImV4cCI6MjEwMTM1NDg5Nn0.zvk7kGck96OM3kyTfLE-5Rr968ErvAYDXPKoA2f_e_s";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const unitKey = document.body.dataset.unitKey;
const unitCity = document.body.dataset.unitCity;
const root = document.getElementById("unit-jobs");

function normalize(value) { return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function make(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }

function showEmpty(title, text) {
  const empty = make("div", "jobs-empty");
  empty.append(make("strong", "", title), make("span", "", text));
  root.replaceChildren(empty);
}

function renderJobs(list) {
  if (!list.length) { showEmpty(`Nenhuma vaga aberta em ${unitCity} agora`, "Cadastre seu currículo no banco de talentos para ser considerado em futuras oportunidades."); return; }
  root.replaceChildren(...list.map((job) => {
    const card = make("article", "job-card"), content = make("div"), meta = make("div", "job-meta");
    meta.append(make("span", "", job.area || "Oportunidade"), make("span", "", job.modalidade || "A combinar"), make("span", "", job.cidade || "Local a definir"));
    content.append(meta, make("h3", "", job.titulo), make("p", "", job.resumo || "Conheça os detalhes desta oportunidade."));
    const actions = make("div", "job-card-actions"), details = make("a", "button button-dark", "Ver detalhes →");
    details.href = `vaga.html?id=${encodeURIComponent(job.id)}`;
    actions.append(details);
    card.append(content, actions);
    return card;
  }));
}

async function loadJobs() {
  const { data, error } = await supabaseClient.from("vagas").select("id,titulo,resumo,area,modalidade,cidade,created_at").eq("ativa", true).order("created_at", { ascending: false });
  if (error) { showEmpty("Vagas indisponíveis no momento", "Confira todas as oportunidades na página de vagas."); return; }
  renderJobs((data || []).filter((job) => normalize(job.cidade).includes(unitKey)));
}
loadJobs();
