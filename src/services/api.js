import { v4 as uuidv4 } from 'uuid';

// Vercel routes our /api path to the Python backend function
const API_URL = "/api"; 

// FIX: Implement the getAuthHeader function
const getAuthHeader = () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
        // If no token, return headers that will fail authentication on the backend
        return { 'Content-Type': 'application/json' };
    }
    return { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

// Helper function to process failed responses aggressively
const handleFailedResponse = async (res, action) => {
    let errorDetail = `Failed to ${action} (Status: ${res.status})`;
    
    // 💥 CRITICAL FIX FOR 409: Throw a specific error for the frontend component to handle.
    if (res.status === 409) {
        throw new Error('QuizAlreadyCompleted');
    }

    try {
        const data = await res.json();
        errorDetail = data.detail || errorDetail;
    } catch (e) {
        const text = await res.text();
        errorDetail = `${errorDetail}. Server response: ${text.substring(0, 100)}...`; 
    }
    
    console.error(`${action} Failed: ${errorDetail}`); 
    throw new Error(errorDetail);
}

export const api = {
    // --- AUTH ---
    auth: {
        login: async (email, password) => {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (!res.ok) {
                await handleFailedResponse(res, 'Login');
            }
            
            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);
            return data; 
        },
        signup: async (name, email, password) => {
            const res = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            
            if (!res.ok) {
                await handleFailedResponse(res, 'Signup');
            }
            
            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);
            return data;
        },
        me: async () => {
            const token = localStorage.getItem('access_token');
            if (!token) return null;
            
            // FIX: Use getAuthHeader to ensure consistency
            const res = await fetch(`${API_URL}/user/profile`, { headers: getAuthHeader() });
            
            if (!res.ok) {
                localStorage.removeItem('access_token');
                return null;
            }
            
            const data = await res.json();
            return {
                id: data.id,
                name: data.name,
                email: data.email,
                is_admin: data.is_admin,
                avatar: `https://api.dicebear.com/8.x/initials/svg?seed=${data.name}`, 
                joined: data.created_at,
            };
        },
    },

    // --- PROFILE ---
    profile: {
        getStats: async () => {
            const res = await fetch(`${API_URL}/user/stats`, { headers: getAuthHeader() });
            // FIX: Use handleFailedResponse for proper error handling on not res.ok
            if (!res.ok) {
                // If it fails, log the error but return default data
                try {
                    await handleFailedResponse(res, 'Fetch User Stats');
                } catch (e) {
                    console.error("Non-fatal error fetching user stats:", e.message);
                }
                return { lessons_completed: 0, quizzes_taken: 0 };
            }

            const data = await res.json();
            return data;
        },
    },

    // --- LEARN ---
    learn: {
        getCategories: async () => {
            const res = await fetch(`${API_URL}/lessons/categories`, { headers: getAuthHeader() });
            // FIX: Use handleFailedResponse for proper error handling
            if (!res.ok) {
                try {
                    await handleFailedResponse(res, 'Fetch Categories');
                } catch (e) {
                    console.error("Non-fatal error fetching categories:", e.message);
                }
                return [];
            }

            const data = await res.json();
            return data.map(cat => ({
                id: cat.category.toLowerCase(), 
                name: cat.category, 
                count: cat.count,
                color: cat.category === 'JAMB' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
            }));
        },
        getLessons: async (categoryName) => {
            const res = await fetch(`${API_URL}/lessons/category/${categoryName}`, { headers: getAuthHeader() });
            // FIX: Use handleFailedResponse for proper error handling
            if (!res.ok) {
                try {
                    await handleFailedResponse(res, 'Fetch Lessons');
                } catch (e) {
                    console.error("Non-fatal error fetching lessons:", e.message);
                }
                return [];
            }
            
            const data = await res.json();
            return data.map(l => ({
                ...l,
                duration: '15 min'
            }));
        },
        getLessonDetail: async (lessonId) => {
            const res = await fetch(`${API_URL}/lessons/${lessonId}`, { headers: getAuthHeader() });
            // FIX: Use handleFailedResponse for proper error handling
            if (!res.ok) {
                await handleFailedResponse(res, 'Fetch Lesson Detail');
            }
            return res.json();
        },
        getQuizQuestions: async (lessonId) => {
            const res = await fetch(`${API_URL}/lessons/${lessonId}/quiz`, { headers: getAuthHeader() });
            
            // 💥 THE CRITICAL FIX: Use the aggressive handler to catch 409
            if (!res.ok) {
                // handleFailedResponse now throws 'QuizAlreadyCompleted' for 409, 
                // or a generic error for others (404, 500 etc.)
                await handleFailedResponse(res, 'Fetch Quiz Questions'); 
            }
            
            // If res.ok (status 200), return the data
            return res.json();
        },
        submitQuiz: async (lessonId, answers) => {
            const res = await fetch(`${API_URL}/quiz/submit`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ lesson_id: lessonId, answers })
            });

            if (!res.ok) {
                await handleFailedResponse(res, 'Submit Quiz');
            }

            return res.json();
        }
    },

    // --- WALLET ---
    wallet: {
        getBalance: async () => {
            const res = await fetch(`${API_URL}/wallet/balance`, { headers: getAuthHeader() });
            // FIX: Use handleFailedResponse for proper error handling
            if (!res.ok) {
                try {
                    await handleFailedResponse(res, 'Fetch Wallet Balance');
                } catch (e) {
                    console.error("Non-fatal error fetching balance:", e.message);
                }
                return 0;
            }
            const data = await res.json();
            return data.token_balance;
        },
        getHistory: async () => {
            // 1. Correct route to match the backend change
            const res = await fetch(`${API_URL}/wallet/history`, { headers: getAuthHeader() });
            if (!res.ok) {
                // FIX: Use handleFailedResponse for proper error handling
                try {
                    await handleFailedResponse(res, 'Fetch Wallet History');
                } catch (e) {
                    console.error("Non-fatal error fetching wallet history:", e.message);
                }
                return [];
            }
            
            const data = await res.json();
            return data;
        }
    },
    
    // --- ADMIN ---
    admin: {

        getUsers: async () => {
            const res = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeader() });
            if (!res.ok) {
                await handleFailedResponse(res, 'Fetch Users (Admin)');
            }
            return res.json();
        },

        // ✅ NEW: REQUIRED BY UserManagement.jsx
        getAllUsers: async () => {
            const res = await fetch(`${API_URL}/admin/users`, {
                headers: getAuthHeader()
            });
            if (!res.ok) {
                await handleFailedResponse(res, 'Fetch All Users');
            }
            return res.json();
        },

        promoteUser: async (userId, isAdmin) => {
            const res = await fetch(`${API_URL}/admin/users/${userId}/promote?is_admin=${isAdmin}`, {
                method: 'PUT',
                headers: getAuthHeader(),
            });
            if (!res.ok) {
                await handleFailedResponse(res, isAdmin ? 'Promote User' : 'Demote User');
            }
            return res.json();
        },

        createLesson: async (lessonData) => {
            const res = await fetch(`${API_URL}/admin/lessons`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify(lessonData)
            });
            if (!res.ok) {
                await handleFailedResponse(res, 'Create Lesson');
            }
            return res.json();
        },
        
        deleteLesson: async (lessonId) => {
            const res = await fetch(`${API_URL}/admin/lessons/${lessonId}`, {
                method: 'DELETE',
                headers: getAuthHeader(),
            });
            if (!res.ok) {
                await handleFailedResponse(res, `Delete Lesson ID ${lessonId}`);
            }
            return {};
        },

        uploadQuiz: async (lessonId, questions) => {
            const quizRequest = { lesson_id: lessonId, questions };
            
            const res = await fetch(`${API_URL}/admin/quiz`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify(quizRequest)
            });
            if (!res.ok) {
                await handleFailedResponse(res, 'Upload Quiz Questions');
            }
            return res.json();
        },

        deleteQuiz: async (lessonId) => {
            const res = await fetch(`${API_URL}/admin/quiz/${lessonId}`, {
                method: 'DELETE',
                headers: getAuthHeader(),
            });
            if (!res.ok) {
                await handleFailedResponse(res, `Delete Quiz for Lesson ID ${lessonId}`);
            }
            return {};
        },

        // ✅ NEW: REQUIRED BY LessonQuizManager.jsx
        getAllLessons: async () => {
            const res = await fetch(`${API_URL}/admin/lessons`, {
                headers: getAuthHeader()
            });
            if (!res.ok) {
                await handleFailedResponse(res, 'Fetch All Lessons');
            }
            return res.json();
        },

        // ✅ NEW: REQUIRED BY QuizCreationForm.jsx
        createQuiz: async (quizData) => {
            const res = await fetch(`${API_URL}/admin/quiz`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify(quizData)
            });
            if (!res.ok) {
                await handleFailedResponse(res, 'Create Quiz');
            }
            return res.json();
        },
    }
};
