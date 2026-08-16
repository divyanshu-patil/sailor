from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config.settings import settings

# Opening a connection to the Supabase pooler measures ~5.5s from here; a warm
# round trip is ~0.4s. That gap is why these options exist — every one of them
# is about not paying the 5.5s again.
#
#   pool_pre_ping  a connection the pooler dropped while idle surfaces as a
#                  dead-connection error on the *next* query, which SQLAlchemy
#                  then has to unwind and retry. The pre-ping checks first and
#                  swaps in a live connection instead.
#   pool_recycle   below the pooler's own idle timeout, so a connection is
#                  replaced on our schedule rather than discovered dead on the
#                  user's.
#   keepalives     TCP-level, for the Celery worker in particular: it can sit
#                  idle for minutes between jobs, which is exactly long enough
#                  for a NAT or the pooler to drop a silent connection.
engine = create_engine(
    url=settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
    },
)

# expire_on_commit=False, because every commit here is followed by *using* the
# object that was just written — serialising it into a response, or reading its
# id to queue a job. The default expires every attribute on commit, so the next
# attribute access silently issues a fresh SELECT: measured at 0.4-0.7s each
# against the pooler, and three of the six statements in POST /scripts were
# exactly that. Sessions are request- or task-scoped and short-lived, so there
# is no long-lived object here to go stale, and the handful of places that
# genuinely want the database's version still call db.refresh() explicitly.
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
