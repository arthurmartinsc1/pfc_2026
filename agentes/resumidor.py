"""
Agente resumidor — migrado do notebook original de resumo (prototipo em Colab).

Extracao de artigo (requests+trafilatura, com fallback Playwright para sites
React/Next.js) preservada do notebook. Geracao do resumo feita via chamada a um
LLM servido remotamente (vLLM, API compativel com OpenAI) numa VM com GPU —
nenhum peso e carregado neste processo.
"""

import asyncio
import logging
import re
import time

import requests
import trafilatura
from bs4 import BeautifulSoup

import config
from google_news import USER_AGENT, resolver_url
from llm_client import gerar

logger = logging.getLogger(__name__)


# --- Extracao do artigo -------------------------------------------------

_PADROES_RUIDO = [
    r"—\s*Foto:.*?(?=\n|$)",
    r"(?im)^\s*Foto:\s.*?$",
    r"(?im)^\s*(legenda|crédito|credito):\s.*?$",
    r"(?im)^\s*(leia\s+(também|tambem|mais)|veja\s+(também|tambem|vídeos?|videos?)|compartilhe|siga\s+nos|assine\s+a|publicidade|continua\s+depois|publicidade\.?)\b.*$",
    r"(?im)^\s*(reuters|afp|ap|efe|getty\s*images|ag[eê]ncia\s+brasil)\s*$",
    r"(?im)^\s*\d+\s+min\s+de\s+leitura\s*$",
    r"(?im)^\s*compartilhar\s+no\s+(whatsapp|facebook|twitter|x).*$",
]

_SINAIS_JS_CSR = [
    'id="__next"', "id='__next'",
    "window.__next_data__",
    "/_next/static/",
    'id="root"', "id='root'",
    "data-reactroot",
    "/static/js/main.",
    "__nuxt", 'id="nuxt"',
]


