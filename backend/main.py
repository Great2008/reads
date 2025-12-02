from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


# ----------------------------------------------------
# --- 3.1 AUTHENTICATION & PROFILES ---
# ----------------------------------------------------

@app.post("/auth/login", response_model=schemas.Token)
def login_for_access_token(user_in: schemas.UserLogin, db: Session = Depends(database.get_db)):
    """Logs in a user and returns an access token."""
    user = auth.authenticate_user(db, user_in.email, user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/signup", response_model=schemas.Token)
def signup_user(user_in: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """Registers a new user."""
    # 1. Check if user already exists
    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # 2. Create new user
    hashed_password = auth.get_password_hash(user_in.password)
    new_user = models.User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_password,
        # Default is_admin to False
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 3. Create wallet for the new user
    new_wallet = models.Wallet(user_id=new_user.id, token_balance=0)
    db.add(new_wallet)
    db.commit()

    # 4. Generate token and return
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(new_user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/user/profile", response_model=schemas.UserProfile)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """Returns the profile of the currently authenticated user."""
    # The current_user object already contains all necessary data
    return current_user

@app.get("/user/stats", response_model=schemas.UserStats)
def get_user_stats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Returns aggregated stats for the current user."""
    
    # Count distinct completed lessons
    lessons_completed = db.query(models.LessonProgress)\
        .filter(models.LessonProgress.user_id == current_user.id)\
        .filter(models.LessonProgress.is_completed == True)\
        .count()

    # Count quiz results
    quizzes_taken = db.query(models.QuizResult)\
        .filter(models.QuizResult.user_id == current_user.id)\
        .count()
        
    return {
        "lessons_completed": lessons_completed,
        "quizzes_taken": quizzes_taken
    }


# ----------------------------------------------------
# --- 3.2 LESSONS & QUIZZES ---
# ----------------------------------------------------

@app.get("/lessons/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns a list of all lesson categories and the count of lessons in each."""
    categories = db.query(models.Lesson.category, func.count(models.Lesson.id).label('count'))\
        .group_by(models.Lesson.category)\
        .all()
    
    # Map results to the CategoryResponse schema
    return [{"category": cat, "count": count} for cat, count in categories]


@app.get("/lessons/category/{category_name}", response_model=List[schemas.LessonBase])
def get_lessons_by_category(category_name: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns a list of lessons for a given category."""
    lessons = db.query(models.Lesson)\
        .filter(models.Lesson.category == category_name)\
        .order_by(models.Lesson.order_index)\
        .all()
    
    if not lessons:
        # NOTE: Returning 200 with empty list is often better than 404 for list endpoints
        return [] 
        
    return lessons

@app.get("/lessons/{lesson_id}", response_model=schemas.LessonDetail)
def get_lesson_detail(lesson_id: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the content and details of a single lesson."""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return lesson

@app.get("/lessons/{lesson_id}/quiz", response_model=List[schemas.QuizQuestionResponse])
def get_lesson_quiz(lesson_id: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the quiz questions for a lesson."""
    questions = db.query(models.QuizQuestion)\
        .filter(models.QuizQuestion.lesson_id == lesson_id)\
        .all()
    
    # Note: The response model ensures we only send back the ID, question, and options (NO correct answer)
    return questions

@app.post("/quiz/submit", response_model=schemas.QuizResultResponse)
def submit_quiz_answers(
    submission: schemas.QuizSubmitRequest, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """Processes submitted quiz answers, calculates score, updates progress, and awards tokens."""
    
    lesson_id = submission.lesson_id
    user_id = current_user.id
    
    # 1. Fetch all quiz questions and correct answers for the lesson
    correct_answers = {
        str(q.id): q.correct_option
        for q in db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).all()
    }
    
    if not correct_answers:
        raise HTTPException(status_code=404, detail="Quiz not found for this lesson.")

    # 2. Calculate score
    correct_count = 0
    total_questions = len(correct_answers)
    
    for answer in submission.answers:
        # Ensure we only check submissions for existing questions
        if str(answer.question_id) in correct_answers:
            # Check if the submitted option text matches the stored correct option text
            if answer.selected == correct_answers[str(answer.question_id)]:
                correct_count += 1
    
    wrong_count = total_questions - correct_count
    score = int((correct_count / total_questions) * 100)

    # 3. Save Quiz Result
    new_result = models.QuizResult(
        user_id=user_id,
        lesson_id=lesson_id,
        score=score,
        correct_count=correct_count,
        wrong_count=wrong_count
    )
    db.add(new_result)

    # 4. Update Lesson Progress (Mark as completed if score > 70%)
    is_completed = score >= 70
    progress = db.query(models.LessonProgress).filter(
        models.LessonProgress.user_id == user_id,
        models.LessonProgress.lesson_id == lesson_id
    ).first()

    if progress:
        progress.is_completed = is_completed
        progress.last_attempt_score = score
        progress.updated_at = datetime.now(timezone.utc)
    else:
        new_progress = models.LessonProgress(
            user_id=user_id,
            lesson_id=lesson_id,
            is_completed=is_completed,
            last_attempt_score=score
        )
        db.add(new_progress)
    
    # 5. Award Tokens (Award only if completed AND first time completing)
    tokens_awarded = 0
    # Check if a reward already exists for this lesson/user (simple first-completion logic)
    existing_reward = db.query(models.Reward).filter(
        models.Reward.user_id == user_id,
        models.Reward.lesson_id == lesson_id
    ).first()

    if is_completed and not existing_reward:
        tokens_awarded = 20 # Fixed reward for completing a lesson
        
        # Create Reward entry
        new_reward = models.Reward(
            user_id=user_id,
            lesson_id=lesson_id,
            tokens_earned=tokens_awarded
        )
        db.add(new_reward)
        
        # Update Wallet
        wallet = db.query(models.Wallet).filter(models.Wallet.user_id == user_id).first()
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
# --- 3.4 Rewards & Wallet ---
# ----------------------------------------------------

@app.get("/wallet/balance", response_model=schemas.TokenBalance)
def get_wallet_balance(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Fetches the token balance for the current user."""
    if not current_user.wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    return {"token_balance": current_user.wallet.token_balance}

@app.get("/rewards/history", response_model=List[schemas.RewardHistory])
def reward_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the history of token rewards for the user."""
    # Note: Requires RewardHistory schema to correctly handle the nested lesson data
    return db.query(models.Reward).filter(models.Reward.user_id == current_user.id).all()


# ----------------------------------------------------
# --- 3.5 ADMIN ENDPOINTS (NEW BLOCK) ---
# ----------------------------------------------------

# --- A. User Management ---

@app.get("/admin/users", response_model=List[schemas.UserProfile])
def get_all_users(db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Admin: Get a list of all users."""
    return db.query(models.User).all()

@app.put("/admin/users/{user_id}/promote")
def promote_user(
    user_id: UUID, 
    # Use Query to read the optional is_admin boolean from the query string
    is_admin: bool = Query(True), 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(get_current_admin)
):
    """Admin: Promote or demote a user."""
    user_to_promote = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user_to_promote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    # Prevent changing one's own admin status
    if user_to_promote.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own admin status via this endpoint")

    user_to_promote.is_admin = is_admin
    db.commit()
    db.refresh(user_to_promote)
    
    return {"message": f"User {user_to_promote.name} admin status set to {is_admin}"}


# --- B. Lesson Content Management ---

@app.post("/admin/lessons", response_model=schemas.LessonDetail)
def create_lesson(
    lesson_data: schemas.LessonCreate, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(get_current_admin)
):
    """Admin: Create a new lesson."""
    new_lesson = models.Lesson(**lesson_data.model_dump())
    
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson

@app.delete("/admin/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_id: UUID, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(get_current_admin)
):
    """Admin: Delete a lesson and all associated data."""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    # CRITICAL: Delete associated records that depend on the lesson_id
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).delete(synchronize_session=False)
    db.query(models.QuizResult).filter(models.QuizResult.lesson_id == lesson_id).delete(synchronize_session=False)
    db.query(models.Reward).filter(models.Reward.lesson_id == lesson_id).delete(synchronize_session=False)
    db.query(models.LessonProgress).filter(models.LessonProgress.lesson_id == lesson_id).delete(synchronize_session=False)

    # Delete the lesson
    db.delete(lesson)
    db.commit()
    return {} # 204 No Content


# --- C. Quiz Management ---

@app.post("/admin/quiz", response_model=dict)
def upload_quiz(
    quiz_request: schemas.QuizCreateRequest, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(get_current_admin)
):
    """Admin: Creates/Overwrites the entire quiz for a given lesson."""
    lesson_id = quiz_request.lesson_id

    # 1. Check if lesson exists
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    # 2. Delete existing questions for this lesson to 'overwrite'
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).delete(synchronize_session=False)
    db.commit()

    # 3. Insert new questions
    new_questions = []
    for q_data in quiz_request.questions:
        # Validate that the correct_option is present in the options list
        if q_data.correct_option not in q_data.options:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Correct option '{q_data.correct_option}' is not present in the options list for a question.")
             
        new_question = models.QuizQuestion(
            lesson_id=lesson_id,
            question=q_data.question,
            options=q_data.options,
            correct_option=q_data.correct_option
        )
        new_questions.append(new_question)
    
    db.add_all(new_questions)
    db.commit()

    return {"message": f"Successfully uploaded {len(new_questions)} questions for lesson: {lesson.title}"}

@app.delete("/admin/quiz/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    lesson_id: UUID, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(get_current_admin)
):
    """Admin: Delete the quiz for a specific lesson."""
    # Delete associated quiz questions
    deleted_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).delete(synchronize_session=False)
    db.commit()
    
    if deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found for this lesson.")
        
    return {} # 204 No Content