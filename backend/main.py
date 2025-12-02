from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime
from uuid import UUID
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

# ====================================================================
# --- 1. ADMIN ROUTES (START) ---
# ====================================================================

# GET /admin/users
@app.get("/admin/users", response_model=List[schemas.UserProfile])
def get_all_users(db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Returns a list of all users for Admin Management."""
    users = db.query(models.User).all()
    return users

# PATCH /admin/users/{user_id}/promote
@app.patch("/admin/users/{user_id}/promote", status_code=status.HTTP_200_OK)
def promote_or_demote_user(
    user_id: str, 
    is_admin: bool, # True to promote, False to demote
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(get_current_admin)
):
    """Promotes or demotes a user based on the 'is_admin' boolean flag (Admin Only)."""
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # 1. Check if the admin is trying to modify their own status
    if user_uuid == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own admin status.")

    # 2. Find the target user
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 3. Apply the change only if the status is different
    if user.is_admin != is_admin:
        user.is_admin = is_admin
        db.commit()
        db.refresh(user)
    
    action = "promoted" if is_admin else "demoted"
    return {"message": f"User {user.name} successfully {action}."}


# 💥 NEW ENDPOINT: GET /admin/lessons
@app.get("/admin/lessons", response_model=List[schemas.LessonBase])
def get_all_lessons(db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Returns a list of all lessons for Admin Content Management (Admin Only)."""
    lessons = db.query(models.Lesson).order_by(models.Lesson.category, models.Lesson.order_index).all()
    return lessons


# POST /admin/lessons
@app.post("/admin/lessons", response_model=schemas.LessonDetail, status_code=status.HTTP_201_CREATED)
def create_lesson(lesson: schemas.LessonCreate, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Creates a new lesson (Admin Only)."""
    
    # 1. Create a new Lesson object
    new_lesson = models.Lesson(
        category=lesson.category,
        title=lesson.title,
        content=lesson.content,
        video_url=lesson.video_url,
        order_index=lesson.order_index
    )
    
    # 2. Add and Commit
    db.add(new_lesson)
    try:
        db.commit()
        db.refresh(new_lesson)
    except Exception as e:
        db.rollback()
        # Log the error
        print(f"Database error (500) during lesson creation: {e}")
        raise HTTPException(status_code=500, detail="Database integrity error or duplicate entry.")
        
    return new_lesson

# DELETE /admin/lessons/{lesson_id}
@app.delete("/admin/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: str, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Deletes a lesson and all associated data (Quiz, Progress, Rewards)."""
    
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")

    # 1. Delete associated data first (to avoid foreign key errors)
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_uuid).delete()
    db.query(models.LessonProgress).filter(models.LessonProgress.lesson_id == lesson_uuid).delete()
    db.query(models.Reward).filter(models.Reward.lesson_id == lesson_uuid).delete()

    # 2. Delete the Lesson
    lesson_query = db.query(models.Lesson).filter(models.Lesson.id == lesson_uuid)
    lesson = lesson_query.first()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson_query.delete(synchronize_session=False)

    # 3. Commit
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database error (500) during lesson deletion: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete deletion due to a database error.")

    return {}


# POST /admin/quiz
@app.post("/admin/quiz", status_code=status.HTTP_201_CREATED)
def create_quiz(quiz_data: schemas.QuizCreateRequest, db: Session = Depends(database.get_db), current_admin: models.User = Depends(get_current_admin)):
    """Creates a new quiz for a lesson (Admin Only)."""
    
    lesson_id = quiz_data.lesson_id
    lesson_id_str = str(lesson_id)
    
    # 1. Validate Lesson exists
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson with ID {lesson_id_str} not found.")

    # 2. OPTIONAL: Delete any existing quiz questions for this lesson before adding new ones
    db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_id).delete()

    # 3. Prepare new questions for insertion
    new_questions = []
    for q_data in quiz_data.questions:
        # Validate correct option letter (A, B, C, D)
        if q_data.correct_option not in ["A", "B", "C", "D"]:
             raise HTTPException(status_code=400, detail=f"Invalid correct option letter '{q_data.correct_option}' in quiz question.")
             
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
        print(f"Database error (500) during quiz upload: {e}")
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
    delete_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.lesson_id == lesson_uuid).delete(synchronize_session=False)
    
    if delete_count == 0:
        raise HTTPException(status_code=404, detail="No quiz found for this lesson ID.")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database error (500) during quiz deletion: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete quiz deletion due to a database error.")
        
    return {}