def _extrair_titulo(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for sel in ["h1", "meta[property='og:title']", "title"]:
        tag = soup.select_one(sel)
        if tag is None:
            continue
        texto = tag.get("content") if tag.name == "meta" else tag.get_text(strip=True)
        if texto:
            return texto.strip()
    return ""


def _fallback_bs4(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()
    paragrafos = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    paragrafos = [p for p in paragrafos if len(p.split()) > 5]
    return "\n\n".join(paragrafos)


def limpar_texto(texto: str) -> str:
    if not texto:
        return texto
    for padrao in _PADROES_RUIDO:
        texto = re.sub(padrao, "", texto)
    texto = re.sub(r"[ \t]+", " ", texto)
    texto = re.sub(r"\n{2,}", "\n\n", texto).strip()
    return texto


def fetch_noticia(url: str, timeout: int = 20) -> dict:
    url_resolvida = resolver_url(url)
    resp = requests.get(url_resolvida, headers={"User-Agent": USER_AGENT}, timeout=timeout)
    resp.raise_for_status()
    html = resp.text
    titulo = _extrair_titulo(html)
    texto = trafilatura.extract(
        html, include_comments=False, include_tables=False, favor_recall=True,
    ) or ""
    if len(texto.split()) < 40:
        texto = _fallback_bs4(html)
    texto = limpar_texto(texto)
    return {"url": url_resolvida, "url_original": url, "titulo": titulo, "texto": texto}


async def _playwright_html(url: str, timeout_ms: int = 30_000) -> str:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        page = await browser.new_page(user_agent=USER_AGENT)
        await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
        await page.wait_for_timeout(2_000)
        html = await page.content()
        await browser.close()
    return html


def fetch_noticia_playwright(url: str, timeout: int = 30) -> dict:
    html = asyncio.run(_playwright_html(url, timeout_ms=timeout * 1_000))
    titulo = _extrair_titulo(html)
    texto = trafilatura.extract(
        html, include_comments=False, include_tables=False, favor_recall=True
    ) or ""
    if len(texto.split()) < 40:
        texto = _fallback_bs4(html)
    texto = limpar_texto(texto)
    return {"url": url, "url_original": url, "titulo": titulo, "texto": texto}


def _precisa_playwright(html: str, min_palavras: int = 40) -> bool:
    texto = trafilatura.extract(
        html, include_comments=False, include_tables=False, favor_recall=True
    ) or ""
    if len(texto.split()) >= min_palavras:
        return False
    html_lower = html.lower()
    return any(sinal.lower() in html_lower for sinal in _SINAIS_JS_CSR)


def fetch_noticia_auto(url: str, timeout: int = 20) -> dict:
    url_resolvida = resolver_url(url)
    try:
        resp = requests.get(url_resolvida, headers={"User-Agent": USER_AGENT}, timeout=timeout)
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        logger.info("requests falhou (%s); usando Playwright como fallback...", e)
        return fetch_noticia_playwright(url_resolvida, timeout=timeout)

    if not _precisa_playwright(html):
        titulo = _extrair_titulo(html)
        texto = trafilatura.extract(
            html, include_comments=False, include_tables=False, favor_recall=True
        ) or _fallback_bs4(html)
        texto = limpar_texto(texto)
        return {"url": url_resolvida, "url_original": url, "titulo": titulo, "texto": texto}

    logger.info("CSR detectado (React/Next.js sem SSR) - usando Playwright.")
    return fetch_noticia_playwright(url_resolvida, timeout=timeout)


# --- Geracao do resumo ---------------------------------------------------

SYSTEM_PROMPT = (
    "Voce e um jornalista senior especializado em coberturas internacionais, economia e politica brasileira. "
    "Seu estilo e claro, denso e narrativo: conecta fatos com fluidez, usa transicoes naturais entre os temas "
    "e escreve como se estivesse explicando a noticia em profundidade para um leitor informado mas que nao "
    "acompanhou o caso. Aproveite todo o espaco disponivel para detalhar fatos, numeros, citacoes, contexto "
    "historico e desdobramentos - nao resuma de forma telegrafica nem corte informacao relevante por economia "
    "de espaco. Responda SEMPRE no formato exato pedido, sem introducoes, sem comentarios e sem repetir o "
    "enunciado. Use apenas informacoes presentes no texto fornecido. Nao invente datas, numeros, cargos ou nomes. "
    "CRITICO: use APENAS dois-pontos ASCII simples (:) apos os rotulos — nunca o caractere ： (fullwidth). "
    "Use APENAS hifen ASCII (-) nos itens de lista — nunca – ou —. "
    "Cada secao deve comecar em uma linha nova."
)

USER_TEMPLATE_CURTO = """Noticia:
\"\"\"
{texto}
\"\"\"

Produza exatamente no formato abaixo (sem texto adicional, use apenas `:` e `-` ASCII):
ASSUNTO: <tema central em uma linha>
PRINCIPAIS TEMAS:
- <tema 1>
- <tema 2>
- <tema 3>
- <tema 4>
- <tema 5>
RESUMO: <resumo completo e aprofundado em portugues, cobrindo todos os temas relevantes com fatos, numeros, citacoes e contexto - pode ter varios paragrafos, entre 800 e 1000 caracteres, sem repetir os rotulos acima>
"""

# Teto de saida generoso: os modelos remotos (9-12B, GPU dedicada) aguentam
# resumos bem mais ricos que os modelos pequenos que rodavam localmente em
# CPU/MPS. min_new_tokens evita que o modelo pare cedo demais.
MAX_NEW_TOKENS = 700
MIN_NEW_TOKENS = 180
# Entrada quase sem corte: 6000 tokens (~4500 palavras) cobrem qualquer materia
# jornalistica por inteiro; o teto e so uma rede de seguranca contra outliers
# (liveblogs, paginas mal extraidas), aproveitando o contexto de 100k do servidor.
MAX_NOTICIA_TOKENS = 6000

RESUMO_ALVO_CHARS = 800
RESUMO_MAX_CHARS = 1000


# Sem tokenizer local (a geracao roda no servidor remoto), a truncagem usa uma
# estimativa de chars/token para portugues/ingles em vez de contagem exata.
CHARS_POR_TOKEN_ESTIMADO = 4


def _truncar_noticia(texto: str, max_noticia_tokens: int) -> str:
    max_chars = max_noticia_tokens * CHARS_POR_TOKEN_ESTIMADO
    if len(texto) <= max_chars:
        return texto
    return texto[:max_chars]


def _gerar_com_limites(user_msg: str, max_new_tokens: int, min_new_tokens: int) -> str:
    saida = gerar(
        base_url=config.RESUMIDOR_LLM_BASE_URL,
        model=config.RESUMIDOR_LLM_MODEL,
        system=SYSTEM_PROMPT,
        user=user_msg,
        max_tokens=max_new_tokens,
        min_tokens=min_new_tokens,
    )
    return re.sub(r"<\|[^|>]+\|>.*", "", saida, flags=re.DOTALL).strip()


def gerar_resumo(texto_noticia: str) -> str:
    texto = _truncar_noticia(texto_noticia, MAX_NOTICIA_TOKENS)
    user_msg = USER_TEMPLATE_CURTO.format(texto=texto)

    logger.info(
        "Iniciando geracao do resumo (~%d chars de noticia, max_new_tokens=%d)...",
        len(texto), MAX_NEW_TOKENS,
    )
    t0 = time.monotonic()
    saida = _gerar_com_limites(user_msg, MAX_NEW_TOKENS, MIN_NEW_TOKENS)
    logger.info("Geracao concluida em %.1fs (%d caracteres brutos)", time.monotonic() - t0, len(saida))
    return saida


# --- Pos-processamento ----------------------------------------------------

def _remover_andaimes(texto: str) -> str:
    """Remove QUALQUER andaime do prompt que tenha vazado para o texto final:
    linhas/rotulos ASSUNTO / PRINCIPAIS TEMAS / RESUMO e marcadores de lista.
    O que a interface exibe no flash card e so a prosa do resumo."""
    if not texto:
        return texto
    # linhas de rotulo inteiras (apos _pre_processar_saida os rotulos ficam em linhas)
    texto = re.sub(r"(?im)^\s*(ASSUNTO|PRINCIPAIS\s+TEMAS?|TEMAS|RESUMO)\s*[:\-].*$", "", texto)
    # linhas de marcador de lista (os "temas")
    texto = re.sub(r"(?im)^\s*[-*•]\s+.*$", "", texto)
    # rotulos inline remanescentes (quando o modelo nao quebrou linha)
    texto = re.sub(r"(?i)\b(ASSUNTO|PRINCIPAIS\s+TEMAS?|RESUMO)\s*[:：]\s*", "", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def _ajustar_resumo(texto: str, alvo: int = RESUMO_ALVO_CHARS, maximo: int = RESUMO_MAX_CHARS) -> str:
    texto = re.sub(r"\s+", " ", texto).strip()
    if len(texto) <= alvo:
        return texto

    frases = re.split(r"(?<=[.!?])\s+", texto)
    acumulado = ""
    for frase in frases:
        candidato = (acumulado + " " + frase).strip() if acumulado else frase
        if len(candidato) > maximo:
            break
        acumulado = candidato
        if len(acumulado) >= alvo:
            break

    if not acumulado:
        cortado = texto[:maximo].rsplit(" ", 1)[0]
        acumulado = cortado.rstrip(",;:") + "..."

    return acumulado


def _limpar_linha_rotulo(texto: str) -> str:
    texto = re.sub(r"^\s*[-*\d\.\)]+\s*", "", texto or "").strip()
    texto = re.sub(r"^(assunto|tema|resumo)\s*[:\-：]\s*", "", texto, flags=re.I).strip()
    return texto


def _sentencas(texto: str) -> list[str]:
    texto = re.sub(r"\s+", " ", texto or "").strip()
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", texto) if len(s.strip().split()) >= 5]


def _fallback_extrativo(texto_noticia: str, titulo: str = "") -> tuple[str, list[str], str]:
    frases = _sentencas(texto_noticia)
    assunto = titulo.strip() or (frases[0][:120] if frases else "(nao identificado)")
    temas = []
    palavras_vistas = set()
    for frase in frases[:10]:
        candidatos = re.findall(
            r"\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç-]{3,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç-]{2,})?",
            frase,
        )
        for c in candidatos:
            chave = c.lower()
            if chave not in palavras_vistas and len(c.split()) <= 4:
                temas.append(c)
                palavras_vistas.add(chave)
            if len(temas) == 4:
                break
        if len(temas) == 4:
            break
    if len(temas) < 4:
        temas += ["Fato principal", "Contexto politico", "Desdobramentos", "Impactos"][:4 - len(temas)]

    resumo = _ajustar_resumo(" ".join(frases[:25]), alvo=RESUMO_ALVO_CHARS, maximo=RESUMO_MAX_CHARS)
    return assunto, temas[:4], resumo


def _pre_processar_saida(txt: str) -> str:
    txt = txt.replace("：", ":").replace("–", "-").replace("—", "-").replace("•", "-")
    txt = re.sub(r"(?i)\bPRINCIPAI[Ss]\s+TEMAS?\b", "PRINCIPAIS TEMAS", txt)
    for rotulo in [r"ASSUNTO\s*:", r"PRINCIPAIS\s+TEMAS\s*:?", r"RESUMO\s*:"]:
        txt = re.sub(rf"(?<!\n)[ \t]+({rotulo})", r"\n\1", txt, flags=re.I)
    txt = re.sub(r"(?<=[^\n])[ \t]+(- )", r"\n\1", txt)
    return txt


def normalizar_saida(saida_modelo: str, texto_noticia: str = "", titulo: str = "") -> str:
    txt = re.sub(r"```.*?```", "", saida_modelo or "", flags=re.DOTALL).strip()
    txt = txt.replace("**", "")
    txt = _pre_processar_saida(txt)

    assunto_matches = list(re.finditer(r"(?im)^\s*ASSUNTO\s*[:\-]\s*(.+)$", txt))
    temas_matches = list(re.finditer(r"(?im)^\s*PRINCIPAIS\s+TEMAS\s*[:\-]?\s*$", txt))
    resumo_matches = list(re.finditer(r"(?im)^\s*RESUMO\s*[:\-]\s*(.*)$", txt))

    assunto = _limpar_linha_rotulo(assunto_matches[-1].group(1)) if assunto_matches else ""

    temas = []
    if temas_matches:
        ini = temas_matches[-1].end()
        fim = resumo_matches[-1].start() if resumo_matches else len(txt)
        bloco_temas = txt[ini:fim]
        for linha in bloco_temas.splitlines():
            tema = _limpar_linha_rotulo(linha)
            if tema and not re.match(r"(?i)^resumo\b", tema):
                temas.append(tema)
        temas = temas[:4]

    resumo = ""
    if resumo_matches:
        m = resumo_matches[-1]
        resumo = (m.group(1) + "\n" + txt[m.end():]).strip()
        resumo = re.split(r"(?im)^\s*(ASSUNTO|PRINCIPAIS\s+TEMAS)\s*[:\-]", resumo)[0].strip()
        resumo_interno = re.search(r"(?i)RESUMO\s*[：:]\s*(.+)", resumo, flags=re.DOTALL)
        if resumo_interno:
            resumo = resumo_interno.group(1).strip()

    # Blindagem: tira qualquer rotulo/marcador que tenha vazado para o resumo.
    resumo = _remover_andaimes(resumo)
    resumo = _ajustar_resumo(resumo)

    # Se o modelo nao produziu um paragrafo de resumo em prosa (ex: escreveu so
    # ASSUNTO + PRINCIPAIS TEMAS e o teto de tokens cortou antes do RESUMO), cai
    # no fallback extrativo a partir do TEXTO DA NOTICIA - prosa limpa, sem rotulos.
    if not resumo or len(resumo.split()) < 15:
        _, _, resumo_fb = _fallback_extrativo(texto_noticia, titulo)
        resumo = _ajustar_resumo(_remover_andaimes(resumo_fb))

    return resumo.strip()


def resumir_url(url: str) -> dict:
    """Busca o artigo, gera e normaliza o resumo. Levanta excecao em qualquer falha."""
    logger.info("Buscando artigo: %s", url)
    t0 = time.monotonic()
    noticia = fetch_noticia_auto(url)
    n_palavras = len(noticia["texto"].split()) if noticia["texto"] else 0
    logger.info(
        "Artigo extraido em %.1fs: '%s' (%d palavras)",
        time.monotonic() - t0, noticia["titulo"] or "(sem titulo)", n_palavras,
    )
    if not noticia["texto"] or n_palavras < 30:
        raise RuntimeError(f"Nao foi possivel extrair texto suficiente de {noticia['url']}")

    saida_bruta = gerar_resumo(noticia["texto"])
    saida_final = normalizar_saida(saida_bruta, texto_noticia=noticia["texto"], titulo=noticia["titulo"])

    logger.info("Resumo pronto para '%s':\n%s", noticia["titulo"], saida_final)

    return {
        "url": noticia["url"],
        "url_original": noticia.get("url_original", url),
        "titulo": noticia["titulo"],
        "resumo": saida_final,
    }
