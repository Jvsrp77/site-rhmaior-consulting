(function () {
  "use strict";

  function formError(code, cause) {
    const error = new Error(code);
    error.formCode = code;
    error.cause = cause;
    return error;
  }

  function isMissingRpc(error) {
    return error?.code === "PGRST202" || /registrar_candidato_publico|schema cache|function/i.test(error?.message || "");
  }

  async function registerCandidate(client, candidate) {
    const rpcPayload = {
      p_nome: candidate.nome,
      p_email: candidate.email,
      p_telefone: candidate.telefone,
      p_vaga_interesse: candidate.vaga_interesse,
      p_url_curriculo: candidate.url_curriculo
    };
    const { error: rpcError } = await client.rpc("registrar_candidato_publico", rpcPayload);
    if (!rpcError) return;
    if (!isMissingRpc(rpcError)) throw formError("database", rpcError);

    // Compatibilidade com a configuração anterior do projeto. Como o cliente
    // público está isolado da sessão do painel, as políticas antigas podem
    // permitir este upsert mesmo antes da função controlada ser instalada.
    const { error: legacyUpsertError } = await client
      .from("candidatos")
      .upsert([candidate], { onConflict: "email" });
    if (!legacyUpsertError) return;

    const { data: existing, error: lookupError } = await client
      .from("candidatos")
      .select("email")
      .eq("email", candidate.email)
      .limit(1);
    if (!lookupError && existing?.length) throw formError("existing-email", legacyUpsertError);

    const { error: insertError } = await client.from("candidatos").insert([candidate]);
    if (insertError) throw formError(insertError.code === "23505" ? "existing-email" : "database", insertError);
  }

  async function submit({ client, file, candidate }) {
    const path = `${Date.now()}_${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await client.storage
      .from("curriculos")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw formError("storage", uploadError);

    const { data: urlData } = client.storage.from("curriculos").getPublicUrl(path);
    try {
      await registerCandidate(client, { ...candidate, url_curriculo: urlData.publicUrl });
      return { path, publicUrl: urlData.publicUrl };
    } catch (error) {
      // Remove somente o arquivo recém-enviado, caso a política permita.
      await client.storage.from("curriculos").remove([path]).catch(() => {});
      throw error;
    }
  }

  function message(error) {
    if (error?.formCode === "existing-email") return "O envio do PDF funcionou, mas falta ativar a função registrar_candidato_publico no Supabase para atualizar este e-mail.";
    if (error?.formCode === "storage") return "O PDF não pôde ser armazenado. Verifique a política de upload do bucket curriculos.";
    return "Não foi possível salvar seus dados agora. Tente novamente ou entre em contato com a RhMaior.";
  }

  window.MaioRHCandidates = Object.freeze({ submit, message });
})();