# ====================================================================
# --- 1. ADMIN ROUTES (END) ---
# ====================================================================

# ... (Rest of the Auth and Learning Routes would follow here)
# ... (Adding a simple root route for health check)

@app.get("/")
def read_root():
    return {"message": "$READS Backend MVP is running"}

# --- AUTH ROUTES ---

# POST /auth/signup
@app.post("/auth/signup", response_model=schemas.Token)
def signup(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # 1. Check if user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Hash password and create user
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        name=user.name, 
        email=user.email, 
        password_hash=hashed_password,
        # First registered user is automatically made admin for easy setup
        is_admin=db.query(models.User).count() == 0 
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 3. Initialize Wallet
    new_wallet = models.Wallet(user_id=new_user.id, token_balance=0)
    db.add(new_wallet)
    db.commit()

    # 4. Create and return token
    access_token = auth.create_access_token(data={"sub": str(new_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

# POST /auth/login
@app.post("/auth/login", response_model=schemas.Token)
def login_for_access_token(form_data: auth.OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # 1. Authenticate the user
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 2. Create token and return
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

# --- PROFILE ROUTES ---

# GET /profile
@app.get("/profile", response_model=schemas.UserProfile)
def read_profile(current_user: models.User = Depends(auth.get_current_user)):
    """Returns the authenticated user's profile information."""
    # The current_user object retrieved by the dependency already contains all necessary data.
    # We use a UserProfile schema to format the output.
    return current_user

# GET /profile/stats
@app.get("/profile/stats", response_model=schemas.UserStats)
def get_user_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns aggregated stats for the current user."""
    
    # Count unique lessons with progress (simplified)
    lessons_completed_count = db.query(models.LessonProgress.lesson_id)\
        .filter(models.LessonProgress.user_id == current_user.id)\
        .group_by(models.LessonProgress.lesson_id)\
        .count()
        
    # Count quizzes taken
    quizzes_taken_count = db.query(models.QuizResult.id)\
        .filter(models.QuizResult.user_id == current_user.id)\
        .count()
        
    return schemas.UserStats(
        lessons_completed=lessons_completed_count,
        quizzes_taken=quizzes_taken_count
    )

# --- WALLET/REWARD ROUTES ---

# GET /wallet/balance
@app.get("/wallet/balance", response_model=schemas.TokenBalance)
def get_wallet_balance(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the current token balance for the authenticated user."""
    wallet = db.query(models.Wallet).filter(models.Wallet.user_id == current_user.id).first()
    if not wallet:
        # This shouldn't happen if wallet is created on signup
        raise HTTPException(status_code=404, detail="Wallet not found")
        
    return schemas.TokenBalance(token_balance=wallet.token_balance)

# GET /wallet/history (Simplified to rewards for now)
@app.get("/wallet/history", response_model=List[schemas.RewardResponse])
def get_wallet_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the recent reward history for the authenticated user."""
    # Joining Reward with Lesson to get the lesson title
    rewards_history = db.query(models.Reward, models.Lesson)\
        .join(models.Lesson, models.Reward.lesson_id == models.Lesson.id)\
        .filter(models.Reward.user_id == current_user.id)\
        .order_by(desc(models.Reward.created_at))\
        .limit(10)\
        .all()
        
    # Format the output to match the RewardResponse schema
    return [
        schemas.RewardResponse(
            id=str(reward.id),
            lesson_title=lesson.title,
            tokens_earned=reward.tokens_earned,
            created_at=reward.created_at,
            type="Reward" # Hardcoded type for simple list
        )
        for reward, lesson in rewards_history
    ]


# --- LEARNING ROUTES (Lessons, Quizzes, Progress) ---

# GET /learn/categories
@app.get("/learn/categories", response_model=List[schemas.CategoryResponse])
def get_lesson_categories(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns a list of all lesson categories and the count of lessons in each."""
    
    category_counts = db.query(
        models.Lesson.category, 
        func.count(models.Lesson.id)
    ).group_by(models.Lesson.category).all()
    
    return [schemas.CategoryResponse(category=cat, count=count) for cat, count in category_counts]


# GET /learn/lessons/{category}
@app.get("/learn/lessons/{category}", response_model=List[schemas.LessonBase])
def get_lessons_by_category(category: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns a list of lessons within a specific category."""
    
    lessons = db.query(models.Lesson)\
        .filter(models.Lesson.category == category)\
        .order_by(models.Lesson.order_index)\
        .all()
        
    if not lessons:
        # Return an empty list if no lessons are found, instead of 404
        return []

    # LessonBase schema handles the fields
    return lessons


# GET /learn/lesson/{lesson_id}
@app.get("/learn/lesson/{lesson_id}", response_model=schemas.LessonDetail)
def get_lesson_detail(lesson_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the detail content for a single lesson."""
    
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")
        
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_uuid).first()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return lesson


# GET /learn/quiz/{lesson_id}
@app.get("/learn/quiz/{lesson_id}", response_model=List[schemas.QuizQuestionResponse])
def get_quiz_by_lesson(lesson_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns the quiz questions for a lesson."""
    
    try:
        lesson_uuid = UUID(lesson_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")
        
    questions = db.query(models.QuizQuestion)\
        .filter(models.QuizQuestion.lesson_id == lesson_uuid)\
        .order_by(models.QuizQuestion.created_at)\
        .all()
        
    if not questions:
        raise HTTPException(status_code=404, detail="Quiz questions not found for this lesson.")

    # Note: QuizQuestionResponse schema excludes the correct_option
    return questions


# POST /learn/quiz/submit
@app.post("/learn/quiz/submit", response_model=schemas.QuizResultResponse)
def submit_quiz_answers(submission: schemas.QuizSubmitRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Processes submitted quiz answers, saves results, and awards tokens."""
    
    lesson_id = submission.lesson_id
    user_id = current_user.id
    
    # 1. Fetch all correct answers for the quiz questions
    question_ids = [ans.question_id for ans in submission.answers]
    correct_answers_map = db.query(models.QuizQuestion.id, models.QuizQuestion.correct_option)\
        .filter(models.QuizQuestion.id.in_(question_ids))\
        .all()
    correct_answers = {q_id: correct_opt for q_id, correct_opt in correct_answers_map}
    
    if not correct_answers:
        raise HTTPException(status_code=404, detail="No valid questions found for grading.")

    # 2. Grade the quiz
    total_questions = len(question_ids)
    correct_count = 0
    
    for answer in submission.answers:
        if str(answer.question_id) in [str(id) for id in correct_answers.keys()]:
            if answer.selected == correct_answers[answer.question_id]:
                correct_count += 1
                
    wrong_count = total_questions - correct_count
    score = int((correct_count / total_questions) * 100) if total_questions > 0 else 0
    
    # 3. Save Quiz Result
    new_result = models.QuizResult(
        user_id=user_id,
        lesson_id=lesson_id,
        score=score,
        correct_count=correct_count,
        wrong_count=wrong_count
    )
    db.add(new_result)
    
    # 4. Award Tokens based on success criteria (e.g., passing score > 70)
    tokens_earned = 0
    if score >= 70:
        tokens_earned = 20 # Example reward value
        
        # Save Reward
        new_reward = models.Reward(
            user_id=user_id,
            lesson_id=lesson_id,
            tokens_earned=tokens_earned
        )
        db.add(new_reward)
        
        # Update Wallet
        wallet = db.query(models.Wallet).filter(models.Wallet.user_id == user_id).first()
        if wallet:
            wallet.token_balance += tokens_earned
        
        # Save Lesson Progress (Mark as completed)
        # Check if progress already exists for this lesson
        progress = db.query(models.LessonProgress)\
            .filter(models.LessonProgress.user_id == user_id, models.LessonProgress.lesson_id == lesson_id)\
            .first()
        
        if not progress:
            new_progress = models.LessonProgress(user_id=user_id, lesson_id=lesson_id)
            db.add(new_progress)
            
    # 5. Commit all changes
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Database error (500) during quiz submission save: {e}")
        raise HTTPException(status_code=500, detail="Failed to save quiz results and rewards.")
        
    # 6. Return response
    return schemas.QuizResultResponse(
        score=score,
        correct=correct_count,
        wrong=wrong_count,
        tokens_earned=tokens_earned,
        message=f"Quiz submitted. Score: {score}%. {'Tokens awarded!' if tokens_earned > 0 else 'Keep practicing!'}"
    )
