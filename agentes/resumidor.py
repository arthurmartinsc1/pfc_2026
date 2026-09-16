"""
Agente resumidor — migrado de colab/notice.ipynb.

Extracao de artigo (requests+trafilatura, com fallback Playwright para sites
React/Next.js) e geracao do resumo (Qwen2.5-7B-Instruct) preservadas do notebook.
Unica mudanca: fora do Colab nao ha um event loop ja rodando, entao o Playwright
usa asyncio.run() direto em vez de nest_asyncio + get_event_loop().
"""

import asyncio
import gc
import logging
import re
import time

import requests
import torch
import trafilatura
from bs4 import BeautifulSoup
from huggingface_hub import login
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

import config
from google_news import USER_AGENT, resolver_url
from local_llm import resolver_device, resolver_dtype

logger = logging.getLogger(__name__)

_resumidor = {"tokenizer": None, "pipe": None}


def _get_resumidor_pipeline():
    if _resumidor["pipe"] is not None:
        return _resumidor["tokenizer"], _resumidor["pipe"]

    if config.HF_TOKEN:
        login(token=config.HF_TOKEN)

    device = resolver_device()
    dtype = resolver_dtype(device)
    logger.info("Carregando modelo de resumo %s (device=%s)...", config.RESUMIDOR_MODEL, device)
    tokenizer = AutoTokenizer.from_pretrained(config.RESUMIDOR_MODEL)
    model = AutoModelForCausalLM.from_pretrained(config.RESUMIDOR_MODEL, dtype=dtype)
    model = model.to(device)
    gen_pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=device,
        pad_token_id=tokenizer.eos_token_id,
    )
    _resumidor["tokenizer"] = tokenizer
    _resumidor["pipe"] = gen_pipe
    logger.info("Modelo de resumo carregado.")
    return tokenizer, gen_pipe


