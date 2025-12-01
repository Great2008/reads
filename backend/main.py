from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime
import uuid
import os

# --- CRITICAL FIX: Use relative imports for Vercel runtime environment ---
from .app import models, schemas, auth, database

# Initialize DB - WRAP THIS IN A TRY/EXCEPT BLOCK
print("Attempting to create database tables...")
try:
    models.Base.metadata.create_all(bind=database.engine)
    print("Database tables initialized successfully (or already exist).")
except Exception as e:
    print(f"WARNING: Initial database table creation failed. Error: {e}")


# --- Ensure the root_path is set for Vercel routing ---
app = FastAPI(title="$READS Backend", root_path="/api")
print("FastAPI app initialized with root_path=/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dependencies ---

def get_current_admin(current_user: models.User = Depends(auth.get_current_user)):
    """Checks if the authenticated user has admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


# ----------------------------------------------------
# --- 3.1 AUTHENTICATION & PROFILES ---
# ----------------------------------------------------

@app.post("/auth/signup", response_model=schemas.Token)
def signup(user_in: schemas.UserCreate, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = auth.get_password_hash(user_in.password)
    
    # 💥 CRITICAL: Auto-promote the very first user to Super User/Admin
    is_first_user = db.query(models.User).count() == 0
    
    new_user = models.User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pw,
        is_admin=is_first_user # Sets the first user as admin
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    new_wallet = models.Wallet(user_id=new_user.id, token_balance=0)
    db.add(new_wallet)
    db.commit()

    access_token = auth.create_access_token(data={"sub": str(new_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    if not user or not auth.verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Invalid credentials")
    
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/user/profile", response_model=schemas.UserProfile)
def get_profile(current_user: models.User = Depends(auth.get_current_user)):
    """Returns the full user profile, including is_admin status."""
    return current_user

@app.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(db: Session = Depends(database.get_db)):
    results = db.query(models.User.name, models.Wallet.token_balance)\
        .join(models.Wallet, models.User.id == models.Wallet.user_id)\
        .order_by(desc(models.Wallet.token_balance))\
        .limit(10).all()
    
    return [{"name": r[0], "token_balance": r[1]} for r in results]


# ----------------------------------------------------
# --- 3.2 ADMIN ENDPOINTS (NEW) ---
# ----------------------------------------------------

@app.post("/admin/lessons", response_model=schemas.LessonDetail)
def create_lesson(lesson_in: schemas.LessonCreate, db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to create a new lesson."""
    new_lesson = models.Lesson(**lesson_in.dict())
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson

@app.post("/admin/quiz", status_code=201)
def add_quiz_questions(quiz_in: schemas.QuizCreateRequest, db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to add quiz questions to a lesson."""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == quiz_in.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    quiz_objects = [
        models.QuizQuestion(lesson_id=quiz_in.lesson_id, **q.dict())
        for q in quiz_in.questions
    ]
    
    db.add_all(quiz_objects)
    db.commit()
    return {"message": f"Successfully added {len(quiz_objects)} questions to lesson {lesson.title}"}

@app.get("/admin/users", response_model=List[schemas.UserProfile])
def list_users(db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to list all users for management."""
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@app.put("/admin/users/{user_id}/promote", status_code=status.HTTP_200_OK)
def promote_user(user_id: uuid.UUID, is_admin: bool, db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    """Admin endpoint to promote/demote a user."""
    user_to_update = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    # Protection against self-demotion
    if user_to_update.id == admin.id and is_admin == False:
        raise HTTPException(status_code=400, detail="Cannot demote yourself. Transfer ownership first.")
        
    user_to_update.is_admin = is_admin
    db.commit()
    return {"message": f"User {user_to_update.name} role updated to {'Admin' if is_admin else 'User'}."}


# ----------------------------------------------------
# --- 3.3 LEARNING ENDPOINTS (Unchanged Logic) ---
# ----------------------------------------------------

@app.get("/lessons/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(database.get_db)):
    """List all unique lesson categories and their count."""
    results = db.query(models.Lesson.category, func.count(models.Lesson.id))\
        .group_by(models.Lesson.category)\
        .order_by(models.Lesson.category)\
        .all()
    return [{"category": category, "count": count} for category, count in results]

@app.get("/lessons/category/{category_name}", response_model=List[schemas.LessonBase])
def get_lessons_by_category(category_name: str, db: Session = Depends(database.get_db)):
    """List lessons in a specific category."""
    return db.query(models.Lesson).filter(models.Lesson.category == category_name).order_by(models.Lesson.order_index).all()

@app.get("/lessons/{lesson_id}", response_model=schemas.LessonDetail)
def get_lesson_detail(lesson_id: uuid.UUID, db: Session = Depends(database.get_db)):
    """Get content for a specific lesson."""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson

@app.get("/lessons/{lesson_id}/quiz", response_model=List[schemas.QuizQuestionResponse])
def get_quiz_questions(lesson_id: uuid.UUID, db: Session = Depends(database.get_db)):
    """Get quiz questions for a lesson."""
    questions = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).all()
    if not questions:
        raise HTTPException(status_code=404, detail="Quiz not found for this lesson")
    return questions

@app.post("/lessons/{lesson_id}/complete", status_code=status.HTTP_201_CREATED)
def complete_lesson(lesson_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Marks a lesson as completed."""
    existing_progress = db.query(models.LessonProgress).filter(
        models.LessonProgress.user_id == current_user.id,
        models.LessonProgress.lesson_id == lesson_id
    ).first()

    if not existing_progress:
        new_progress = models.LessonProgress(user_id=current_user.id, lesson_id=lesson_id)
        db.add(new_progress)
        db.commit()
    
    return {"message": "Lesson marked as complete."}


@app.post("/quiz/submit", response_model=schemas.QuizResultResponse)
def submit_quiz(submission: schemas.QuizSubmitRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Submits quiz answers, calculates score, and awards tokens."""
    questions = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == submission.lesson_id).all()
    
    if not questions:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    correct_count = 0
    question_map = {str(q.id): q.correct_option for q in questions}

    for answer in submission.answers:
        if str(answer.question_id) in question_map and answer.selected == question_map[str(answer.question_id)]:
            correct_count += 1
            
    wrong_count = len(questions) - correct_count
    score = int((correct_count / len(questions)) * 100)

    # Award tokens: 5 tokens per correct answer
    tokens_awarded = correct_count * 5

    result = models.QuizResult(
        user_id=current_user.id,
        lesson_id=submission.lesson_id,
        score=score,
        correct_count=correct_count,
        wrong_count=wrong_count
    )
    db.add(result)

    if tokens_awarded > 0:
        reward = models.Reward(
            user_id=current_user.id,
            lesson_id=submission.lesson_id,
            tokens_earned=tokens_awarded
        )
        db.add(reward)
        current_user.wallet.token_balance += tokens_awarded
    
    db.commit()

    return {
        "score": score,
        "correct": correct_count,
        "wrong": wrong_count,
        "tokens_awarded": tokens_awarded
    }

# --- 3.4 Rewards ---

@app.get("/rewards/history", response_model=List[schemas.RewardHistory])
def reward_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Reward).filter(models.Reward.user_id == current_user.id).all()

@app.get("/rewards/summary", response_model=schemas.RewardSummary)
def reward_summary(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    total = db.query(func.sum(models.Reward.tokens_earned)).filter(models.Reward.user_id == current_user.id).scalar() or 0
    return {"total_earned": total}
