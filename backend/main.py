from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime
import uuid
from uuid import UUID
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

@app.post("/auth/register", response_model=schemas.UserProfile)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user_id = uuid.uuid4()
    
    db_user = models.User(
        id=new_user_id,
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        # The first user registered can be made an admin for initial setup.
        # Otherwise, they are a regular user. We'll stick to regular user by default.
        is_admin=False 
    )
    db.add(db_user)
    
    # Also create a wallet for the new user
    db_wallet = models.Wallet(user_id=new_user_id, token_balance=0)
    db.add(db_wallet)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/auth/login", response_model=schemas.Token)
def login_for_access_token(user_credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    if not user or not auth.verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Token subject is the user's ID
    access_token = auth.create_access_token(
        data={"sub": str(user.id), "is_admin": user.is_admin} 
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/profile", response_model=schemas.UserProfile)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/stats", response_model=schemas.UserStats)
def get_user_stats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    completed_count = db.query(models.LessonProgress).filter(
        models.LessonProgress.user_id == current_user.id,
        models.LessonProgress.is_completed == True
    ).count()
    
    quiz_count = db.query(models.QuizResult).filter(
        models.QuizResult.user_id == current_user.id
    ).count()
    
    return {
        "lessons_completed": completed_count,
        "quizzes_taken": quiz_count
    }
    
@app.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(db: Session = Depends(database.get_db)):
    # Join User and Wallet, order by token balance descending
    leaderboard = db.query(models.User.name, models.Wallet.token_balance) \
        .join(models.Wallet, models.User.id == models.Wallet.user_id) \
        .order_by(desc(models.Wallet.token_balance)) \
        .limit(10) \
        .all()
    
    # Map to the Pydantic schema
    return [
        schemas.LeaderboardEntry(name=name, token_balance=balance)
        for name, balance in leaderboard
    ]

# ----------------------------------------------------
# --- 3.1.1 ADMIN USER MANAGEMENT (To see buttons) ---
# ----------------------------------------------------

# 泙 ADMIN ENDPOINT: Get All Users (Frontend calls this)
@app.get("/users", response_model=List[schemas.UserProfile])
def get_all_users(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_admin)):
    """Retrieves a list of all users. Requires Admin privileges."""
    return db.query(models.User).all()

# 泙 ADMIN ENDPOINT: Promote/Demote User (Frontend calls this)
@app.patch("/users/{user_id}/admin-status", response_model=schemas.UserProfile)
def update_user_admin_status(
    user_id: UUID, 
    update: schemas.AdminStatusUpdate, # <--- Uses the new schema
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_admin)
):
    """Promotes or demotes a user by toggling the is_admin flag. Requires Admin privileges."""
    
    user_to_update = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent an admin from demoting themselves
    if user_to_update.id == current_user.id and user_to_update.is_admin and update.is_admin == False:
        raise HTTPException(status_code=400, detail="Cannot demote yourself!")

    user_to_update.is_admin = update.is_admin
    db.commit()
    db.refresh(user_to_update)
    
    return user_to_update


# ----------------------------------------------------
# --- 3.2 LESSONS & PROGRESS ---\
# ----------------------------------------------------

@app.post("/lessons", response_model=schemas.LessonDetail, status_code=status.HTTP_201_CREATED)
def create_lesson(lesson: schemas.LessonCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_admin)):
    db_lesson = models.Lesson(
        id=uuid.uuid4(),
        category=lesson.category,
        title=lesson.title,
        content=lesson.content,
        video_url=lesson.video_url,
        order_index=lesson.order_index
    )
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return db_lesson

@app.get("/lessons/categories", response_model=List[schemas.CategoryResponse])
def get_lesson_categories(db: Session = Depends(database.get_db)):
    categories = db.query(
        models.Lesson.category, 
        func.count(models.Lesson.category)
    ).group_by(models.Lesson.category).all()
    
    return [{"category": cat, "count": count} for cat, count in categories]

@app.get("/lessons", response_model=List[schemas.LessonBase])
def get_lessons_by_category(category: str, db: Session = Depends(database.get_db)):
    lessons = db.query(models.Lesson).filter(models.Lesson.category == category).order_by(models.Lesson.order_index).all()
    return lessons

