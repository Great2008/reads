import { v4 as uuidv4 } from 'uuid';

// Vercel routes our /api path to the Python backend function
const API_URL = "/api"; 

const getAuthHeader = () => {
    const token = localStorage.getItem('access_token');
    // Using Bearer token authorization, always include Content-Type for JSON payloads
    const headers = { 'Content-Type': 'application/json' };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
};

// Helper function to process failed responses aggressively
const handleFailedResponse = async (res, action) => {
    let errorDetail = `Failed to ${action} (Status: ${res.status})`;
    
    try {
        // Try to parse JSON for detailed error message (FastAPI standard)
        const data = await res.json();
        errorDetail = data.detail || errorDetail;
    } catch (e) {
        // Fallback for Vercel 500 HTML page or other non-JSON errors
        const text = await res.text();
        // Fallback for non-JSON errors (e.g., Vercel's internal 500 HTML page)
        errorDetail = `${errorDetail}. Server response: ${text.substring(0, 100)}...`; 
    }
    
    // **IMPORTANT:** Console error ensures the failure is logged and caught by the Toast component.
    console.error(`${action} Failed: ${errorDetail}`); 
    throw new Error(errorDetail);
}

export const api = {
    // --- AUTHENTICATION & USER STATE ---
    auth: {
        login: async (email, password) => {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                // Explicitly define headers here as getAuthHeader() might not contain the token yet
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
                // Explicitly define headers here as getAuthHeader() might not contain the token yet
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
            
            const res = await fetch(`${API_URL}/user/profile`, { headers: getAuthHeader() });
            
            if (!res.ok) {
                // If token is expired/invalid, clear it and return null
                localStorage.removeItem('access_token');
                return null;
            }
            
            const data = await res.json();
            // Map the API data to the local user object used by App.jsx
            return {
                id: data.id,
                name: data.name,
                email: data.email,
                is_admin: data.is_admin,
                // Placeholder for Dashboard component
                avatar: `https://api.dicebear.com/8.x/initials/svg?seed=${data.name}`, 
                joined: data.created_at,
            };
        },
    },

    // --- USER PROFILE & STATS ---
    profile: {
        getStats: async () => {
            const res = await fetch(`${API_URL}/user/stats`, { headers: getAuthHeader() });
            if (!res.ok) return { lessons_completed: 0, quizzes_taken: 0 };

            const data = await res.json();
            return data;
        },
    },

    // --- LEARNING CONTENT ---
    learn: {
        getCategories: async () => {
            const res = await fetch(`${API_URL}/lessons/categories`, { headers: getAuthHeader() });
            if (!res.ok) return [];

            const data = await res.json();
            // Assign colors for the frontend display
            return data.map(cat => ({
                id: cat.category.toLowerCase(), 
                name: cat.category, 
                count: cat.count,
                color: cat.category === 'JAMB' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
            }));
        },
        getLessons: async (categoryName) => {
            const res = await fetch(`${API_URL}/lessons/category/${categoryName}`, { headers: getAuthHeader() });
            if (!res.ok) return [];
            
            const data = await res.json();
            return data.map(l => ({
                ...l,
                duration: '15 min' // Hardcoded duration for display
            }));
        },
        getLessonDetail: async (lessonId) => {
            const res = await fetch(`${API_URL}/lessons/${lessonId}`, { headers: getAuthHeader() });
            if (!res.ok) return null;
            return res.json();
        },
        getQuizQuestions: async (lessonId) => {
            const res = await fetch(`${API_URL}/lessons/${lessonId}/quiz`, { headers: getAuthHeader() });
            if (!res.ok) return [];
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

    // --- WALLET & REWARDS ---
    wallet: {
        getBalance: async () => {
            const res = await fetch(`${API_URL}/wallet/balance`, { headers: getAuthHeader() });
            if (!res.ok) return 0;
            const data = await res.json();
            return data.token_balance;
        },
        getHistory: async () => {
            const res = await fetch(`${API_URL}/rewards/history`, { headers: getAuthHeader() });
            if (!res.ok) return [];
            
            const data = await res.json();
            // Map API data to simple history format
            return data.map(item => ({
                id: item.id,
                title: `Completed: ${item.lesson.title}`,
                amount: item.tokens_earned,
                date: new Date(item.created_at).toLocaleDateString(),
                type: 'Reward'
            }));
        }
    },
    
    // --- ADMIN ENDPOINTS ---
    admin: {
        getUsers: async () => {
            const res = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeader() });
            if (!res.ok) {
                await handleFailedResponse(res, 'Fetch Users (Admin)');
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
        
        // 1. Delete Lesson
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

        // 2. Upload/Update Quiz (POST to /admin/quiz)
        uploadQuiz: async (lessonId, questions) => {
            const quizRequest = {
                lesson_id: lessonId,
                questions: questions
            };
            
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

        // 3. Delete Quiz (DELETE to /admin/quiz/{lessonId})
        deleteQuiz: async (lessonId) => {
            const res = await fetch(`${API_URL}/admin/quiz/${lessonId}`, {
                method: 'DELETE',
                headers: getAuthHeader(),
            });
            if (!res.ok) {
                await handleFailedResponse(res, `Delete Quiz for Lesson ID ${lessonId}`);
            }
            return {};
        }
    }
};