def _limpar_cuda():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    elif torch.backends.mps.is_available():
        torch.mps.empty_cache()


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
    "Seu estilo e claro, direto e narrativo: conecta fatos com fluidez, usa transicoes naturais entre os temas "
    "e escreve como se estivesse explicando a noticia para um leitor informado mas que nao acompanhou o caso. "
    "Responda SEMPRE no formato exato pedido, sem introducoes, sem comentarios e sem repetir o enunciado. "
    "Use apenas informacoes presentes no texto fornecido. Nao invente datas, numeros, cargos ou nomes. "
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
RESUMO: <paragrafo de 6 a 8 frases em portugues cobrindo todos os 4 temas, entre 600 e 700 caracteres, sem repetir os rotulos acima>
"""

FALLBACK_TEMPLATE = "### Instrucao:\n{system}\n\n{user}\n\n### Resposta:\n"

# Teto de saida baixo de proposito: o resumo alvo tem ~650 chars (~300 tokens).
# Um teto alto permite geracoes degeneradas quando o modelo nao emite EOS - ele
# gera ate o limite, o que no M4 (MPS) arrasta. 450 cobre o resumo com folga.
MAX_NEW_TOKENS = 450
MIN_NEW_TOKENS = 180
# Entrada truncada agressivamente: cada token gerado reprocessa TODO o texto da
# noticia, entao artigo grande = geracao lenta no MPS. 1200 tokens (~900 palavras)
# ja cobrem o lede/fatos principais de qualquer materia (piramide invertida).
MAX_NOTICIA_TOKENS = 1200
MAX_NOTICIA_TOKENS_RETRY = 900

RESUMO_ALVO_CHARS = 650
RESUMO_MAX_CHARS = 800


def _montar_input(tokenizer, user_msg: str) -> str:
    if not getattr(tokenizer, "chat_template", None):
        return FALLBACK_TEMPLATE.format(system=SYSTEM_PROMPT, user=user_msg)

    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ]
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    except Exception:
        # Alguns templates (ex: Gemma) nao tem role "system" dedicado.
        messages = [{"role": "user", "content": f"{SYSTEM_PROMPT}\n\n{user_msg}"}]
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)


def _truncar_noticia_por_tokens(tokenizer, texto: str, max_noticia_tokens: int) -> str:
    model_max = min(getattr(tokenizer, "model_max_length", 32768), 32768)
    tokens_disponiveis = model_max - MAX_NEW_TOKENS - 256
    template_vazio = _montar_input(tokenizer, USER_TEMPLATE_CURTO.format(texto=""))
    tokens_template = len(tokenizer.encode(template_vazio, add_special_tokens=False))
    max_tokens_noticia = max(tokens_disponiveis - tokens_template, 100)
    max_tokens_noticia = min(max_tokens_noticia, max_noticia_tokens)
    ids = tokenizer.encode(texto, add_special_tokens=False)
    if len(ids) <= max_tokens_noticia:
        return texto
    return tokenizer.decode(ids[:max_tokens_noticia], skip_special_tokens=True)


NUM_BEAMS = 1
# repetition_penalty e no_repeat_ngram_size foram REMOVIDOS de proposito: com
# geracao gulosa (num_beams=1) eles corrompem a saida estruturada (proibir repetir
# 3-gramas quebra os rotulos "ASSUNTO:", "PRINCIPAIS TEMAS:", "- ") e empurram o
# modelo para grafias erradas. So fazem sentido com beam search.


def _gerar_com_limites(gen_pipe, input_text: str, max_new_tokens: int, min_new_tokens: int) -> str:
    kwargs = dict(
        max_new_tokens=max_new_tokens,
        min_new_tokens=min_new_tokens,
        do_sample=False,
        num_beams=NUM_BEAMS,
        return_full_text=False,
    )
    if NUM_BEAMS > 1:
        # Penalidades ajudam a diversidade entre feixes; so ativas com beam search.
        kwargs["repetition_penalty"] = 1.15
        kwargs["no_repeat_ngram_size"] = 3
    result = gen_pipe(input_text, **kwargs)[0]
    saida = result.get("generated_text", "")
    saida = re.sub(r"<\|[^|>]+\|>.*", "", saida, flags=re.DOTALL).strip()
    return saida


def gerar_resumo(texto_noticia: str) -> str:
    tokenizer, gen_pipe = _get_resumidor_pipeline()
    texto = _truncar_noticia_por_tokens(tokenizer, texto_noticia, MAX_NOTICIA_TOKENS)
    input_text = _montar_input(tokenizer, USER_TEMPLATE_CURTO.format(texto=texto))
    n_tokens_entrada = len(tokenizer.encode(input_text, add_special_tokens=False))

    _limpar_cuda()
    logger.info(
        "Iniciando geracao do resumo (%d tokens de entrada, num_beams=%d, max_new_tokens=%d)...",
        n_tokens_entrada, NUM_BEAMS, MAX_NEW_TOKENS,
    )
    t0 = time.monotonic()
    try:
        saida = _gerar_com_limites(gen_pipe, input_text, MAX_NEW_TOKENS, MIN_NEW_TOKENS)
    except RuntimeError as e:
        if "out of memory" not in str(e).lower():
            raise
        logger.warning("CUDA OOM; limpando VRAM e tentando com texto menor...")
        _limpar_cuda()
        texto = _truncar_noticia_por_tokens(tokenizer, texto_noticia, MAX_NOTICIA_TOKENS_RETRY)
        input_text = _montar_input(tokenizer, USER_TEMPLATE_CURTO.format(texto=texto))
        saida = _gerar_com_limites(gen_pipe, input_text, 900, 180)
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

    resumo = _ajustar_resumo(" ".join(frases[:10]), alvo=RESUMO_ALVO_CHARS, maximo=RESUMO_MAX_CHARS)
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
    _limpar_cuda()

    logger.info("Resumo pronto para '%s':\n%s", noticia["titulo"], saida_final)

    return {
        "url": noticia["url"],
        "url_original": noticia.get("url_original", url),
        "titulo": noticia["titulo"],
        "resumo": saida_final,
    }
