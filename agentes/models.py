"""
Modelos SQLAlchemy mapeando tabelas ja existentes no Postgres (schema e migrations
sao responsabilidade da interface Next.js/Prisma). Este modulo nunca roda
create_all() - so mapeia colunas para leitura/escrita.

Detalhes do schema real (conferidos via information_schema no banco da interface):
- PKs/FKs sao uuid (gerados no banco via gen_random_uuid()), nao inteiro.
- Timestamps sao "timestamp without time zone" (naive) - nao timestamptz.
- status/origem sao enums nativos do Postgres ("JobStatus"/"JobOrigin"), mapeados
  aqui como String porque psycopg2 converte string Python <-> enum automaticamente.
- news_items tem uma coluna `descartada` (boolean, default false) que e curadoria
  exclusiva da interface - nao mapeada aqui de proposito, nunca escrevemos nela
  (o INSERT sem essa coluna usa o default do banco).
"""

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, Float, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.schema import FetchedValue


class Base(DeclarativeBase):
    pass


class JobStatus:
    PENDENTE = "pendente"
    RODANDO = "rodando"
    CONCLUIDO = "concluido"
    ERRO = "erro"


class JobOrigem:
    AGENDADO = "agendado"
    MANUAL = "manual"


class Keyword(Base):
    """Somente leitura: quem cria/ativa/desativa e a interface."""

    __tablename__ = "keywords"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=FetchedValue())
    termo: Mapped[str] = mapped_column(Text)
    ativo: Mapped[bool]
    intervalo_minutos: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )
    termos_relacionados: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)


class SearchJob(Base):
    __tablename__ = "search_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=FetchedValue())
    keyword_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("keywords.id"))
    status: Mapped[str] = mapped_column(Text, default=JobStatus.PENDENTE)
    origem: Mapped[str] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    erro_msg: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=FetchedValue())
    titulo: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, unique=True)
    fonte: Mapped[str | None] = mapped_column(Text)
    resumo: Mapped[str] = mapped_column(Text)
    relevancia: Mapped[float | None] = mapped_column(Float)
    data_publicacao_original: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )


class NewsKeywordMatch(Base):
    __tablename__ = "news_keyword_matches"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=FetchedValue())
    news_item_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("news_items.id"))
    keyword_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("keywords.id"))
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("search_jobs.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )
