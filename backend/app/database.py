import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from fastapi import HTTPException 

load_dotenv()

# --- Aggressive DATABASE_URL Handling ---
DATABASE_URL_RAW = os.getenv("DATABASE_URL")
DATABASE_URL = None

if DATABASE_URL_RAW:
    # 1. Standardize scheme to 'postgresql://' as required by SQLAlchemy
    DATABASE_URL = DATABASE_URL_RAW.replace("postgres://", "postgresql://", 1)
else:
    # Local Fallback for development - use SQLite
    DATABASE_URL = "sqlite:///./reads_mvp.db"
    print("INFO: Using SQLite database for development.")


# --- Connection Arguments (only for PostgreSQL) ---
connect_args = {}
if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    # CRITICAL: This enables secure connection required by Supabase/hosted PostgreSQL
    connect_args = {
        "sslmode": "require"
    }


# Pass the connect_args to the engine initialization
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_recycle=3600 # Helps manage dropped connections
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        # PING the DB connection right here to test it early
        db.connection() 
        yield db
    except Exception as e:
        # Log the error to the Vercel Function logs
        print(f"FATAL: Database connection error during runtime: {e}")
        # Raise an explicit 500 so we can track the message if we get lucky
        raise HTTPException(
            status_code=500,
            detail=f"Internal Server Error: Database connection failed. See Vercel logs for full error."
        )
    finally:
        db.close()
