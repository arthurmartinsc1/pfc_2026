"""
Resolucao de URLs do Google News para a URL real do artigo.

Migrado sem alteracoes de logica dos dois notebooks (search_agent.ipynb e
notice.ipynb tinham este mesmo bloco duplicado byte-a-byte); unificado aqui
para os dois agentes importarem a mesma implementacao.
"""

import base64
import json
import logging
import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Referer": "https://news.google.com/",
}

_SESSION = requests.Session()
_SESSION.headers.update(HEADERS)

try:
    from googlenewsdecoder import gnewsdecoder as _gnewsdecoder
except Exception:
    _gnewsdecoder = None


def _nao_google(u: str) -> bool:
    return bool(u) and "news.google.com" not in u and "google.com" not in u


def _google_news_id(url: str) -> str:
    if "news.google.com" not in url:
        return ""
    path = urlparse(url).path.strip("/")
    partes = path.split("/")
    if "articles" in partes:
        idx = partes.index("articles")
        if idx + 1 < len(partes):
            return partes[idx + 1]
    if "read" in partes:
        idx = partes.index("read")
        if idx + 1 < len(partes):
            return partes[idx + 1]
    return ""


def _decode_offline(url: str) -> str | None:
    artigo_id = _google_news_id(url)
    if not artigo_id:
        return None
    try:
        raw = base64.urlsafe_b64decode(artigo_id + "=" * ((4 - len(artigo_id) % 4) % 4))
    except Exception:
        return None

    prefixo = bytes([0x08, 0x13, 0x22])
    sufixo = bytes([0xD2, 0x01, 0x00])
    if raw.startswith(prefixo):
        raw = raw[len(prefixo):]
    if raw.endswith(sufixo):
        raw = raw[:-len(sufixo)]
    if not raw:
        return None

    tamanho = raw[0]
    inicio = 2 if tamanho >= 0x80 else 1
    trecho = raw[inicio:inicio + tamanho]
    try:
        texto = trecho.decode("utf-8")
    except Exception:
        return None
    return texto if texto.startswith("http") else None


def _decode_pacote(url: str) -> str | None:
    if _gnewsdecoder is None:
        return None
    try:
        resp = _gnewsdecoder(url, interval=0)
        if isinstance(resp, dict) and resp.get("status") and _nao_google(resp.get("decoded_url", "")):
            return resp["decoded_url"]
    except Exception:
        return None
    return None


def _decode_html(url: str, timeout: int = 12) -> str | None:
    artigo_id = _google_news_id(url)
    candidatas = []
    if artigo_id:
        candidatas.append(f"https://news.google.com/articles/{artigo_id}")
        candidatas.append(f"https://news.google.com/rss/articles/{artigo_id}")
    candidatas.append(url.split("?")[0])

    for tentativa in dict.fromkeys(candidatas):
        try:
            r = _SESSION.get(tentativa, allow_redirects=True, timeout=timeout)
            if _nao_google(r.url):
                return r.url
            soup = BeautifulSoup(r.text, "lxml")
            for sel, attr in [
                ("a[data-n-au]", "href"),
                ("a[href^='http']", "href"),
                ("link[rel='canonical']", "href"),
                ("meta[property='og:url']", "content"),
            ]:
                el = soup.select_one(sel)
                if not el:
                    continue
                href = el.get(attr, "")
                if _nao_google(href):
                    return href
        except Exception:
            pass
    return None


def _decode_batchexecute(url: str, timeout: int = 12) -> str | None:
    artigo_id = _google_news_id(url)
    if not artigo_id:
        return None
    payload = (
        '[[["Fbv4je","[\\"garturlreq\\",[[\\"en-US\\",\\"US\\",'
        '[\\"FINANCE_TOP_INDICES\\",\\"WEB_TEST_1_0_0\\"],null,null,1,1,'
        '\\"US:en\\",null,180,null,null,null,null,null,0,null,null,'
        '[1608992183,723341000]],\\"en-US\\",\\"US\\",1,[2,3,4,8],'
        '1,0,\\"655000234\\",0,0,null,0],\\"'
        + artigo_id +
        '\\"]",null,"generic"]]]'
    )
    try:
        r = _SESSION.post(
            "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
            data={"f.req": payload},
            headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8", **HEADERS},
            timeout=timeout,
        )
        r.raise_for_status()
        m = re.search(r'\\[\\"garturlres\\",\\"(.*?)\\"', r.text)
        if not m:
            return None
        decoded = json.loads('"' + m.group(1) + '"')
        return decoded if _nao_google(decoded) else None
    except Exception:
        return None


def resolver_url(url: str, timeout: int = 15) -> str:
    """Resolve URL do Google News para a URL real do artigo, com fallback em cascata."""
    if "news.google.com" not in url:
        return url

    for nome, metodo in [
        ("offline", _decode_offline),
        ("pacote", _decode_pacote),
        ("html", lambda u: _decode_html(u, timeout=timeout)),
        ("batchexecute", lambda u: _decode_batchexecute(u, timeout=timeout)),
    ]:
        resolvida = metodo(url)
        if _nao_google(resolvida or ""):
            logger.debug("URL resolvida via %s: %s", nome, resolvida)
            return resolvida

    logger.warning("Nao foi possivel resolver URL do Google News: %s", url)
    return url
