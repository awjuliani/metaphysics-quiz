// Results Store Module
// Persists quiz results to localStorage for the dashboard

const RESULTS_STORAGE_KEY = 'philosophy_quiz_results';

/**
 * Get all stored results
 * @returns {Object} { metaphysics: {...} | null, ethics: {...} | null, narrative: {...} | null }
 */
function getStoredResults() {
    try {
        const stored = localStorage.getItem(RESULTS_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error reading stored results:', e);
    }
    return {
        metaphysics: null,
        ethics: null,
        narrative: null
    };
}

/**
 * Save a quiz result
 * @param {string} quizType - 'metaphysics', 'ethics', or 'narrative'
 * @param {Object} result - The result object containing system, matchPercentage, answers, breakdown
 */
function saveQuizResult(quizType, result) {
    try {
        const allResults = getStoredResults();
        allResults[quizType] = {
            systemName: result.system.name,
            systemDescription: result.system.description,
            matchPercentage: result.matchPercentage,
            answers: result.answers || {},
            breakdown: result.breakdown || [],
            timestamp: Date.now()
        };
        localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(allResults));
    } catch (e) {
        console.error('Error saving result:', e);
    }
}

/**
 * Clear a specific quiz result
 * @param {string} quizType - 'metaphysics', 'ethics', or 'narrative'
 */
function clearQuizResult(quizType) {
    try {
        const allResults = getStoredResults();
        allResults[quizType] = null;
        localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(allResults));
    } catch (e) {
        console.error('Error clearing result:', e);
    }
}

/**
 * Clear all quiz results
 */
function clearAllResults() {
    try {
        localStorage.removeItem(RESULTS_STORAGE_KEY);
    } catch (e) {
        console.error('Error clearing all results:', e);
    }
}

/**
 * Check if user has completed a specific quiz
 * @param {string} quizType - 'metaphysics', 'ethics', or 'narrative'
 * @returns {boolean}
 */
function hasCompletedQuiz(quizType) {
    const results = getStoredResults();
    return results[quizType] !== null;
}

/**
 * Get count of completed quizzes
 * @returns {number}
 */
function getCompletedQuizCount() {
    const results = getStoredResults();
    let count = 0;
    if (results.metaphysics) count++;
    if (results.ethics) count++;
    if (results.narrative) count++;
    return count;
}

/**
 * Format a timestamp as relative time
 * @param {number} timestamp
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    return new Date(timestamp).toLocaleDateString();
}
