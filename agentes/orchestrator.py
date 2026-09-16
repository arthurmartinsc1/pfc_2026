"""
Orquestracao do pipeline: buscador -> resumidor -> persistencia no Postgres,
seguindo o ciclo de vida de search_jobs e a deduplicacao por URL.
"""

import logging
from email.utils import parsedate_to_datetime

from sqlalchemy.orm import Session

import repository
from buscador import buscar_noticias_para_keyword
from models import Keyword, SearchJob
from resumidor import resumir_url

logger = logging.getLogger(__name__)


def _parse_data_publicacao(data_str: str):
    if not data_str:
        return None
    try:
        return parsedate_to_datetime(data_str)
    except (TypeError, ValueError):
        return None


def processar_job(session: Session, job: SearchJob, keyword: Keyword) -> None:
    logger.info(
        "Processando job %s (keyword '%s', origem=%s)", job.id, keyword.termo, job.origem
    )
    repository.marcar_job_rodando(session, job)
    session.commit()

    try:
        candidatos = buscar_noticias_para_keyword(keyword.termo)
        if not candidatos:
            raise RuntimeError(f"Nenhuma noticia encontrada para a keyword '{keyword.termo}'")

        logger.info(
            "Job %s: %d candidato(s) selecionado(s) para resumir", job.id, len(candidatos)
        )

        novas, duplicadas, falhas = 0, 0, 0
        for i, candidato in enumerate(candidatos, 1):
            logger.info(
                "Job %s: iniciando resumo do candidato %d/%d: %s",
                job.id, i, len(candidatos), candidato["url"],
            )
            try:
                resultado = resumir_url(candidato["url"])
            except Exception as e:
                falhas += 1
                logger.warning(
                    "Falha ao resumir '%s' (job %s): %s", candidato["url"], job.id, e
                )
                continue

            news_item_id, criada = repository.upsert_news_item(
                session,
                titulo=resultado["titulo"] or candidato["titulo"],
                url=resultado["url"],
                fonte=candidato.get("fonte"),
                resumo=resultado["resumo"],
                data_publicacao_original=_parse_data_publicacao(candidato.get("data")),
            )
            repository.vincular_news_keyword(
                session, news_item_id=news_item_id, keyword_id=keyword.id, job_id=job.id
            )
            novas += 1 if criada else 0
            duplicadas += 0 if criada else 1
            session.commit()

        logger.info(
            "Job %s: %d nova(s), %d duplicada(s), %d falha(s) de resumo",
            job.id, novas, duplicadas, falhas,
        )

        if novas == 0 and duplicadas == 0:
            raise RuntimeError(
                f"Todos os {len(candidatos)} candidato(s) falharam ao extrair/resumir"
            )

        repository.marcar_job_concluido(session, job)
        session.commit()

    except Exception as e:
        session.rollback()
        logger.exception("Job %s terminou com erro", job.id)
        repository.marcar_job_erro(session, job, str(e))
        session.commit()
