import os

from dotenv import load_dotenv

load_dotenv()


def _env_int(nome: str, default: int) -> int:
    return int(os.environ.get(nome, default))


DATABASE_URL = os.environ["DATABASE_URL"]

HF_TOKEN = os.environ.get("HF_TOKEN")
os.environ.setdefault("HF_HOME", os.environ.get("HF_HOME", "./hf_cache"))
HF_HOME = os.environ["HF_HOME"]

POLL_INTERVAL_SECONDS = _env_int("POLL_INTERVAL_SECONDS", 60)
JOB_TIMEOUT_MINUTOS = _env_int("JOB_TIMEOUT_MINUTOS", 30)

BUSCADOR_MODEL = os.environ.get("BUSCADOR_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
BUSCADOR_N_CANDIDATOS = _env_int("BUSCADOR_N_CANDIDATOS", 10)
BUSCADOR_TOP_K = _env_int("BUSCADOR_TOP_K", 2)
BUSCADOR_LINGUA = os.environ.get("BUSCADOR_LINGUA", "pt")
BUSCADOR_PAIS = os.environ.get("BUSCADOR_PAIS", "BR")
BUSCADOR_MAX_IDADE_DIAS = _env_int("BUSCADOR_MAX_IDADE_DIAS", 7)

RESUMIDOR_MODEL = os.environ.get("RESUMIDOR_MODEL", "Qwen/Qwen2.5-3B-Instruct")

FONTES_PERMITIDAS = [
    "agência brasil",
    "cnn brasil",
    "g1",
    "bbc",
    "nexo",
    "uol",
    "poder360",
    "metrópoles",
    "terra",
    "brasil de fato",
    "olhar digital",
    "canaltech",
    "tecmundo",
    "istoé",
    "isto é",
    "carta capital",
    "congresso em foco",
    "agência lupa",
    "aos fatos",
    "reuters",
    "associated press",
    "dw brasil",
    "deutsche welle",
    "france24",
    "euronews",
]
# Fontes com paywall conhecido (Folha, Estadao, Valor, O Globo, Veja, Epoca,
# Gazeta do Povo) foram deixadas de fora de proposito: o resumidor nao consegue
# extrair o texto completo por tras de login/assinatura.
