"""
Loop de polling: prioriza jobs manuais pendentes (inseridos pela interface) e,
em seguida, reagenda buscas por keyword ativa conforme keywords.intervalo_minutos -
cada assunto e revisitado automaticamente quando passa o intervalo desde o ultimo
job, buscando noticias novas ao longo do tempo (dedup por URL evita repetir).
"""

import logging
import time

import config
import repository
from db import get_session
from models import Keyword, SearchJob
from orchestrator import processar_job

logger = logging.getLogger(__name__)


def _keyword_esta_devida(session, keyword: Keyword) -> bool:
    # Devida se nao houve nenhum job dela nos ultimos intervalo_minutos (cobre
    # keyword nova E reagendamento periodico). intervalo_minutos e lido do banco
    # a cada ciclo, entao mudancas feitas pela interface valem sem reiniciar.
    return repository.keyword_devida_por_intervalo(
        session, keyword.id, keyword.intervalo_minutos
    )


def _recuperar_jobs_travados() -> None:
    """Marca como 'erro' jobs presos em 'rodando' ha mais tempo que o timeout -
    evita que um crash no meio do processamento deixe o job preso pra sempre,
    o que faria o indicador de saude do sistema na interface parecer quebrado."""
    with get_session() as session:
        travados = repository.get_jobs_travados(session, config.JOB_TIMEOUT_MINUTOS)
        for job in travados:
            logger.warning(
                "Job %s travado em 'rodando' desde %s - marcando como erro (timeout de %d min)",
                job.id, job.started_at, config.JOB_TIMEOUT_MINUTOS,
            )
            repository.marcar_job_erro(
                session, job,
                f"Job expirou apos {config.JOB_TIMEOUT_MINUTOS} min em 'rodando' - "
                "processo provavelmente foi interrompido (crash, kill, etc).",
            )
        session.commit()


def _processar_jobs_manuais_pendentes() -> None:
    with get_session() as session:
        jobs = repository.get_jobs_manuais_pendentes(session)
        job_keyword_pairs = [(job.id, job.keyword_id) for job in jobs]

    for job_id, keyword_id in job_keyword_pairs:
        with get_session() as session:
            job = session.get(SearchJob, job_id)
            keyword = session.get(Keyword, keyword_id)
            if job is None or keyword is None:
                logger.warning("Job manual %s ou keyword %s nao encontrado, pulando.", job_id, keyword_id)
                continue
            processar_job(session, job, keyword)


def _processar_keywords_agendadas() -> None:
    with get_session() as session:
        keywords_ativas = repository.get_keywords_ativas(session)
        devidas = [kw.id for kw in keywords_ativas if _keyword_esta_devida(session, kw)]

    for keyword_id in devidas:
        with get_session() as session:
            keyword = session.get(Keyword, keyword_id)
            if keyword is None or not keyword.ativo:
                continue
            job = repository.criar_job_agendado(session, keyword.id)
            session.commit()
            job_id = job.id

        with get_session() as session:
            job = session.get(SearchJob, job_id)
            keyword = session.get(Keyword, keyword_id)
            processar_job(session, job, keyword)


def executar_ciclo() -> None:
    logger.info("Iniciando ciclo de polling...")
    _recuperar_jobs_travados()
    _processar_jobs_manuais_pendentes()
    _processar_keywords_agendadas()
    logger.info("Ciclo de polling concluido.")


def run_forever() -> None:
    logger.info("Polling iniciado (intervalo=%ds)", config.POLL_INTERVAL_SECONDS)
    while True:
        try:
            executar_ciclo()
        except Exception:
            logger.exception("Erro inesperado no ciclo de polling")
        time.sleep(config.POLL_INTERVAL_SECONDS)
