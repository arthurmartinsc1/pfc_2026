"""
Agente buscador — migrado de colab/search_agent.ipynb.

Logica de busca (Google News RSS via gnews + decodificacao de URL) e de selecao
por LLM preservadas do notebook. Unica mudanca de comportamento: o notebook
original exigia exatamente 3 topicos e escolhia 2 vencedores cobrindo os 3 temas;
aqui o pipeline roda por keyword individual (uma de cada vez, vinda do banco),
entao a selecao passou a ranquear os TOP_K mais relevantes para 1 unico termo.
"""

import logging
import re
import time

from gnews import GNews
from huggingface_hub import login
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

import config
from google_news import resolver_url
from local_llm import resolver_device, resolver_dtype

logger = logging.getLogger(__name__)

_seletor = {"tokenizer": None, "pipe": None}


def _get_seletor_pipeline():
    """Carrega o modelo de selecao sob demanda e mantem em memoria entre ciclos."""
    if _seletor["pipe"] is not None:
        return _seletor["tokenizer"], _seletor["pipe"]

    if config.HF_TOKEN:
        login(token=config.HF_TOKEN)

    device = resolver_device()
    dtype = resolver_dtype(device)
    logger.info("Carregando modelo de selecao %s (device=%s)...", config.BUSCADOR_MODEL, device)
    tokenizer = AutoTokenizer.from_pretrained(config.BUSCADOR_MODEL)
    model = AutoModelForCausalLM.from_pretrained(config.BUSCADOR_MODEL, dtype=dtype)
    model = model.to(device)
    gen_pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=device,
        max_new_tokens=150,
        do_sample=False,
        pad_token_id=tokenizer.eos_token_id,
    )
    _seletor["tokenizer"] = tokenizer
    _seletor["pipe"] = gen_pipe
    logger.info("Modelo de selecao carregado.")
    return tokenizer, gen_pipe


def _fonte_permitida(fonte: str) -> bool:
    f = fonte.lower()
    return any(permitida in f for permitida in config.FONTES_PERMITIDAS)


def buscar_candidatos(
    termo: str,
    n_candidatos: int = None,
    lingua: str = None,
    pais: str = None,
    max_idade_dias: int = None,
) -> list[dict]:
    n_candidatos = n_candidatos or config.BUSCADOR_N_CANDIDATOS
    lingua = lingua or config.BUSCADOR_LINGUA
    pais = pais or config.BUSCADOR_PAIS
    max_idade_dias = max_idade_dias or config.BUSCADOR_MAX_IDADE_DIAS

    periodo_map = {1: "1d", 2: "2d", 3: "3d", 7: "7d", 14: "14d", 30: "1m"}
    periodo = periodo_map.get(max_idade_dias, f"{max_idade_dias}d")

    gn = GNews(language=lingua, country=pais, max_results=n_candidatos, period=periodo)

    candidatos = []
    seen_urls = set()
    descartados = 0

    logger.info("Buscando candidatos para '%s'...", termo)
    try:
        artigos = gn.get_news(termo)
    except Exception as e:
        logger.error("Erro ao buscar '%s' no Google News: %s", termo, e)
        artigos = []

    for art in artigos:
        fonte = (art.get("publisher") or {}).get("title", "")
        if not _fonte_permitida(fonte):
            descartados += 1
            continue

        url_original = art.get("url", "")
        if not url_original:
            continue

        url = resolver_url(url_original) if "news.google.com" in url_original else url_original
        if url in seen_urls:
            continue
        seen_urls.add(url)

        candidatos.append({
            "url": url,
            "url_original": url_original,
            "titulo": art.get("title", ""),
            "snippet": (art.get("description") or "")[:80],
            "data": str(art.get("published date", "")),
            "fonte": fonte,
            "termo_origem": termo,
        })

    time.sleep(0.3)

    logger.info(
        "Keyword '%s': %d candidatos aceitos, %d descartados (fonte nao permitida)",
        termo, len(candidatos), descartados,
    )
    return candidatos


def _formatar_candidatos(candidatos: list[dict]) -> str:
    linhas = []
    for i, c in enumerate(candidatos, 1):
        linhas.append(
            f"[{i}] {c['titulo']} | {c['fonte']} | {c['data'][:10]}\n"
            f"    {c['snippet']}"
        )
    return "\n".join(linhas)


_SYSTEM_SELECTOR = (
    "Voce e um editor de noticias experiente. Sua tarefa e selecionar, de uma lista "
    "de artigos candidatos, os {top_k} que melhor cobrem o tema fornecido. Priorize: "
    "(1) relevancia direta ao tema, (2) diversidade de angulo entre os escolhidos "
    "(evite duplicatas do mesmo fato), (3) fontes confiaveis, (4) noticias mais recentes. "
    "Responda APENAS no formato pedido, sem explicacoes."
)

_USER_SELECTOR = """TEMA DE INTERESSE:
{tema}

ARTIGOS CANDIDATOS:
{candidatos}

Selecione os {top_k} artigos mais relevantes para o tema acima.
Responda EXATAMENTE neste formato (sem mais nada):
ESCOLHIDOS: {exemplo_numeros}
"""


def _montar_prompt_selecao(tokenizer, termo: str, candidatos: list[dict], top_k: int) -> str:
    candidatos_fmt = _formatar_candidatos(candidatos)
    exemplo_numeros = ", ".join("<numero>" for _ in range(top_k))
    user_msg = _USER_SELECTOR.format(
        tema=termo, candidatos=candidatos_fmt, top_k=top_k, exemplo_numeros=exemplo_numeros
    )
    system_msg = _SYSTEM_SELECTOR.format(top_k=top_k)

    if getattr(tokenizer, "chat_template", None):
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ]
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    return f"### Instrucao:\n{system_msg}\n\n{user_msg}\n\n### Resposta:\n"


def selecionar_urls_llm(termo: str, candidatos: list[dict], top_k: int = None) -> list[dict]:
    top_k = top_k or config.BUSCADOR_TOP_K

    if len(candidatos) <= top_k:
        logger.info("Menos candidatos (%d) que o top_k (%d); retornando todos.", len(candidatos), top_k)
        return candidatos

    tokenizer, gen_pipe = _get_seletor_pipeline()
    prompt = _montar_prompt_selecao(tokenizer, termo, candidatos, top_k)

    saida = gen_pipe(prompt)[0]["generated_text"]
    resposta = saida[len(prompt):].strip()
    logger.debug("Resposta do LLM seletor: %s", resposta)

    numeros = re.findall(r"\d+", resposta.split("ESCOLHIDOS:", 1)[-1])
    if not numeros:
        logger.warning("Nao foi possivel parsear a selecao do LLM; usando os %d primeiros.", top_k)
        return candidatos[:top_k]

    escolhidos = []
    for n in numeros[:top_k]:
        idx = int(n) - 1
        if 0 <= idx < len(candidatos) and candidatos[idx] not in escolhidos:
            escolhidos.append(candidatos[idx])

    if not escolhidos:
        logger.warning("Indices invalidos na selecao do LLM; usando os %d primeiros.", top_k)
        return candidatos[:top_k]

    return escolhidos


def buscar_noticias_para_keyword(termo: str) -> list[dict]:
    """Busca candidatos para a keyword e seleciona os TOP_K mais relevantes via LLM."""
    candidatos = buscar_candidatos(termo)
    if not candidatos:
        return []
    return selecionar_urls_llm(termo, candidatos)
