const SUPABASE_URL = "https://qaviuelxsokbdpllqrap.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdml1ZWx4c29rYmRwbGxxcmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg4OTYsImV4cCI6MjEwMTM1NDg5Nn0.zvk7kGck96OM3kyTfLE-5Rr968ErvAYDXPKoA2f_e_s";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
let jobs = [];
let activeModal = null;

async function loadJobs() {
  const { data, error } = await supabaseClient.from("vagas").select("*").eq("ativa", true).order("created_at", { ascending: false });
  if (error) { console.info("Módulo de vagas aguardando configuração."); jobs = []; renderJobs(true); return; }
  jobs = data || []; renderJobs(false);
}
function normalize(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
const UNITS = [
  { name: "São José dos Campos", key: "sao jose dos campos", lat: -23.2237, lon: -45.9009, phone: "(12) 99177-0400" },
  { name: "São Paulo", key: "sao paulo", lat: -23.5505, lon: -46.6333, phone: "(19) 99361-8825" },
  { name: "Campinas", key: "campinas", lat: -22.9099, lon: -47.0626, phone: "(19) 99361-8825" },
  { name: "Jundiaí", key: "jundiai", lat: -23.1857, lon: -46.8978, phone: "(19) 99361-8825" },
  { name: "Pindamonhangaba", key: "pindamonhangaba", lat: -22.9246, lon: -45.4617, phone: "(12) 99179-0889" },
  { name: "Embu das Artes", key: "embu das artes", lat: -23.6489, lon: -46.8523, phone: "(11) 97601-8846" },
  { name: "Extrema", key: "extrema", lat: -22.8545, lon: -46.3178, phone: "(35) 98471-7375" }
];
function unitByValue(value) { return UNITS.find(u => u.name === value); }
function filteredJobs() {
  const term = normalize($("job-search").value), mode = $("job-mode").value, unit = unitByValue($("job-unit").value);
  return jobs.filter(j =>
    (!term || normalize(`${j.titulo} ${j.area} ${j.cidade}`).includes(term)) &&
    (!mode || j.modalidade === mode) &&
    (!unit || normalize(j.cidade).includes(unit.key) || j.modalidade === "Remoto"));
}
function updateUnitInfo() {
  const info = $("unit-info"), unit = unitByValue($("job-unit").value);
  if (!unit) { info.hidden = true; return; }
  info.textContent = `Unidade ${unit.name} · ${unit.phone}. Vagas remotas também aparecem nesta lista.`;
  info.hidden = false;
}
function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
function findNearestUnit() {
  const button = $("job-near"), info = $("unit-info");
  if (!navigator.geolocation) { info.textContent = "Seu navegador não permite localizar a unidade mais próxima. Escolha uma unidade na lista."; info.hidden = false; return; }
  button.disabled = true;
  info.textContent = "Localizando a unidade mais próxima...";
  info.hidden = false;
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const nearest = UNITS.map(u => ({ u, d: distanceKm(latitude, longitude, u.lat, u.lon) })).sort((a, b) => a.d - b.d)[0];
    $("job-unit").value = nearest.u.name;
    updateUnitInfo();
    info.textContent = `Unidade mais próxima: ${nearest.u.name} (a cerca de ${Math.round(nearest.d)} km) · ${nearest.u.phone}.`;
    button.disabled = false;
    renderJobs(false);
  }, () => {
    info.textContent = "Não foi possível obter sua localização. Escolha uma unidade na lista.";
    button.disabled = false;
  }, { timeout: 10000, maximumAge: 600000 });
}
function make(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
function renderJobs(unavailable=false){const root=$("jobs-list");root.replaceChildren();const list=filteredJobs();$("jobs-count").textContent=jobs.length;if(!list.length){const empty=make("div","jobs-empty");empty.append(make("strong","",unavailable?"Novas oportunidades em preparação":"Nenhuma vaga encontrada"),make("span","",unavailable?"O módulo de vagas ficará disponível após a configuração segura do Supabase.":"Ajuste os filtros ou cadastre seu currículo no banco de talentos."));root.append(empty);return}list.forEach(job=>{const card=make("article","job-card"),content=make("div"),meta=make("div","job-meta");meta.append(make("span","",job.area||"Oportunidade"),make("span","",job.modalidade||"A combinar"),make("span","",job.cidade||"Local a definir"));content.append(meta,make("h3","",job.titulo),make("p","",job.resumo||"Conheça os detalhes desta oportunidade."));const actions=make("div","job-card-actions"),details=make("a","button button-ghost-dark","Ver detalhes");details.href=`vaga.html?id=${encodeURIComponent(job.id)}`;const button=make("button","button button-dark","Candidatar →");button.type="button";button.addEventListener("click",()=>openApplication(job));actions.append(details,button);card.append(content,actions);root.append(card)})}
function openApplication(job){$("application-job-id").value=job.id;$("application-job").textContent=`${job.titulo} · ${job.cidade||job.modalidade||""}`;activeModal=$("application-modal");activeModal.hidden=false;requestAnimationFrame(()=>activeModal.classList.add("is-open"));document.body.classList.add("modal-open")}
function closeModal(){if(!activeModal)return;const modal=activeModal;modal.classList.remove("is-open");document.body.classList.remove("modal-open");activeModal=null;setTimeout(()=>modal.hidden=true,220)}
document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeModal));document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});$("job-search").addEventListener("input",()=>renderJobs(false));$("job-mode").addEventListener("change",()=>renderJobs(false));$("job-unit").addEventListener("change",()=>{updateUnitInfo();renderJobs(false)});$("job-near").addEventListener("click",findNearestUnit);
$("application-form").addEventListener("submit",async(event)=>{event.preventDefault();const button=$("application-submit"),status=$("application-status"),file=$("application-file").files[0];if(!file||!file.name.toLowerCase().endsWith(".pdf")||file.size>10*1024*1024){status.textContent="Envie um PDF válido de até 10 MB.";status.classList.add("is-error");return}button.disabled=true;status.classList.remove("is-error");status.textContent="Enviando candidatura...";try{const path=`${Date.now()}_${crypto.randomUUID()}.pdf`,candidateEmail=$("application-email").value.trim().toLowerCase();const{error:uploadError}=await supabaseClient.storage.from("curriculos").upload(path,file,{contentType:"application/pdf",upsert:false});if(uploadError)throw uploadError;const{data:urlData}=supabaseClient.storage.from("curriculos").getPublicUrl(path);const candidate={nome:$("application-name").value.trim(),email:candidateEmail,telefone:$("application-phone").value.trim(),vaga_interesse:"Vaga específica",url_curriculo:urlData.publicUrl};const{error:candidateError}=await supabaseClient.from("candidatos").upsert([candidate],{onConflict:"email"});if(candidateError)throw candidateError;await supabaseClient.from("candidatos").update({consentimento_lgpd:true,data_consentimento:new Date().toISOString()}).eq("email",candidateEmail);const{error:applicationError}=await supabaseClient.from("candidaturas_vagas").insert([{vaga_id:$("application-job-id").value,candidato_email:candidateEmail}]);if(applicationError)throw applicationError;event.target.reset();status.textContent="Candidatura recebida com sucesso!";setTimeout(closeModal,1800)}catch(error){console.error("Falha na candidatura:",error);status.textContent="Não foi possível concluir. Tente novamente ou use o banco de talentos.";status.classList.add("is-error")}finally{button.disabled=false}});
$("alert-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("alert-submit"), status = $("alert-status"), email = $("alert-email").value.trim().toLowerCase();
  status.classList.remove("is-error");
  if (!/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(email)) { status.textContent = "Informe um e-mail válido."; status.classList.add("is-error"); return; }
  if (!$("alert-consent").checked) { status.textContent = "Marque a autorização para criar o alerta."; status.classList.add("is-error"); return; }
  button.disabled = true;
  status.textContent = "Criando alerta...";
  const { error } = await supabaseClient.from("alertas_vagas").insert([{ email, area: $("alert-area").value || null, unidade: $("alert-unit").value || null, consentimento: true }]);
  button.disabled = false;
  if (error && error.code !== "23505") {
    console.error("Falha ao criar alerta:", error);
    status.textContent = "Não foi possível criar o alerta agora. Tente novamente mais tarde.";
    status.classList.add("is-error");
    return;
  }
  event.target.reset();
  status.textContent = "Quase lá! Enviamos um e-mail para você confirmar o alerta. Confira também a caixa de spam.";
});
const unitParam = new URLSearchParams(location.search).get("unidade");
if (unitParam && unitByValue(unitParam)) { $("job-unit").value = unitParam; updateUnitInfo(); }
loadJobs();
