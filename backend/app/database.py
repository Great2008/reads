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
    # Local Fallback for debugging (only runs if DB is not set in env)
    DATABASE_URL = "postgresql://postgres:password@localhost/reads_mvp"
    print("WARNING: Using local default database URL.")


# --- Vercel/Cloud Connection Arguments: ADD SSL MODE BACK ---
# CRITICAL: This enables secure connection required by Supabase/hosted PostgreSQL
connect_args = {
    "sslmode": "require"
}


# Pass the connect_args to the engine initialization
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,  # <--- Now passes {"sslmode": "require"}
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
    except HTTPException as http_e:
        # 💥 CRITICAL FIX: Explicitly catch and re-raise all FastAPI's HTTPExceptions (like 409).
        # This prevents the correct error from being mistakenly converted to a 500.
        raise http_e
    except Exception as e:
        # Only catch and log unexpected, low-level database connection errors.
        # Log the error to the Vercel Function logs
        print(f"FATAL: Database connection error during runtime: {e}")
        # Raise an explicit 500 for true database failures
        raise HTTPException(
            status_code=500,
            detail=f"Internal Server Error: Database connection failed. See Vercel logs for full error."
        )
    finally:
        db.close()
