import os

from dotenv import load_dotenv

load_dotenv()


def _env_int(nome: str, default: int) -> int:
    return int(os.environ.get(nome, default))


DATABASE_URL = os.environ["DATABASE_URL"]

# LLMs servidos remotamente via vLLM (API compativel com OpenAI) numa VM com
# GPU, acessada pela VPN. api_key e so um shared secret combinado com o
# servidor (vLLM foi subido com --api-key EMPTY nesse caso).
LLM_API_KEY = os.environ.get("LLM_API_KEY", "EMPTY")
LLM_TIMEOUT_SECONDS = _env_int("LLM_TIMEOUT_SECONDS", 240)

POLL_INTERVAL_SECONDS = _env_int("POLL_INTERVAL_SECONDS", 60)
JOB_TIMEOUT_MINUTOS = _env_int("JOB_TIMEOUT_MINUTOS", 30)

BUSCADOR_LLM_BASE_URL = os.environ["BUSCADOR_LLM_BASE_URL"]
BUSCADOR_LLM_MODEL = os.environ.get("BUSCADOR_LLM_MODEL", "qwen")
BUSCADOR_N_CANDIDATOS = _env_int("BUSCADOR_N_CANDIDATOS", 10)
BUSCADOR_TOP_K = _env_int("BUSCADOR_TOP_K", 2)
BUSCADOR_LINGUA = os.environ.get("BUSCADOR_LINGUA", "pt")
BUSCADOR_PAIS = os.environ.get("BUSCADOR_PAIS", "BR")
BUSCADOR_MAX_IDADE_DIAS = _env_int("BUSCADOR_MAX_IDADE_DIAS", 7)

RESUMIDOR_LLM_BASE_URL = os.environ["RESUMIDOR_LLM_BASE_URL"]
RESUMIDOR_LLM_MODEL = os.environ.get("RESUMIDOR_LLM_MODEL", "gemma")

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
    # Generalistas gratuitas adicionadas para ampliar cobertura
    "r7",
    "band",
    "jovem pan",
    "correio braziliense",
    "correio do povo",
    "diário do nordeste",
    "gazeta do sul",
    "a tarde",
    "o povo",
    "infomoney",
    "al jazeera",
    "the guardian",
    "nsc total",
    # Defesa/ciberseguranca (nicho, gratuitas) - cobrem assuntos institucionais
    # que os veiculos generalistas raramente pautam
    "tecnodefesa",
    "defesa aérea",
    "poder aéreo",
    "defesa em foco",
    "forças terrestres",
    "convergência digital",
    "convergenciadigital",
    "ciso advisor",
    "the hack",
    "tecnoblog",
    "defesanet",
    # Fontes oficiais do governo (sempre gratuitas)
    "eb.mil.br",
    "marinha do brasil",
    "marinha.mil.br",
    "força aérea",
    "fab.mil.br",
    "gov.br",
]
# Fontes com paywall conhecido (Folha, Estadao, Valor, O Globo, Veja, Epoca,
# Gazeta do Povo, Exame, Crusoe/O Antagonista) foram deixadas de fora de
# proposito: o resumidor nao consegue extrair o texto completo por tras de
# login/assinatura.
