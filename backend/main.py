from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime
from uuid import UUID # <--- Imported UUID for path parameters
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
        # Log the failure reason on the server
        print(f"ADMIN FAIL: User {current_user.id} tried to access admin route.")
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


# ----------------------------------------------------
# --- 3.1 AUTHENTICATION & PROFILES ---
# ----------------------------------------------------

@app.post("/auth/signup", response_model=schemas.Token)
def signup_user(user_data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Check if user already exists
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password and create user
    hashed_password = auth.get_password_hash(user_data.password)
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password,
    )
    db.add(new_user)
    db.flush() # Flush to get the ID for the wallet
    
    # Create associated wallet
    new_wallet = models.Wallet(user_id=new_user.id, token_balance=50) # Starting balance
    db.add(new_wallet)
    db.commit()
    
    # Create JWT token
    access_token = auth.create_access_token(
        data={"sub": str(new_user.id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/login", response_model=schemas.Token)
def login_for_access_token(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or not auth.verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/user/profile", response_model=schemas.UserProfile)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/user/stats", response_model=schemas.UserStats)
def get_user_stats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    lessons_completed = db.query(models.LessonProgress).filter(models.LessonProgress.user_id == current_user.id).count()
    quizzes_taken = db.query(models.QuizResult).filter(models.QuizResult.user_id == current_user.id).count()
    
    return schemas.UserStats(
        lessons_completed=lessons_completed,
        quizzes_taken=quizzes_taken
    )

# ----------------------------------------------------
# --- 3.2 LEARNING CONTENT ---
# ----------------------------------------------------

@app.get("/lessons/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    results = db.query(
        models.Lesson.category,
        func.count(models.Lesson.id).label('count')
    ).group_by(models.Lesson.category).all()

    return [schemas.CategoryResponse(category=r.category, count=r.count) for r in results]


@app.get("/lessons/category/{category_name}", response_model=List[schemas.LessonBase])
def get_lessons_by_category(category_name: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    lessons = db.query(models.Lesson).filter(models.Lesson.category == category_name).order_by(models.Lesson.order_index).all()
    return lessons


@app.get("/lessons/{lesson_id}", response_model=schemas.LessonDetail)
def get_lesson_detail(lesson_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")
        
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_uuid).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Record progress (upsert logic - simple set completed=True)
    progress = db.query(models.LessonProgress).filter(
        models.LessonProgress.user_id == current_user.id,
        models.LessonProgress.lesson_id == lesson_uuid
    ).first()

    if not progress:
        progress = models.LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_uuid,
            completed=True
        )
        db.add(progress)
        db.commit()
    
    return lesson


# ----------------------------------------------------
# --- 3.3 QUIZ SUBMISSION ---
# ----------------------------------------------------

@app.get("/lessons/{lesson_id}/quiz", response_model=List[schemas.QuizQuestionResponse])
def get_quiz_questions(lesson_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")

    questions = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_uuid).all()
    if not questions:
        raise HTTPException(status_code=404, detail="Quiz not found for this lesson")
    
    # Note: response_model automatically strips the 'correct_option' field
    return questions


@app.post("/quiz/submit", response_model=schemas.QuizResultResponse)
def submit_quiz(submission: schemas.QuizSubmitRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    lesson_id = submission.lesson_id
    
    # Fetch all correct answers for the lesson's quiz
    quiz_questions = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).all()
    if not quiz_questions:
        raise HTTPException(status_code=404, detail="Quiz questions not found for this lesson")
        
    correct_answers = {str(q.id): q.correct_option for q in quiz_questions}
    
    correct_count = 0
    
    for answer in submission.answers:
        if str(answer.question_id) in correct_answers and answer.selected == correct_answers[str(answer.question_id)]:
            correct_count += 1
            
    wrong_count = len(submission.answers) - correct_count
    total_questions = len(quiz_questions)

    # Scoring and Rewards logic
    score = int((correct_count / total_questions) * 100) if total_questions > 0 else 0
    tokens_awarded = 0
    
    if score >= 70:
        tokens_awarded = 100
        
        # Award tokens
        user_wallet = db.query(models.Wallet).filter(models.Wallet.user_id == current_user.id).first()
        if user_wallet:
            user_wallet.token_balance += tokens_awarded
        
        # Record reward history
        new_reward = models.Reward(
            user_id=current_user.id,
            lesson_id=lesson_id,
            tokens_earned=tokens_awarded
        )
        db.add(new_reward)

    # Record Quiz Result
    new_result = models.QuizResult(
        user_id=current_user.id,
        lesson_id=lesson_id,
        score=score,
        correct_count=correct_count,
        wrong_count=wrong_count
    )
    db.add(new_result)
    db.commit()

    return {
        "score": score,
        "correct": correct_count,
        "wrong": wrong_count,
        "tokens_awarded": tokens_awarded
    }

# ----------------------------------------------------
# --- 3.4 Rewards ---
# ----------------------------------------------------

@app.get("/wallet/balance", response_model=schemas.TokenBalance)
def get_wallet_balance(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Fetches the token balance for the current user."""
    if not current_user.wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    return {"token_balance": current_user.wallet.token_balance}

@app.get("/rewards/history", response_model=List[schemas.RewardHistory])
def reward_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Reward).filter(models.Reward.user_id == current_user.id).all()

@app.get("/rewards/summary", response_model=schemas.RewardSummary)
def reward_summary(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    total = db.query(func.sum(models.Reward.tokens_earned)).filter(models.Reward.user_id == current_user.id).scalar() or 0
    
    return schemas.RewardSummary(
        total_tokens_earned=total,
        total_quizzes_passed=db.query(models.Reward).filter(models.Reward.user_id == current_user.id).count()
    )

# ----------------------------------------------------
# --- 4. ADMIN ENDPOINTS (Requires get_current_admin) ---
# ----------------------------------------------------

@app.get("/admin/users", response_model=List[schemas.UserProfile])
def get_users(db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Fetches all user profiles (Admin Only)."""
    return db.query(models.User).all()

@app.put("/admin/users/{user_id}/promote")
def promote_user(user_id: str, is_admin: bool, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Promotes/Demotes a user by setting is_admin flag (Admin Only)."""
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_admin = is_admin
    db.commit()
    return {"message": f"User {user.name} admin status set to {is_admin}"}

@app.post("/admin/lessons", response_model=schemas.LessonDetail)
def create_lesson(lesson_data: schemas.LessonCreate, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Creates a new lesson (Admin Only)."""
    new_lesson = models.Lesson(**lesson_data.model_dump())
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson

# DELETE /admin/lessons/{lesson_id}
@app.delete("/admin/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: str, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Deletes a lesson and all associated records (Admin Only)."""
    
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")
    
    # 1. Find the lesson
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_uuid).first()
    if not lesson:
        # Returning 404 if the lesson is not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
        
    # 2. Delete ALL dependent records explicitly (CRITICAL for data integrity)
    
    # Delete Lesson Progress
    db.query(models.LessonProgress).filter(models.LessonProgress.lesson_id == lesson_uuid).delete(synchronize_session=False)
    
    # Delete Quiz Questions
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_uuid).delete(synchronize_session=False)
    
    # Delete Quiz Results
    db.query(models.QuizResult).filter(models.QuizResult.lesson_id == lesson_uuid).delete(synchronize_session=False)

    # Delete Rewards earned for this lesson
    db.query(models.Reward).filter(models.Reward.lesson_id == lesson_uuid).delete(synchronize_session=False)
    
    # 3. Delete the main Lesson
    db.delete(lesson)
    
    # 4. Commit all deletions
    db.commit()
    
    # Returns 204 No Content due to status_code argument
    return 


@app.post("/admin/quiz")
def upload_quiz(quiz_request: schemas.QuizCreateRequest, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Creates/Updates the quiz questions for a lesson (Admin Only)."""
    
    # Ensures current user is admin (Checked by dependency, but good for logging)
    if not current_admin.is_admin:
        # This shouldn't be reached if dependency works, but acts as a safeguard
        raise HTTPException(status_code=403, detail="Admin privileges required")

    lesson_id = quiz_request.lesson_id
    lesson_id_str = str(lesson_id)
    
    # 1. Verify Lesson exists, using the string representation for consistency
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id_str).first()
    
    if not lesson:
        print(f"Quiz Upload Fail: Lesson ID {lesson_id_str} not found.")
        raise HTTPException(status_code=404, detail="Lesson not found for quiz association")

    # 2. Delete existing quiz questions for this lesson (to ensure clean update/overwrite)
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id_str).delete(synchronize_session=False)

    # 3. Insert new questions
    new_questions = []
    for q_data in quiz_request.questions:
             
        new_q = models.QuizQuestion(
            lesson_id=lesson_id, 
            question=q_data.question,
            options=q_data.options,
            correct_option=q_data.correct_option
        )
        new_questions.append(new_q)
    
    db.add_all(new_questions)
    
    # 4. Attempt commit and handle potential database errors
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database error during quiz upload: {e}")
        # Raising a 500 allows us to catch database integrity/connection issues
        raise HTTPException(status_code=500, detail="Database integrity error during quiz save.")
    
    return {"message": f"Successfully added {len(new_questions)} quiz questions for lesson {lesson_id_str}"}


# DELETE /admin/quiz/{lesson_id}
@app.delete("/admin/quiz/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(lesson_id: str, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Deletes all quiz questions associated with a lesson (Admin Only)."""
    
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")
        
    # Delete Quiz Questions
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_uuid).delete(synchronize_session=False)
    db.commit()
        
    # Returns 204 No Content due to status_code argument
    return