@app.get("/lessons/{lesson_id}", response_model=schemas.LessonDetail)
def get_lesson_detail(lesson_id: UUID, db: Session = Depends(database.get_db)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson

@app.post("/lessons/{lesson_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
def complete_lesson(lesson_id: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # 1. Check if lesson exists (implicitly handled by FK constraint, but good practice)
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # 2. Find or create progress record
    progress = db.query(models.LessonProgress).filter(
        models.LessonProgress.user_id == current_user.id,
        models.LessonProgress.lesson_id == lesson_id
    ).first()

    if progress:
        if progress.is_completed:
            # Already completed, nothing to do
            return
        progress.is_completed = True
        progress.completed_at = datetime.now()
    else:
        # Create new progress record
        progress = models.LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            is_completed=True,
            completed_at=datetime.now()
        )
        db.add(progress)
        
    db.commit()
    return

@app.get("/lessons/{lesson_id}/progress", response_model=bool)
def get_lesson_progress(lesson_id: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    progress = db.query(models.LessonProgress).filter(
        models.LessonProgress.user_id == current_user.id,
        models.LessonProgress.lesson_id == lesson_id
    ).first()
    
    return progress.is_completed if progress else False


# ----------------------------------------------------
# --- 3.3 QUIZZES ---\
# ----------------------------------------------------

@app.post("/quizzes/questions", status_code=status.HTTP_201_CREATED)
def create_quiz_questions(request: schemas.QuizCreateRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_admin)):
    
    lesson = db.query(models.Lesson).filter(models.Lesson.id == request.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    db_questions = []
    for q_data in request.questions:
        db_question = models.QuizQuestion(
            id=uuid.uuid4(),
            lesson_id=request.lesson_id,
            question=q_data.question,
            options=q_data.options,
            correct_option=q_data.correct_option
        )
        db_questions.append(db_question)
        
    db.add_all(db_questions)
    db.commit()
    
    return {"message": f"Successfully created {len(db_questions)} questions for lesson {request.lesson_id}"}


@app.get("/quizzes/{lesson_id}", response_model=List[schemas.QuizQuestionResponse])
def get_quiz_questions(lesson_id: UUID, db: Session = Depends(database.get_db)):
    questions = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No quiz questions found for this lesson")
        
    # Exclude the correct_option when sending to the user
    response_data = []
    for q in questions:
        response_data.append(schemas.QuizQuestionResponse(
            id=q.id,
            question=q.question,
            options=q.options
        ))
    return response_data
    
@app.post("/quizzes/{lesson_id}/submit", response_model=schemas.QuizResultResponse)
def submit_quiz(lesson_id: UUID, submission: schemas.QuizSubmitRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    
    # 1. Fetch all questions for the lesson
    lesson_questions = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).all()
    if not lesson_questions:
        raise HTTPException(status_code=404, detail="No quiz questions found for this lesson")
        
    question_map = {str(q.id): q for q in lesson_questions}
    
    correct_count = 0
    wrong_count = 0
    
    # 2. Evaluate answers
    for answer in submission.answers:
        q_id_str = str(answer.question_id)
        if q_id_str in question_map:
            question = question_map[q_id_str]
            if answer.selected == question.correct_option:
                correct_count += 1
            else:
                wrong_count += 1
        
    total_questions = len(lesson_questions)
    if total_questions == 0:
        score = 0
    else:
        score = int((correct_count / total_questions) * 100)
        
    # 3. Calculate rewards (e.g., 5 tokens per correct answer)
    TOKENS_PER_CORRECT_ANSWER = 5
    tokens_awarded = correct_count * TOKENS_PER_CORRECT_ANSWER
    
    # 4. Save Quiz Result
    db_result = models.QuizResult(
        user_id=current_user.id,
        lesson_id=lesson_id,
        score=score,
        correct_count=correct_count,
        wrong_count=wrong_count
    )
    db.add(db_result)
    
    # 5. Award Tokens and Update Wallet
    if tokens_awarded > 0:
        db_reward = models.Reward(
            user_id=current_user.id,
            lesson_id=lesson_id,
            tokens_earned=tokens_awarded
        )
        db.add(db_reward)
        
        wallet = db.query(models.Wallet).filter(models.Wallet.user_id == current_user.id).first()
        if wallet:
            wallet.token_balance += tokens_awarded
        
    db.commit()
    
    return {
        "score": score,
        "correct": correct_count,
        "wrong": wrong_count,
        "tokens_awarded": tokens_awarded
    }

# ----------------------------------------------------
# --- 3.4 Rewards ---\
# ----------------------------------------------------

# 泙 NEW ENDPOINT: Wallet Balance (Fixes 404 for /api/wallet/balance)
@app.get("/wallet/balance", response_model=schemas.TokenBalance)
def get_wallet_balance(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Fetches the token balance for the current user."""
    # Note: current_user model instance has direct access to the wallet relationship
    if not current_user.wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    return {"token_balance": current_user.wallet.token_balance}
# ----------------------------------------------------

@app.get("/rewards/history", response_model=List[schemas.RewardHistory])
def reward_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Reward).filter(models.Reward.user_id == current_user.id).all()

@app.get("/rewards/summary", response_model=schemas.RewardSummary)
def reward_summary(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    total = db.query(func.sum(models.Reward.tokens_earned)).filter(models.Reward.user_id == current_user.id).scalar()
    return {"total_tokens_earned": total or 0}

# 泙 ADMIN ENDPOINT: Manually Award Tokens (Example of Admin action)
@app.post("/rewards/award", response_model=schemas.TokenBalance, status_code=status.HTTP_200_OK)
def award_tokens_manually(
    request: schemas.TokenAwardRequest, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_admin)
):
    """Admin endpoint to manually award tokens to any user."""
    
    target_user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
        
    wallet = db.query(models.Wallet).filter(models.Wallet.user_id == request.user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Target user wallet not found")
        
    # Update wallet balance
    wallet.token_balance += request.amount
    
    # Optionally save a reward record for tracking
    db_reward = models.Reward(
        user_id=request.user_id,
        lesson_id=None, # No specific lesson for manual award
        tokens_earned=request.amount,
        # You might want to log the admin user's ID or the reason here
    )
    db.add(db_reward)
    
    db.commit()
    db.refresh(wallet)
    
    return {"token_balance": wallet.token_balance}