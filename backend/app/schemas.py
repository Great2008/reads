from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# --- User & Wallet Schemas ---
class UserProfile(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    is_admin: bool # 徴 UPGRADE: Admin Flag
    created_at: datetime
    
    class Config:
        from_attributes = True

# 徴 NEW: Schema for requesting an admin status change
class AdminStatusUpdate(BaseModel):
    is_admin: bool

# 泙 FIX: Renamed from WalletBalance to TokenBalance to resolve Vercel crash
class TokenBalance(BaseModel):
    token_balance: int

class UserStats(BaseModel):
    lessons_completed: int
    quizzes_taken: int

class LeaderboardEntry(BaseModel):
    name: str
    token_balance: int
    
    class Config:
        from_attributes = True

# --- Lesson Schemas ---
class LessonBase(BaseModel):
    id: UUID
    category: str
    title: str
    order_index: int

class LessonDetail(LessonBase):
    content: str
    video_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    category: str
    count: int

# 徴 NEW: Schema for Lesson Creation (Admin Input)
class LessonCreate(BaseModel):
    category: str
    title: str
    content: str
    video_url: Optional[str] = None
    order_index: int = 0


# --- Quiz Schemas ---
# 徴 NEW: Schema for creating a Quiz Question
class QuizQuestionBase(BaseModel):
    question: str
    options: List[str] 
    correct_option: str # The correct option identifier, e.g., \"A\"

# 徴 NEW: Schema for creating a batch of quiz questions (Admin Input)
class QuizCreateRequest(BaseModel):
    lesson_id: UUID
    questions: List[QuizQuestionBase]

class QuizQuestionResponse(BaseModel):
    id: UUID
    question: str
    options: List[str] # e.g. [\"Option A\", \"Option B\"]
    
class AnswerSubmission(BaseModel):
    question_id: UUID
    selected: str # \"A\", \"B\", etc.

class QuizSubmitRequest(BaseModel):
    lesson_id: UUID
    answers: List[AnswerSubmission]

class QuizResultResponse(BaseModel):
    score: int
    correct: int
    wrong: int
    tokens_awarded: int

# --- Reward Schemas ---
class RewardHistory(BaseModel):
    id: UUID
    lesson_id: UUID
    tokens_earned: int
    created_at: datetime
    
    class Config:
        from_attributes = True
        
class RewardSummary(BaseModel):
    total_tokens_earned: int
    
class TokenAwardRequest(BaseModel):
    user_id: UUID
    amount: int
    reason: str