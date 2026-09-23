"""
Cliente para os LLMs servidos remotamente via vLLM (API compativel com OpenAI)
numa VM com GPU, acessada pela VPN. Nenhum peso de modelo e carregado neste
processo — cada geracao e uma chamada HTTP.
"""

import logging

from openai import OpenAI

import config

logger = logging.getLogger(__name__)

_clients: dict[str, OpenAI] = {}


def _get_client(base_url: str) -> OpenAI:
    if base_url not in _clients:
        # Timeout explicito: sem isso, uma chamada presa no servidor remoto
        # (rede caiu, vLLM travado) prende o poller para sempre, ao inves de
        # falhar o job/candidato e seguir para o proximo (comportamento ja
        # tratado pelo orchestrator.py).
        _clients[base_url] = OpenAI(
            base_url=base_url, api_key=config.LLM_API_KEY, timeout=config.LLM_TIMEOUT_SECONDS
        )
    return _clients[base_url]


def gerar(
    base_url: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int,
    min_tokens: int | None = None,
) -> str:
    """Chama /v1/chat/completions no servidor vLLM indicado e retorna o texto gerado."""
    client = _get_client(base_url)
    # enable_thinking=False desliga o modo raciocinio do Qwen3 (senao ele gasta
    # todo o max_tokens "pensando" e nunca emite o "content" final - o campo
    # e ignorado sem erro por modelos que nao suportam, como o gemma).
    extra_body = {"chat_template_kwargs": {"enable_thinking": False}}
    if min_tokens:
        extra_body["min_tokens"] = min_tokens

    resposta = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.0,
        extra_body=extra_body,
    )
    return resposta.choices[0].message.content or ""
