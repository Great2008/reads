import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowLeft, PlayCircle, Clock, Award, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

// --- Sub-Components ---

// Component 1: Lesson Detail View
// NOTE: This component now defends against 'lesson.content' being null or undefined
const LessonDetailView = ({ lesson, onNavigate }) => {
    
    // 🟢 FIX: Ensure lesson.content is a string before calling .replace()
    const safeContent = (lesson.content || '').replace(/\n/g, '<br/>');

    // Utility function to get the video ID for embedding
    const getEmbedUrl = (url) => {
        if (!url) return null;
        if (url.includes('youtube.com/watch?v=')) {
            // Extract v= parameter value
            const match = url.match(/[?&]v=([^&]+)/);
            return match ? `https://www.youtube.com/embed/${match[1]}` : url;
        }
        return url.startsWith('http') ? url : `https://www.youtube.com/embed/${url}`; // Assume it's an ID if not a full URL
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <button onClick={() => onNavigate('learn', 'list', lesson.category)} className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 dark:text-indigo-400 dark:hover:text-indigo-300">
                <ArrowLeft size={16} className="mr-1" /> Back to Lessons
            </button>
            <h2 className="text-3xl font-bold dark:text-white">{lesson.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-semibold">{lesson.category}</span>
                <span className="flex items-center dark:text-gray-400"><Clock size={16} className="mr-1" /> Duration: 15 min</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
                <h3 className="text-xl font-bold mb-4 dark:text-white">Content Overview</h3>
                <div 
                    className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4"
                    // 🟢 FIX APPLIED HERE: Use safeContent
                    dangerouslySetInnerHTML={{ __html: safeContent }} 
                />
            </div>
            
            {lesson.video_url && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold mb-3 dark:text-white">Video Lecture</h3>
                    <iframe
                        className="w-full aspect-video rounded-xl shadow-lg border border-gray-200 dark:border-slate-700"
                        src={getEmbedUrl(lesson.video_url)} // Use utility function to ensure valid embed URL
                        title="Video Lecture"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            )}

            <button
                // 🟢 FIX: Pass the lesson ID explicitly to the quiz view
                onClick={() => onNavigate('learn', 'quiz', { lessonId: lesson.id, lessonTitle: lesson.title })} 
                className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mt-6"
            >
                <Award size={20} /> Start Quiz to Earn $READS
            </button>
        </div>
    );
};

