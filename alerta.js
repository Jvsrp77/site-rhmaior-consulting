const SUPABASE_URL = "https://qaviuelxsokbdpllqrap.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdml1ZWx4c29rYmRwbGxxcmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg4OTYsImV4cCI6MjEwMTM1NDg5Nn0.zvk7kGck96OM3kyTfLE-5Rr968ErvAYDXPKoA2f_e_s";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MESSAGES = {
  confirmar: {
    ok: ["Alerta confirmado!", "Pronto: você vai receber um e-mail sempre que uma vaga compatível for publicada. Dá para cancelar a qualquer momento pelo link no rodapé dos avisos."],
    fail: ["Não encontramos este alerta", "O link pode estar incompleto ou o alerta já foi removido. Crie um novo alerta na página de vagas."]
  },
  cancelar: {
    ok: ["Alerta cancelado", "Você não vai mais receber avisos de vagas neste e-mail. Se mudar de ideia, é só criar um novo alerta na página de vagas."],
    fail: ["Não encontramos este alerta", "O link pode estar incompleto ou o alerta já foi removido."]
  }
};

async function run() {
  const params = new URLSearchParams(location.search);
  const action = params.get("acao");
  const token = params.get("token") || "";
  const title = document.getElementById("alert-title");
  const text = document.getElementById("alert-text");
  const show = ([heading, body]) => { title.textContent = heading; text.textContent = body; };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  if (!MESSAGES[action] || !isUuid) { show(["Link inválido", "Este endereço não corresponde a um alerta de vagas. Use o link enviado por e-mail."]); return; }

  const rpc = action === "confirmar" ? "confirmar_alerta" : "cancelar_alerta";
  const { data, error } = await supabaseClient.rpc(rpc, { p_token: token });
  if (error) { console.error("Falha ao atualizar o alerta:", error); show(["Não foi possível concluir", "Tente novamente em alguns minutos."]); return; }
  show(data ? MESSAGES[action].ok : MESSAGES[action].fail);
}
run();
