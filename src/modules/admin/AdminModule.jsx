import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Edit3, Award, Zap, BookOpen, Clock, XCircle, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

// Simple Alert/Toast component for feedback
const Toast = ({ message, type, onClose }) => {
    const color = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-indigo-500',
    }[type] || 'bg-gray-500';

    if (!message) return null;

    return (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-xl text-white ${color} flex items-center gap-3 z-50`}>
            {type === 'success' && <CheckCircle size={20} />}
            {type === 'error' && <XCircle size={20} />}
            {message}
            <button onClick={onClose} className="ml-4 font-bold">X</button>
        </div>
    );
};

// ====================================================================
// --- 1. Quiz Creation Form Component ---
// ====================================================================

const QuizCreationForm = ({ lessonId, lessonTitle, onComplete }) => {
    const initialQuestion = {
        question: '',
        options: ['', '', '', ''],
        correct_answer: '', // 'A', 'B', 'C', or 'D'
    };

    const [questions, setQuestions] = useState([initialQuestion]);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState({ message: '', type: 'info' });

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const addQuestion = () => {
        setQuestions([...questions, initialQuestion]);
    };

    const removeQuestion = (index) => {
        if (questions.length > 1) {
            setQuestions(questions.filter((_, i) => i !== index));
        }
    };
    
    const handleDeleteQuiz = async () => {
        if (!lessonId) return;

        if (!window.confirm(`Are you sure you want to delete the existing quiz for "${lessonTitle}"? This cannot be undone.`)) {
            return;
        }

        setIsLoading(true);
        try {
            await api.admin.deleteQuiz(lessonId);
            setToast({ message: `Quiz for "${lessonTitle}" deleted successfully.`, type: 'success' });
            onComplete(); // Navigate or refresh
        } catch (error) {
            console.error("Failed to delete quiz:", error);
            setToast({ message: 'Failed to delete quiz. Check server logs.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setToast({ message: '', type: 'info' });

        // Basic validation
        const isValid = questions.every(q => 
            q.question && q.options.every(opt => opt) && ['A', 'B', 'C', 'D'].includes(q.correct_answer)
        );

        if (!isValid) {
            setIsLoading(false);
            setToast({ message: 'Please complete all fields (question, 4 options, and correct answer) for every question.', type: 'error' });
            return;
        }

        try {
            // Transform data structure for the API call
            const quizData = {
                lesson_id: lessonId,
                questions: questions.map((q, qIndex) => ({
                    question: q.question,
                    options: q.options,
                    correct_answer: q.correct_answer,
                }))
            };

            await api.admin.uploadQuiz(lessonId, quizData.questions);
            setToast({ message: `Quiz uploaded successfully for "${lessonTitle}"!`, type: 'success' });
            setQuestions([initialQuestion]); // Reset form
            onComplete();

        } catch (error) {
            console.error("Quiz upload failed:", error);
            setToast({ message: 'Failed to upload quiz. Internal server error.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const optionChars = ['A', 'B', 'C', 'D'];

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Manage Quiz: {lessonTitle}</h3>
            <p className="text-gray-600 dark:text-gray-400">Define the questions, options, and the single correct letter (A, B, C, or D).</p>
            
            <button
                onClick={handleDeleteQuiz}
                disabled={isLoading}
                className="w-full py-2 px-4 border border-red-500 text-red-500 rounded-xl hover:bg-red-50 transition-colors dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                <Trash2 size={18} /> Delete Existing Quiz
            </button>

            <form onSubmit={handleSubmit} className="space-y-8">
                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="text-xl font-semibold dark:text-white">Question {qIndex + 1}</h4>
                            {questions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(qIndex)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {/* Question Text */}
                            <input
                                type="text"
                                placeholder="Enter question text here..."
                                value={q.question}
                                onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />

                            {/* Options */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                {q.options.map((opt, oIndex) => (
                                    <div key={oIndex} className="flex items-center gap-2">
                                        <span className="font-bold w-4 text-gray-600 dark:text-gray-300">{optionChars[oIndex]}.</span>
                                        <input
                                            type="text"
                                            placeholder={`Option ${optionChars[oIndex]}`}
                                            value={opt}
                                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                            className="flex-grow p-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            required
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Correct Answer Selector */}
                            <div className="mt-4 flex items-center gap-3 bg-indigo-50 dark:bg-slate-700 p-3 rounded-lg">
                                <label className="font-medium text-gray-700 dark:text-gray-300">Correct Answer:</label>
                                <select
                                    value={q.correct_answer}
                                    onChange={(e) => handleQuestionChange(qIndex, 'correct_answer', e.target.value)}
                                    className="p-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    required
                                >
                                    <option value="" disabled>Select</option>
                                    {optionChars.map(char => (
                                        <option key={char} value={char}>{char}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                >
                    <PlusCircle size={20} /> Add Another Question
                </button>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
                >
                    {isLoading ? 'Uploading Quiz...' : <><Zap size={20} /> Upload/Update Quiz</>}
                </button>
            </form>
            <Toast {...toast} onClose={() => setToast({ message: '', type: 'info' })} />
        </div>
    );
};


// ====================================================================
// --- 2. Lesson List View (Simplified for Admin) ---
// ====================================================================

const AdminLessonList = ({ onSelectLesson, onNavigate }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch Categories
    useEffect(() => {
        api.learn.getCategories()
            .then(data => {
                setCategories(data);
                if (data.length > 0) {
                    setSelectedCategory(data[0].name);
                }
            })
            .catch(e => console.error("Failed to load categories:", e))
            .finally(() => setIsLoading(false));
    }, []);

    // 2. Fetch Lessons based on selectedCategory
    useEffect(() => {
        if (selectedCategory) {
            setIsLoading(true);
            api.learn.getLessons(selectedCategory)
                .then(setLessons)
                .catch(e => {
                    console.error("Failed to load lessons:", e);
                    setLessons([]);
                })
                .finally(() => setIsLoading(false));
        }
    }, [selectedCategory]);
    
    // 3. Admin Delete Handler (needs to be implemented here for list refresh)
    const handleDeleteLesson = async (lessonId, lessonTitle) => {
        if (!window.confirm(`Are you sure you want to permanently delete the lesson: "${lessonTitle}"? This will also delete the associated quiz.`)) {
            return;
        }

        setIsLoading(true);
        try {
            await api.admin.deleteLesson(lessonId);
            // Refresh the lesson list by re-fetching the current category
            await api.learn.getLessons(selectedCategory).then(setLessons);
        } catch (error) {
            console.error("Failed to delete lesson:", error);
            alert("Failed to delete lesson. Check API permissions or server status.");
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading && !selectedCategory) {
        return <div className="p-8 text-center dark:text-white">Loading Categories...</div>;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold dark:text-white flex items-center gap-2"><Zap size={28} className="text-red-500" /> Admin Lesson Management</h2>
            <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            selectedCategory === cat.name
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        {cat.name} ({cat.count})
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
                <h3 className="text-xl font-semibold mb-4 dark:text-white">Lessons in: {selectedCategory || '...'}</h3>
                <div className="space-y-3">
                    {isLoading ? (
                         <div className="text-center text-gray-500 dark:text-gray-400">Loading lessons...</div>
                    ) : lessons.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">No lessons found. Create one?</p>
                    ) : (
                        lessons.map(lesson => (
                            <div
                                key={lesson.id}
                                className="flex items-center justify-between p-3 border border-gray-200 rounded-xl dark:border-slate-700 transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-center gap-3">
                                    <BookOpen size={20} className="text-indigo-500" />
                                    <div className='text-left'>
                                        <p className="font-medium dark:text-white">{lesson.title}</p>
                                        <p className="text-xs text-gray-500 flex items-center dark:text-gray-400"><Clock size={12} className="mr-1" /> {lesson.duration || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onSelectLesson(lesson.id, lesson.title, 'quiz')}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full dark:hover:bg-blue-900/50 transition-colors"
                                        title="Manage Quiz"
                                        disabled={isLoading}
                                    >
                                        <Award size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-full dark:hover:bg-red-900/50 transition-colors"
                                        title={`Delete ${lesson.title}`}
                                        disabled={isLoading}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};


// ====================================================================
// --- 3. Main Admin Module ---
// ====================================================================

export default function AdminModule({ onNavigate }) {
    const [view, setView] = useState('list'); // 'list', 'create_lesson', 'manage_quiz'
    const [activeLesson, setActiveLesson] = useState(null); // { id, title }

    const handleSelectLesson = (id, title, targetView) => {
        setActiveLesson({ id, title });
        setView(targetView);
    };

    const handleBackToList = () => {
        setActiveLesson(null);
        setView('list');
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Administrative Panel</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Manage all lessons, quizzes, and associated content rewards.</p>
            </header>

            {view !== 'list' && (
                <button
                    onClick={handleBackToList}
                    className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-6 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                    <ArrowLeft size={16} className="mr-1" /> Back to Lesson List
                </button>
            )}

            <div className="mt-8">
                {view === 'list' && (
                    <AdminLessonList 
                        onSelectLesson={handleSelectLesson} 
                        onNavigate={onNavigate} 
                    />
                )}
                
                {/* 🟢 NEW: Quiz Management View */}
                {view === 'manage_quiz' && activeLesson && (
                    <QuizCreationForm 
                        lessonId={activeLesson.id} 
                        lessonTitle={activeLesson.title} 
                        onComplete={handleBackToList} 
                    />
                )}

                {/* NOTE: You would typically have a separate component for creating a NEW lesson here */}
                {/* {view === 'create_lesson' && <LessonCreationForm onComplete={handleBackToList} />} */}
                
            </div>
        </div>
    );
}

