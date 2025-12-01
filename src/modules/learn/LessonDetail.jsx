import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner'; // Assuming this component exists

// Placeholder for a simple Loading Spinner if needed
const SimpleLoadingSpinner = () => (
    <div className="flex justify-center items-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        <p className="ml-4 text-gray-500 dark:text-gray-400">Loading Content...</p>
    </div>
);

const LessonDetail = ({ lessonId, onNavigate }) => {
    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLesson = async () => {
            setLoading(true);
            try {
                if (!lessonId) {
                    console.error("LessonDetail: No lesson ID provided.");
                    setLoading(false);
                    return;
                }
                
                // Fetch data using the corrected API call
                const data = await api.learn.getLessonDetail(lessonId); 
                setLesson(data);
            } catch (err) {
                console.error("Error fetching lesson:", err);
                setLesson(null); 
            } finally {
                setLoading(false);
            }
        };
        fetchLesson();
    }, [lessonId]);

    // --- RENDER CHECKS ---
    if (loading) {
        return <SimpleLoadingSpinner />;
    }

    if (!lesson) {
        return (
            <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl">
                <h2 className="text-xl font-semibold text-red-600">Lesson Not Found</h2>
                <p className="text-red-500 mt-2">The content for this lesson could not be loaded.</p>
                <button 
                    onClick={() => onNavigate('learn', 'categories')} 
                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition duration-150"
                >
                    Go Back to Categories
                </button>
            </div>
        );
    }
    
    const handleStartQuiz = () => {
        // Navigate to the quiz view, passing the lesson ID as payload
        onNavigate('learn', 'quiz', { lessonId: lesson.id }); 
    };
    
    // The previously crashing line is handled by the check: lesson.content || ""
    const lessonContent = lesson.content || "No content provided for this lesson.";
    
    // Check if video_url is a full YouTube URL or just an ID
    const getEmbedUrl = (url) => {
        if (!url) return null;
        if (url.includes('youtube.com/watch?v=')) {
            return url.split('v=')[1].split('&')[0];
        }
        return url; // Assume it's just the ID
    };

    const videoId = getEmbedUrl(lesson.video_url);

    return (
        <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-4 md:p-8">
            <button 
                onClick={() => onNavigate('learn', 'lessons', lesson.category)} 
                className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center mb-4 transition-colors"
            >
                &larr; Back to {lesson.category} Lessons
            </button>
            
            <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">{lesson.title}</h1>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-6">Category: {lesson.category}</p>

            {videoId && (
                <div className="mb-6 aspect-video rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-slate-700">
                    <iframe
                        title={`Video: ${lesson.title}`}
                        src={`https://www.youtube.com/embed/${videoId}`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                    ></iframe>
                </div>
            )}

            <div 
                className="prose dark:prose-invert prose-lg max-w-none mt-6 text-gray-700 dark:text-gray-300 leading-relaxed"
                // Using dangerouslySetInnerHTML assuming content is pre-sanitized or Markdown rendered
                dangerouslySetInnerHTML={{ __html: lessonContent }}
            />

            <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-slate-700 mt-8">
                <button
                    onClick={handleStartQuiz}
                    className="px-6 py-3 text-lg font-semibold text-white bg-green-500 rounded-full shadow-lg hover:bg-green-600 transform hover:scale-105 transition duration-200"
                >
                    Start Quiz
                </button>
            </div>
        </div>
    );
};

export default LessonDetail;

