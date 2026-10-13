"""Gera uma página para cada unidade (recrutamento-<cidade>.html) e o JSON-LD da organização.

Rode sempre que mudar endereço/telefone de uma unidade ou o domínio do site:
    python gerar_unidades.py

Depois rode também `python gerar_sitemap.py` para o sitemap incluir as páginas.
Usa só a biblioteca padrão do Python.
"""
import json
import re
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape

BASE_URL = "https://glowing-pithivier-f2a82e.netlify.app"
PASTA = Path(__file__).parent

# slug, cidade (título), nome no filtro de vagas, chave de busca na cidade da vaga,
# rua, bairro, UF, CEP, telefone exibido, telefone internacional (só dígitos)
UNIDADES = [
    ("sao-jose-dos-campos", "São José dos Campos", "São José dos Campos", "sao jose dos campos",
     "Rua Clóvis Bevilaqua, 74", "Jardim Esplanada", "SP", "12.242-790", "(12) 99177-0400", "5512991770400"),
    ("sao-paulo", "São Paulo", "São Paulo", "sao paulo",
     "Rua Almirante Brasil, 685, conj. 1708", "Mooca", "SP", "03.162-010", "(19) 99361-8825", "5519993618825"),
    ("campinas", "Campinas", "Campinas", "campinas",
     "R. Júlio Frank de Arruda, 75", "Botafogo", "SP", "13.020-190", "(19) 99361-8825", "5519993618825"),
    ("jundiai", "Jundiaí", "Jundiaí", "jundiai",
     "Rua Bom Jesus de Pirapora, 315", "Via Vianelo", "SP", "13.207-270", "(19) 99361-8825", "5519993618825"),
    ("pindamonhangaba", "Pindamonhangaba", "Pindamonhangaba", "pindamonhangaba",
     "Travessa Justiniano Antunes, 35", "Centro", "SP", "12.400-410", "(12) 99179-0889", "5512991790889"),
    ("embu-das-artes", "Embu das Artes", "Embu das Artes", "embu das artes",
     "Rua Quirino da Silva, 55", "Jardim Silvia", "SP", "06.804-050", "(11) 97601-8846", "5511976018846"),
    ("extrema", "Extrema", "Extrema", "extrema",
     "Rua Melo Viana, 8", "Centro", "MG", "37.640-000", "(35) 98471-7375", "5535984717375"),
]
CHAVES = ["slug", "cidade", "filtro", "busca", "rua", "bairro", "uf", "cep", "fone", "wa"]
DADOS = [dict(zip(CHAVES, u)) for u in UNIDADES]


def arquivo(u):
    return f"recrutamento-{u['slug']}.html"


def url(u):
    return f"{BASE_URL}/{arquivo(u)}"


def endereco_linha(u):
    return f"{u['rua']} — {u['bairro']}, {u['cidade']}/{u['uf']} · CEP {u['cep']}"


def agencia_ld(u):
    return {
        "@type": "EmploymentAgency",
        "name": f"RHMaior Consulting — Unidade {u['cidade']}",
        "url": url(u),
        "telephone": "+" + u["wa"],
        "image": f"{BASE_URL}/logo-rhmaior.jpg",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": f"{u['rua']} — {u['bairro']}",
            "addressLocality": u["cidade"],
            "addressRegion": u["uf"],
            "postalCode": u["cep"],
            "addressCountry": "BR",
        },
        "parentOrganization": {"@type": "Organization", "name": "RHMaior Consulting", "url": BASE_URL},
        "areaServed": {"@type": "City", "name": u["cidade"]},
    }


def json_script(dados):
    return '<script type="application/ld+json">' + json.dumps(dados, ensure_ascii=False) + "</script>"


def pagina(u):
    cidade = u["cidade"]
    mapa = "https://www.google.com/maps/search/?api=1&query=" + quote(f"{u['rua']}, {u['bairro']}, {cidade} {u['uf']}, {u['cep']}")
    wa_texto = quote(f"Olá! Gostaria de conversar com a RHMaior (unidade {cidade}).")
    titulo = f"Recrutamento e seleção em {cidade} | RHMaior Consulting"
    descricao = (f"RHMaior Consulting em {cidade}/{u['uf']}: recrutamento e seleção, executive search e mão de obra temporária. "
                 f"Endereço, telefone e vagas abertas da unidade.")
    outras = "".join(
        f'<a href="{arquivo(o)}">{escape(o["cidade"])}</a>' for o in DADOS if o["slug"] != u["slug"]
    )
    ld = json_script({"@context": "https://schema.org", **agencia_ld(u)})
    return f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{escape(descricao, {'"': '&quot;'})}"><title>{escape(titulo)}</title><link rel="canonical" href="{url(u)}"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="{escape(titulo)}"><meta property="og:description" content="{escape(descricao, {'"': '&quot;'})}"><meta property="og:url" content="{url(u)}"><meta property="og:image" content="{BASE_URL}/og-image.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet"></noscript><link rel="stylesheet" href="styles.css?v=20261009a"><link rel="stylesheet" href="vagas.css">{ld}<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script><script src="unidade.js" defer></script></head>
