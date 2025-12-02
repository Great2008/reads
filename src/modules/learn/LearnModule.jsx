import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowLeft, PlayCircle, Clock, Award, CheckCircle, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

// ====================================================================
// --- 1. Lesson Detail View Component (Full Data Expected) ---
// ====================================================================

const LessonDetailView = ({ lesson, onNavigate }) => {
    
    const safeContent = (lesson.content || 'Content not available.').replace(/\n/g, '<br/>');

    const getEmbedUrl = (url) => {
        if (!url) return null;
        if (url.includes('youtube.com/watch?v=')) {
            const match = url.match(/[?&]v=([^&]+)/);
            return match ? `https://www.youtube.com/embed/${match[1]}` : url;
        }
        return url.startsWith('http') ? url : `https://www.youtube.com/embed/${url}`;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <button onClick={() => onNavigate('learn', 'list', { name: lesson.category })} className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 dark:text-indigo-400 dark:hover:text-indigo-300">
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
                    dangerouslySetInnerHTML={{ __html: safeContent }} 
                />
            </div>
            
            {lesson.video_url && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold mb-3 dark:text-white">Video Lecture</h3>
                    <iframe
                        className="w-full aspect-video rounded-xl shadow-lg border border-gray-200 dark:border-slate-700"
                        src={getEmbedUrl(lesson.video_url)}
                        title="Video Lecture"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            )}

            <button
                onClick={() => onNavigate('learn', 'quiz', { lessonId: lesson.id, lessonTitle: lesson.title, category: lesson.category })} 
                className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mt-6"
            >
                <Award size={20} /> Start Quiz to Earn $READS
            </button>
        </div>
    );
};

// ====================================================================
// --- 2. Quiz View Component ---
// ====================================================================

