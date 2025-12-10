// Shared Theme Management Module
// This module handles dark/light mode initialization and toggling across all pages

/**
 * Initialize the theme based on localStorage or system preference
 * Call this on page load
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
    }
}

/**
 * Toggle between light and dark mode
 * Call this on theme toggle button click
 */
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    document.documentElement.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/**
 * Setup theme toggle button listener
 * @param {string} buttonId - The ID of the theme toggle button (default: 'theme-toggle')
 */
function setupThemeToggle(buttonId = 'theme-toggle') {
    const themeToggleBtn = document.getElementById(buttonId);
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}

// Auto-initialize theme on script load
initTheme();
