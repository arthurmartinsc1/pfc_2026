from contextlib import contextmanager
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import config


def _preparar_url_e_args(database_url: str) -> tuple[str, dict]:
    """
    psycopg2 nao entende o parametro `?schema=` (e sintaxe do Prisma, nao do
    libpq). Remove esse parametro da URL e, se o schema nao for o "public"
    (default do Postgres), aplica via `options=-csearch_path=...` no connect.
    """
    partes = urlsplit(database_url)
    query = parse_qs(partes.query)
    schema = query.pop("schema", ["public"])[0]

    nova_query = urlencode(query, doseq=True)
    url_limpa = urlunsplit((partes.scheme, partes.netloc, partes.path, nova_query, partes.fragment))

    connect_args = {}
    if schema and schema != "public":
        connect_args["options"] = f"-csearch_path={schema}"

    return url_limpa, connect_args


_database_url, _connect_args = _preparar_url_e_args(config.DATABASE_URL)

engine = create_engine(
    _database_url, pool_pre_ping=True, future=True, connect_args=_connect_args
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


@contextmanager
def get_session() -> Session:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