const QuizView = ({ lessonData, onNavigate, onUpdateWallet }) => { 
    const { lessonId, lessonTitle } = lessonData;
    
    const [questions, setQuestions] = useState([]);
    const [step, setStep] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [answers, setAnswers] = useState({}); 
    const [quizResult, setQuizResult] = useState(null); 
    const [isLoading, setIsLoading] = useState(false);
    // 🟢 NEW: State to track if quiz loading failed due to 500/404
    const [loadError, setLoadError] = useState(null); 

    useEffect(() => {
        setLoadError(null); // Reset error state on ID change
        if (lessonId) {
            api.learn.getQuizQuestions(lessonId)
                .then(data => {
                    if (data && data.length > 0) {
                        setQuestions(data);
                    } else {
                        // Handle case where API returns 200 but no questions
                        setLoadError("No quiz questions found for this lesson.");
                    }
                })
                .catch(e => {
                    console.error("Failed to load quiz questions:", e);
                    // 🟢 IMPROVED: Set specific error message for the user
                    setLoadError("Failed to load quiz. The server may be unavailable (Error 500)."); 
                });
        }
    }, [lessonId]);

    const handleAnswerSelect = (optionChar) => {
        setSelectedAnswer(optionChar);
    };
    
    const handleNext = async () => {
        if (selectedAnswer === null) return;

        const currentQuestion = questions[step];
        
        const newAnswers = { 
            ...answers, 
            [currentQuestion.id]: selectedAnswer 
        };
        setAnswers(newAnswers);
        setSelectedAnswer(null);

        if (step < questions.length - 1) {
            setStep(step + 1);
        } else {
            setIsLoading(true);
            try {
                const submissionArray = Object.entries(newAnswers).map(([q_id, selected]) => ({
                    question_id: q_id,
                    selected: selected
                }));

                const result = await api.learn.submitQuiz(lessonId, submissionArray);
                setQuizResult(result);
                onUpdateWallet(result.tokens_awarded); 
            } catch (e) {
                console.error("Quiz submission failed:", e);
                // Use a temporary state message instead of alert()
                setLoadError("Submission failed. Please check your connection and try again.");
                setIsLoading(false);
            } 
        }
    };
    
    if (loadError) {
        return (
            <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl shadow-lg dark:bg-red-900/20 dark:border-red-800 animate-fade-in">
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Quiz Load Error</h2>
                <p className="text-red-500 dark:text-red-300 mt-2">{loadError}</p>
                <button 
                    onClick={() => onNavigate('learn', 'detail', lessonId)} 
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition duration-150"
                >
                    Back to Lesson
                </button>
            </div>
        );
    }

    if (isLoading) {
        return <div className="p-8 text-center dark:text-white">Submitting Quiz and Calculating Rewards...</div>;
    }

    if (!questions.length && !quizResult) {
        return <div className="p-8 text-center dark:text-white">Loading quiz questions for "{lessonTitle}"...</div>;
    }
    
    // Quiz Result View (Remains unchanged)
    if (quizResult) {
        const { score, correct, wrong, tokens_awarded } = quizResult;
        return (
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl space-y-6 animate-fade-in border border-gray-100 dark:border-slate-700">
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

    // Current Question View (Remains unchanged)
    const currentQuestion = questions[step];
    const optionChars = ['A', 'B', 'C', 'D'];

    return (
        <div className="animate-fade-in">
            <button 
                onClick={() => onNavigate('learn', 'detail', lessonId)} 
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

// ====================================================================
// --- 3. Lesson Data Loader (Wrapper Component) ---
// ====================================================================

const LessonDataLoader = ({ lessonId, onNavigate }) => {
    const [lessonData, setLessonData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const fetchDetail = async () => {
            if (!lessonId) {
                setLoading(false);
                return;
            }
            try {
                const data = await api.learn.getLessonDetail(lessonId); 
                setLessonData(data);
            } catch (error) {
                console.error("Error fetching lesson detail:", error);
                setLessonData(null); 
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [lessonId]);

    if (loading) {
        return <div className="p-8 text-center dark:text-white">Fetching lesson details...</div>;
    }

    if (!lessonData) {
        return (
            <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-800">
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error Loading Lesson</h2>
                <p className="text-red-500 dark:text-red-300 mt-2">The lesson details could not be found or loaded.</p>
                <button 
                    onClick={() => onNavigate('learn', 'categories')} 
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition duration-150"
                >
                    Go Back to Categories
                </button>
            </div>
        );
    }
    
    return <LessonDetailView lesson={lessonData} onNavigate={onNavigate} />;
};


// ====================================================================
// --- 4. Main Learn Module ---
// ====================================================================

// 🟢 NEW PROP: Added isAdmin to enable admin features
export default function LearnModule({ subView, activeData, onNavigate, onUpdateWallet, isAdmin = false }) {
    const [categories, setCategories] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch Categories once on mount
    useEffect(() => {
        if (!categories.length) {
            api.learn.getCategories().then(setCategories);
        }
    }, [categories.length]);

    // Fetch Lessons when switching to the 'list' subView
    const fetchLessons = (categoryName) => {
        api.learn.getLessons(categoryName).then(setLessons).catch(e => {
            console.error("Failed to load lessons:", e);
            setLessons([]); // Clear lessons on failure
        });
    }

    useEffect(() => {
        if (subView === 'list' && activeData?.name) {
            fetchLessons(activeData.name);
        }
    }, [subView, activeData]);

    // 🟢 NEW: Admin Delete Handler
    const handleDeleteLesson = async (lessonId, lessonTitle, categoryName) => {
        if (!isAdmin) return;
        
        // Custom confirmation prompt instead of alert/confirm
        if (!window.confirm(`Are you sure you want to permanently delete the lesson: "${lessonTitle}"?`)) {
            return;
        }

        setIsDeleting(true);
        try {
            await api.admin.deleteLesson(lessonId);
            // 1. Show success message (log is fine for now)
            console.log(`Lesson ${lessonId} deleted successfully.`);
            // 2. Refresh the lesson list
            fetchLessons(categoryName);
        } catch (error) {
            console.error("Failed to delete lesson:", error);
            alert("Failed to delete lesson. Check API permissions."); // Fallback message
        } finally {
            setIsDeleting(false);
        }
    };


    // 1. Categories View (Unchanged)
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

    // 2. Lesson List View (Updated for Admin Delete)
    if (subView === 'list') {
        const category = activeData?.name || 'Lessons';
        
        if (isDeleting) {
            return <div className="p-8 text-center dark:text-white">Deleting lesson... Please wait.</div>;
        }

        return (
            <div className="space-y-6 animate-fade-in">
                <button onClick={() => onNavigate('learn', 'categories')} className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <ArrowLeft size={16} className="mr-1" /> Back to Categories
                </button>
                <h2 className="text-3xl font-bold dark:text-white">{category} Lessons {isAdmin && <span className="text-sm text-red-500">(Admin Mode)</span>}</h2>
                <div className="space-y-3">
                    {lessons.map(lesson => (
                        <div 
                            key={lesson.id} 
                            className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm flex items-center justify-between group transition-all border border-gray-100 dark:border-slate-700"
                        >
                            <button
                                // Content area button
                                onClick={() => onNavigate('learn', 'detail', lesson.id)}
                                className="flex items-center gap-4 flex-grow p-2 text-left"
                            >
                                <PlayCircle size={28} className="text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                                <div>
                                    <h3 className="font-bold dark:text-white">{lesson.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                                        <Clock size={12} className="mr-1" /> {lesson.duration || 'N/A'}
                                    </p>
                                </div>
                            </button>

                            <div className="flex items-center">
                                {/* 🟢 Admin Delete Button */}
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDeleteLesson(lesson.id, lesson.title, lesson.category)}
                                        className="p-2 ml-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                        title={`Delete ${lesson.title}`}
                                        disabled={isDeleting}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <ChevronRight size={20} className="text-gray-400 transition-transform ml-2" />
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No lessons found for this category.</p>}
                </div>
            </div>
        );
    }

    // 3. Lesson Detail View
    if (subView === 'detail') {
        // activeData is now expected to be just the lesson ID string
        return <LessonDataLoader lessonId={activeData} onNavigate={onNavigate} />;
    }

    // 4. Quiz View
    if (subView === 'quiz') {
        // activeData is an object: { lessonId, lessonTitle, category }
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

