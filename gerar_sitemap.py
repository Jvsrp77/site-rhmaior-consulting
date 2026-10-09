"""Gera o sitemap.xml incluindo as vagas ativas do Supabase.

Rode antes de cada deploy (depois de publicar ou encerrar vagas no painel RH):
    python gerar_sitemap.py

Só usa a chave pública (anon) que já está no site, e a biblioteca padrão do Python.
Se mudar o domínio do site, ajuste BASE_URL abaixo (e o config.js / robots.txt).
"""
import json
import urllib.request
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

BASE_URL = "https://glowing-pithivier-f2a82e.netlify.app"
SUPABASE_URL = "https://qaviuelxsokbdpllqrap.supabase.co"
PAGINAS = [
    ("index.html", "weekly", "1.0"),
    ("vagas.html", "daily", "0.9"),
    ("modelo-curriculo.html", "monthly", "0.6"),
    ("privacidade.html", "monthly", "0.3"),
]


def chave_anon():
    texto = (Path(__file__).parent / "vagas.js").read_text(encoding="utf-8")
    inicio = texto.index("SUPABASE_ANON_KEY")
    return texto[inicio:].split('"')[1]


def buscar_vagas():
    chave = chave_anon()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/vagas?select=id,updated_at,validade&ativa=eq.true",
        headers={"apikey": chave, "Authorization": f"Bearer {chave}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        vagas = json.load(resp)
    hoje = date.today().isoformat()
    return [v for v in vagas if not v.get("validade") or v["validade"] >= hoje]


def url_xml(loc, freq, prioridade, lastmod=None):
    linhas = [f"    <loc>{escape(loc)}</loc>"]
    if lastmod:
        linhas.append(f"    <lastmod>{lastmod}</lastmod>")
    linhas += [f"    <changefreq>{freq}</changefreq>", f"    <priority>{prioridade}</priority>"]
    return "  <url>\n" + "\n".join(linhas) + "\n  </url>"


def main():
    vagas = buscar_vagas()
    blocos = [url_xml(f"{BASE_URL}/{pagina}", freq, prio) for pagina, freq, prio in PAGINAS]
    for vaga in vagas:
        lastmod = (vaga.get("updated_at") or "")[:10] or None
        blocos.append(url_xml(f"{BASE_URL}/vaga.html?id={vaga['id']}", "daily", "0.8", lastmod))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(blocos)
        + "\n</urlset>\n"
    )
    (Path(__file__).parent / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"sitemap.xml gerado: {len(PAGINAS)} páginas + {len(vagas)} vaga(s) ativa(s).")


if __name__ == "__main__":
    main()