<body class="jobs-page" data-unit-key="{u['busca']}" data-unit-filter="{escape(u['filtro'])}" data-unit-city="{escape(cidade)}"><a class="skip-link" href="#unit-main">Ir para o conteúdo</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="index.html"><img class="brand-logo" src="logo-rhmaior.jpg" width="226" height="79" alt="RHMaior Consulting"></a><nav class="jobs-nav"><a href="index.html#unidades">Unidades</a><a href="vagas.html">Vagas</a><a href="index.html">Voltar ao site</a></nav></div></header>
  <main id="unit-main">
    <section class="jobs-hero"><div class="jobs-grid-bg"></div><div class="container"><span class="eyebrow eyebrow-dark"><i></i> Unidade {escape(cidade)}</span><h1>Recrutamento e seleção em <em>{escape(cidade)}.</em></h1><p>Atendimento da RHMaior Consulting para empresas de {escape(cidade)} e região: recrutamento e seleção, executive search e mão de obra temporária, com apoio da equipe local.</p><div class="unit-actions"><a class="button button-primary" href="https://wa.me/{u['wa']}?text={wa_texto}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp <span>↗</span></a><a class="button button-ghost" href="tel:+{u['wa']}">Ligar {escape(u['fone'])}</a><a class="button button-ghost" href="{mapa}" target="_blank" rel="noopener noreferrer">Como chegar <span>↗</span></a></div></div></section>
    <section class="jobs-content"><div class="container">
      <div class="unit-info-grid">
        <article class="unit-box"><span class="eyebrow">Endereço</span><h2>Unidade {escape(cidade)}</h2><p>{escape(u['rua'])}<br>{escape(u['bairro'])} — {escape(cidade)}/{u['uf']}<br>CEP {u['cep']}</p><a href="tel:+{u['wa']}">{escape(u['fone'])}</a></article>
        <article class="unit-box"><span class="eyebrow">O que fazemos</span><h2>Soluções para a sua empresa</h2><ul><li><strong>Recrutamento e Seleção:</strong> mapeamento do perfil, triagem qualificada e avaliação técnica e comportamental.</li><li><strong>Executive Search:</strong> busca ativa e confidencial para posições críticas e lideranças.</li><li><strong>Temporários:</strong> contratação ágil para demandas de curto prazo.</li></ul><a class="text-link" href="index.html#solucoes">Conhecer as soluções <span>→</span></a></article>
      </div>
      <div class="jobs-toolbar"><div><span class="eyebrow">Oportunidades</span><h2>Vagas em {escape(cidade)}</h2></div></div>
      <div class="jobs-list" id="unit-jobs"><div class="jobs-loading"><i></i><p>Buscando oportunidades...</p></div></div>
      <p class="unit-more"><a class="text-link" href="vagas.html?unidade={quote(u['filtro'])}">Ver vagas desta unidade e vagas remotas <span>→</span></a></p>
      <div class="talent-cta"><div><span>Empresa ou candidato?</span><h3>Fale com a unidade {escape(cidade)}.</h3><p>Conte sua necessidade de contratação ou cadastre seu currículo no banco de talentos.</p></div><div class="unit-cta-buttons"><a class="button button-primary" href="index.html#contato">Falar com um especialista <span>→</span></a><a class="button button-dark" href="index.html#inicio">Cadastrar currículo <span>→</span></a></div></div>
      <nav class="unit-others" aria-label="Outras unidades"><span>Outras unidades</span><div>{outras}</div></nav>
    </div></section>
  </main>
  <footer class="simple-footer"><div class="container"><span>© 2026 RHMaior Consulting</span><div><a href="index.html">Site principal</a><a href="privacidade.html">Privacidade e LGPD</a><a href="painel_rh.html" rel="nofollow">Portal RH</a></div></div></footer>
</body></html>
'''


def organizacao_ld():
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "RHMaior Consulting",
        "url": BASE_URL,
        "logo": f"{BASE_URL}/logo-rhmaior.jpg",
        "description": "Consultoria especializada em recrutamento, seleção, executive search e mão de obra temporária.",
        "subOrganization": [agencia_ld(u) for u in DADOS],
    }


MARCADOR = "<!-- unidades-ld:inicio -->"
FIM = "<!-- unidades-ld:fim -->"


def atualizar_index():
    caminho = PASTA / "index.html"
    with open(caminho, encoding="utf-8", newline="") as arq:
        html = arq.read()
    bloco = f"{MARCADOR}{json_script(organizacao_ld())}{FIM}"
    padrao = re.compile(re.escape(MARCADOR) + ".*?" + re.escape(FIM), re.S)
    if padrao.search(html):
        novo = padrao.sub(lambda _m: bloco, html)
    else:
        novo = html.replace("</head>", bloco + "</head>", 1)
    with open(caminho, "w", encoding="utf-8", newline="") as arq:
        arq.write(novo)


def main():
    for u in DADOS:
        (PASTA / arquivo(u)).write_text(pagina(u), encoding="utf-8", newline="\n")
    atualizar_index()
    print(f"{len(DADOS)} páginas de unidade geradas e JSON-LD da organização atualizado no index.html.")


if __name__ == "__main__":
    main()
