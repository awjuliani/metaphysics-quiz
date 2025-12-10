// Shared Data Loading Module
// Loads dimensions and systems data, updates count displays in the UI

// Global data storage (accessible to other scripts)
let dimensions = [];
let systems = [];

/**
 * Load dimensions and systems data from JSON files
 * @returns {Promise<{dimensions: Array, systems: Array}>} The loaded data
 */
async function loadQuizData() {
    const [dimensionsData, systemsData] = await Promise.all([
        fetch('data/dimensions.json').then(response => response.json()),
        fetch('data/systems.json').then(response => response.json())
    ]);

    dimensions = dimensionsData;
    systems = systemsData;

    return { dimensions, systems };
}

/**
 * Update dimension and system count displays in the UI
 */
function updateCountDisplays() {
    document.querySelectorAll('.dimension-count').forEach(el => {
        el.textContent = dimensions.length;
    });

    document.querySelectorAll('.system-count').forEach(el => {
        el.textContent = systems.length;
    });
}

/**
 * Initialize data loading and update UI counts
 * Call this on pages that only need to display counts (not full quiz)
 * @param {Function} [onSuccess] - Optional callback after successful load
 * @param {Function} [onError] - Optional callback on error
 */
function initDataLoader(onSuccess, onError) {
    loadQuizData()
        .then(data => {
            updateCountDisplays();
            if (onSuccess) onSuccess(data);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            if (onError) onError(error);
        });
}
