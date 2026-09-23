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
import unicodedata

from gnews import GNews

import config
from google_news import resolver_url
from llm_client import gerar

logger = logging.getLogger(__name__)


def _normalizar(texto: str) -> str:
    """minusculas e sem acento, pra comparar 'colombia' com 'Colômbia'."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return sem_acento.lower()


def _fonte_permitida(fonte: str) -> bool:
    f = _normalizar(fonte)
    return any(_normalizar(permitida) in f for permitida in config.FONTES_PERMITIDAS)


def _calcular_relevancia(titulo: str, snippet: str, termos_relacionados: list[str]) -> float | None:
    """Fracao dos termos relacionados presentes no titulo/snippet (0-1). None se
    a keyword nao tiver termos relacionados cadastrados (comportamento atual)."""
    if not termos_relacionados:
        return None
    texto = _normalizar(f"{titulo} {snippet}")
    matches = sum(1 for t in termos_relacionados if _normalizar(t) in texto)
    return round(matches / len(termos_relacionados), 2)


def buscar_candidatos(
    termo: str,
    termos_relacionados: list[str] | None = None,
    n_candidatos: int = None,
    lingua: str = None,
    pais: str = None,
    max_idade_dias: int = None,
) -> list[dict]:
    n_candidatos = n_candidatos or config.BUSCADOR_N_CANDIDATOS
    lingua = lingua or config.BUSCADOR_LINGUA
    pais = pais or config.BUSCADOR_PAIS
    max_idade_dias = max_idade_dias or config.BUSCADOR_MAX_IDADE_DIAS
    termos_relacionados = termos_relacionados or []

    periodo_map = {1: "1d", 2: "2d", 3: "3d", 7: "7d", 14: "14d", 30: "1m"}
    periodo = periodo_map.get(max_idade_dias, f"{max_idade_dias}d")

    gn = GNews(language=lingua, country=pais, max_results=n_candidatos, period=periodo)

    # Busca pelo nome do assunto e, se houver, tambem combinado com cada termo
    # relacionado - amplia a cobertura sem exigir que o termo principal sozinho
    # traga resultado (ex: "fronteira" + "colombia").
    queries = [termo] + [f"{termo} {t}" for t in termos_relacionados]

    candidatos = []
    seen_urls = set()
    descartados = 0

    logger.info("Buscando candidatos para '%s' (%d consulta(s))...", termo, len(queries))
    for i, query in enumerate(queries):
        try:
            artigos = gn.get_news(query)
        except Exception as e:
            logger.error("Erro ao buscar '%s' no Google News: %s", query, e)
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

            titulo = art.get("title", "")
            snippet = (art.get("description") or "")[:80]
            candidatos.append({
                "url": url,
                "url_original": url_original,
                "titulo": titulo,
                "snippet": snippet,
                "data": str(art.get("published date", "")),
                "fonte": fonte,
                "termo_origem": termo,
                "relevancia": _calcular_relevancia(titulo, snippet, termos_relacionados),
            })

        if i < len(queries) - 1:
            time.sleep(0.3)

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
{termos_relacionados_linha}
ARTIGOS CANDIDATOS:
{candidatos}

Selecione os {top_k} artigos mais relevantes para o tema acima.
Responda EXATAMENTE neste formato (sem mais nada):
ESCOLHIDOS: {exemplo_numeros}
"""


def _montar_mensagens_selecao(
    termo: str, candidatos: list[dict], top_k: int, termos_relacionados: list[str] | None = None
) -> tuple[str, str]:
    candidatos_fmt = _formatar_candidatos(candidatos)
    exemplo_numeros = ", ".join("<numero>" for _ in range(top_k))
    termos_relacionados_linha = (
        f"TERMOS RELACIONADOS (indicam maior relevancia): {', '.join(termos_relacionados)}\n"
        if termos_relacionados else ""
    )
    user_msg = _USER_SELECTOR.format(
        tema=termo,
        termos_relacionados_linha=termos_relacionados_linha,
        candidatos=candidatos_fmt,
        top_k=top_k,
        exemplo_numeros=exemplo_numeros,
    )
    system_msg = _SYSTEM_SELECTOR.format(top_k=top_k)
    return system_msg, user_msg


def selecionar_urls_llm(
    termo: str, candidatos: list[dict], top_k: int = None, termos_relacionados: list[str] | None = None
) -> list[dict]:
    top_k = top_k or config.BUSCADOR_TOP_K

    if len(candidatos) <= top_k:
        logger.info("Menos candidatos (%d) que o top_k (%d); retornando todos.", len(candidatos), top_k)
        return candidatos

    system_msg, user_msg = _montar_mensagens_selecao(termo, candidatos, top_k, termos_relacionados)
    resposta = gerar(
        base_url=config.BUSCADOR_LLM_BASE_URL,
        model=config.BUSCADOR_LLM_MODEL,
        system=system_msg,
        user=user_msg,
        max_tokens=150,
    ).strip()
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


def buscar_noticias_para_keyword(termo: str, termos_relacionados: list[str] | None = None) -> list[dict]:
    """Busca candidatos para a keyword (+ termos relacionados, se houver) e
    seleciona os TOP_K mais relevantes via LLM."""
    candidatos = buscar_candidatos(termo, termos_relacionados)
    if not candidatos:
        return []
    return selecionar_urls_llm(termo, candidatos, termos_relacionados=termos_relacionados)