// Component 2: Quiz View
const QuizView = ({ lessonData, onNavigate, onUpdateWallet }) => { // 🟢 NOTE: Renamed 'lesson' prop to 'lessonData' for clarity
    const lessonId = lessonData.lessonId;
    const lessonTitle = lessonData.lessonTitle;
    
    const [questions, setQuestions] = useState([]);
    const [step, setStep] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [answers, setAnswers] = useState({}); // { question_id: selected_option_char }
    const [quizResult, setQuizResult] = useState(null); // { score, correct, wrong, tokens_awarded }
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Use the ID from the prop to fetch questions
        api.learn.getQuizQuestions(lessonId).then(setQuestions);
    }, [lessonId]);

    // Handle user selecting an option for the current question
    const handleAnswerSelect = (optionChar) => {
        setSelectedAnswer(optionChar);
    };
    
    // Move to the next question or submit
    const handleNext = async () => {
        if (selectedAnswer === null) return;

        const currentQuestion = questions[step];
        
        // 1. Record the answer
        const newAnswers = { 
            ...answers, 
            [currentQuestion.id]: selectedAnswer 
        };
        setAnswers(newAnswers);
        setSelectedAnswer(null);

        // 2. Check if this was the last question
        if (step < questions.length - 1) {
            setStep(step + 1);
        } else {
            // 3. Submit the final quiz
            setIsLoading(true);
            try {
                // Convert answers map to the array format required by the API
                const submissionArray = Object.entries(newAnswers).map(([q_id, selected]) => ({
                    question_id: q_id,
                    selected: selected
                }));

                const result = await api.learn.submitQuiz(lessonId, submissionArray);
                setQuizResult(result);
                // Update the global wallet balance (pass the new balance)
                // The API result usually returns the tokens awarded, not the total balance.
                // We trust the onUpdateWallet handler to manage the balance update (e.g., fetching new balance or adding to old)
                onUpdateWallet(result.tokens_awarded); 
            } catch (e) {
                console.error("Quiz submission failed:", e);
                alert("Failed to submit quiz. Please try again.");
                // 🟢 Navigate back to lesson detail on failure
                onNavigate('learn', 'detail', { id: lessonId }); 
            } finally {
                setIsLoading(false);
            }
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center dark:text-white">Submitting Quiz and Calculating Rewards...</div>;
    }

    if (!questions.length) {
        return <div className="p-8 text-center dark:text-white">Loading quiz questions...</div>;
    }
    
    // Quiz Result View
    if (quizResult) {
        const { score, correct, wrong, tokens_awarded } = quizResult;
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl space-y-6 animate-fade-in">
                <CheckCircle size={60} className="text-green-500 mx-auto" />
                <h2 className="text-3xl font-bold dark:text-white">Quiz Completed!</h2>
                
                <div className="grid grid-cols-3 gap-4 text-left">
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-slate-700">
                        <p className="text-sm text-gray-500">Score</p>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{score}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-slate-700">
                        <p className="text-sm text-gray-500">Correct</p>
                        <p className="text-2xl font-bold text-green-600">{correct}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-yellow-50 dark:bg-slate-700">
                        <p className="text-sm text-gray-500">Tokens Earned</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{tokens_awarded} TKN</p>
                    </div>
                </div>

                <button onClick={() => onNavigate('wallet')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mb-3 hover:bg-indigo-700 transition-colors">
                    Check Wallet
                </button>
                <button onClick={() => onNavigate('learn', 'categories')} className="text-gray-500 text-sm hover:underline dark:text-gray-400">
                    Back to Courses
                </button>
            </div>
        );
    }

    // Current Question View
    const currentQuestion = questions[step];
    const optionChars = ['A', 'B', 'C', 'D'];

    return (
        <div className="animate-fade-in">
            <button 
                onClick={() => onNavigate('learn', 'detail', { id: lessonId })} 
                className="flex items-center text-gray-500 hover:text-gray-700 text-sm font-medium mb-6 dark:text-gray-400"
            >
                <ArrowLeft size={16} className="mr-1" /> Back to Lesson
            </button>

            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold dark:text-white">Question {step + 1}/{questions.length}</h3>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-8 dark:bg-slate-700">
                <div 
                    style={{width: `${((step + 1) / questions.length) * 100}%`}} 
                    className="h-2 bg-indigo-600 rounded-full transition-all duration-300" 
                />
            </div>
            
            <h2 className="text-xl font-bold mb-8 dark:text-white">{currentQuestion.question}</h2>
            
            <div className="space-y-3">
                {currentQuestion.options.map((opt, i) => {
                    const optionChar = optionChars[i];
                    const isSelected = selectedAnswer === optionChar;
                    return (
                        <button 
                            key={optionChar} 
                            onClick={() => handleAnswerSelect(optionChar)} 
                            className={`w-full text-left p-4 rounded-xl transition-all border-2 
                                ${isSelected 
                                    ? 'bg-indigo-50 border-indigo-500 ring-4 ring-indigo-100 dark:bg-indigo-900/50 dark:border-indigo-400' 
                                    : 'bg-white border-gray-200 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-indigo-500'}`
                            }
                        >
                            <span className={`font-bold mr-2 w-5 inline-block text-center ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {optionChar}.
                            </span> 
                            <span className='dark:text-white'>{opt}</span>
                        </button>
                    );
                })}
            </div>

            <button
                onClick={handleNext}
                disabled={selectedAnswer === null || isLoading}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-8"
            >
                {step < questions.length - 1 ? 'Next Question' : 'Submit Quiz'}
            </button>
        </div>
    );
};

// --- Main Learn Module ---
export default function LearnModule({ subView, activeData, onNavigate, onUpdateWallet }) {
    const [categories, setCategories] = useState([]);
    const [lessons, setLessons] = useState([]);

    // Fetch Categories once on mount
    useEffect(() => {
        if (!categories.length) {
            api.learn.getCategories().then(setCategories);
        }
    }, [categories.length]);

    // Fetch Lessons when switching to the 'list' subView
    useEffect(() => {
        if (subView === 'list' && activeData?.name) {
            api.learn.getLessons(activeData.name).then(setLessons);
        }
    }, [subView, activeData]);

    // 1. Categories View
    if (subView === 'categories') {
        return (
            <div className="space-y-6 animate-fade-in">
                <h2 className="text-3xl font-bold dark:text-white">Choose a Category</h2>
                <p className="text-gray-600 dark:text-gray-400">Select a course category to view available lessons and quizzes.</p>
                <div className="grid gap-4">
                    {categories.map(cat => (
                        <button 
                            key={cat.id} 
                            onClick={() => onNavigate('learn', 'list', cat)} 
                            className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-md flex items-center justify-between group hover:ring-2 hover:ring-indigo-500 transition-all border border-gray-100 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold ${cat.color} text-xl`}>
                                    {cat.name.substring(0, 1)}
                                </div>
                                <div className='text-left'>
                                    <h3 className="font-bold text-lg dark:text-white">{cat.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{cat.count} lessons available</p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-indigo-500 group-hover:translate-x-1 transition-transform" />
                        </button>
                    ))}
                    {categories.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No categories found.</p>}
                </div>
            </div>
        );
    }

    // 2. Lesson List View
    if (subView === 'list') {
        const category = activeData?.name || 'Lessons';
        return (
            <div className="space-y-6 animate-fade-in">
                <button onClick={() => onNavigate('learn', 'categories')} className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <ArrowLeft size={16} className="mr-1" /> Back to Categories
                </button>
                <h2 className="text-3xl font-bold dark:text-white">{category} Lessons</h2>
                <div className="space-y-3">
                    {lessons.map(lesson => (
                        <button 
                            key={lesson.id} 
                            // 🟢 FIX: Pass the full lesson object for LessonDetailView to use
                            onClick={() => onNavigate('learn', 'detail', lesson)} 
                            className="w-full text-left bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm flex items-center justify-between group hover:shadow-md transition-all border border-gray-100 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-4">
                                <PlayCircle size={28} className="text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                                <div>
                                    <h3 className="font-bold dark:text-white">{lesson.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                                        <Clock size={12} className="mr-1" /> {lesson.duration || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-500 transition-transform" />
                        </button>
                    ))}
                    {lessons.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No lessons found for this category.</p>}
                </div>
            </div>
        );
    }

    // 3. Lesson Detail View
    if (subView === 'detail') {
        return <LessonDetailView lesson={activeData} onNavigate={onNavigate} />;
    }

    // 4. Quiz View
    if (subView === 'quiz') {
        // activeData is now an object: { lessonId: UUID, lessonTitle: string }
        return <QuizView lessonData={activeData} onNavigate={onNavigate} onUpdateWallet={onUpdateWallet} />;
    }

    // Default Fallback
    return (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>Welcome to the learning module. Please select a category to begin.</p>
            <button 
                onClick={() => onNavigate('learn', 'categories')}
                className="mt-4 text-indigo-600 hover:underline"
            >
                View Categories
            </button>
        </div>
    );
}

//This updated file implements the crucial fix:
const safeContent = (lesson.content || '').replace(/\n/g, '<br/>');

