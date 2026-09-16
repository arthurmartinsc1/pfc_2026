"""
Camada de acesso a dados. Regras de permissao aplicadas aqui:
- keywords: apenas leitura (WHERE ativo = true).
- search_jobs, news_items, news_keyword_matches: leitura e escrita.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from models import JobOrigem, JobStatus, Keyword, NewsItem, NewsKeywordMatch, SearchJob


def get_keywords_ativas(session: Session) -> list[Keyword]:
    stmt = select(Keyword).where(Keyword.ativo.is_(True))
    return list(session.scalars(stmt))


def get_jobs_manuais_pendentes(session: Session) -> list[SearchJob]:
    stmt = (
        select(SearchJob)
        .where(SearchJob.status == JobStatus.PENDENTE, SearchJob.origem == JobOrigem.MANUAL)
        .order_by(SearchJob.created_at.asc())
    )
    return list(session.scalars(stmt))


def get_jobs_travados(session: Session, timeout_minutos: int) -> list[SearchJob]:
    """Jobs presos em 'rodando' ha mais tempo que o timeout - provavelmente o
    processo que os pegou morreu (crash, kill, queda de energia) antes de
    conseguir marcar status='erro' no bloco except."""
    limite = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutos)
    stmt = select(SearchJob).where(
        SearchJob.status == JobStatus.RODANDO,
        SearchJob.started_at < limite,
    )
    return list(session.scalars(stmt))


def keyword_devida_por_intervalo(
    session: Session, keyword_id: uuid.UUID, intervalo_minutos: int
) -> bool:
    """True se a keyword deve ser buscada agora: quando NAO existe nenhum job dela
    criado nos ultimos `intervalo_minutos`. Cobre os dois casos de uma vez:
      - keyword nova (nenhum job)  -> devida
      - ja passou o intervalo desde o ultimo job -> devida

    A comparacao de tempo e feita no proprio Postgres (created_at vs now()),
    ambos no mesmo relogio/fuso do banco - evita bug de timezone que surgiria ao
    comparar timestamps naive do banco com datetime.now() do Python.
    Qualquer origem conta (um job manual recente tambem 'reseta' o intervalo,
    evitando busca redundante logo apos uma busca manual)."""
    stmt = text(
        """
        SELECT NOT EXISTS (
            SELECT 1 FROM search_jobs
            WHERE keyword_id = :kid
              AND created_at > (now() - make_interval(mins => :mins))::timestamp
        )
        """
    )
    return bool(session.execute(stmt, {"kid": keyword_id, "mins": intervalo_minutos}).scalar())


def get_ultimo_job_agendado(session: Session, keyword_id: uuid.UUID) -> SearchJob | None:
    stmt = (
        select(SearchJob)
        .where(SearchJob.keyword_id == keyword_id, SearchJob.origem == JobOrigem.AGENDADO)
        .order_by(SearchJob.created_at.desc())
        .limit(1)
    )
    return session.scalars(stmt).first()


def criar_job_agendado(session: Session, keyword_id: uuid.UUID) -> SearchJob:
    job = SearchJob(keyword_id=keyword_id, status=JobStatus.PENDENTE, origem=JobOrigem.AGENDADO)
    session.add(job)
    session.flush()
    return job


def marcar_job_rodando(session: Session, job: SearchJob) -> None:
    job.status = JobStatus.RODANDO
    job.started_at = datetime.now(timezone.utc)
    session.flush()


def marcar_job_concluido(session: Session, job: SearchJob) -> None:
    job.status = JobStatus.CONCLUIDO
    job.finished_at = datetime.now(timezone.utc)
    session.flush()


def marcar_job_erro(session: Session, job: SearchJob, mensagem: str) -> None:
    job.status = JobStatus.ERRO
    job.erro_msg = mensagem[:2000]
    job.finished_at = datetime.now(timezone.utc)
    session.flush()


def upsert_news_item(
    session: Session,
    *,
    titulo: str,
    url: str,
    fonte: str | None,
    resumo: str,
    relevancia: float | None = None,
    data_publicacao_original: datetime | None = None,
) -> tuple[uuid.UUID, bool]:
    """
    Insere a noticia se a URL ainda nao existir (ON CONFLICT DO NOTHING) e retorna
    (news_item_id, criada). criada=False quando a noticia ja existia e so o vinculo
    com a keyword/job atual deve ser criado.
    """
    stmt = (
        pg_insert(NewsItem)
        .values(
            titulo=titulo,
            url=url,
            fonte=fonte,
            resumo=resumo,
            relevancia=relevancia,
            data_publicacao_original=data_publicacao_original,
        )
        .on_conflict_do_nothing(index_elements=[NewsItem.url])
        .returning(NewsItem.id)
    )
    news_item_id = session.execute(stmt).scalar_one_or_none()
    if news_item_id is not None:
        return news_item_id, True

    news_item_id = session.scalars(select(NewsItem.id).where(NewsItem.url == url)).one()
    return news_item_id, False


def vincular_news_keyword(
    session: Session, *, news_item_id: uuid.UUID, keyword_id: uuid.UUID, job_id: uuid.UUID
) -> None:
    ja_existe = session.scalars(
        select(NewsKeywordMatch.id).where(
            NewsKeywordMatch.news_item_id == news_item_id,
            NewsKeywordMatch.keyword_id == keyword_id,
            NewsKeywordMatch.job_id == job_id,
        )
    ).first()
    if ja_existe:
        return
    session.add(
        NewsKeywordMatch(news_item_id=news_item_id, keyword_id=keyword_id, job_id=job_id)
    )
    session.flush()
