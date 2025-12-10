// Shared Utility Functions Module
// This module provides common utility functions used across multiple pages

/**
 * Generate a URL-safe slug from a system name
 * @param {string} systemName - The system name
 * @returns {string} URL-safe slug
 */
function getSystemSlug(systemName) {
    return systemName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Format a count with abbreviations (e.g., 1000 -> 1k, 1000000 -> 1M)
 * @param {number} count - The count to format
 * @returns {string} Formatted count
 */
function formatCount(count) {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
}

/**
 * Generate HTML for a popularity badge
 * @param {string} systemName - The system name
 * @param {Object} stats - Stats object with system counts
 * @param {number} totalCount - Total count of all quizzes
 * @returns {string} HTML string for the badge, or empty string if no data
 */
function getPopularityHtml(systemName, stats, totalCount) {
    const count = stats[systemName] || 0;
    const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
    const formattedCount = formatCount(count);

    return totalCount > 0
        ? `<div class="popularity-badge" title="${count} matches out of ${totalCount} total quizzes">
             <span class="pop-icon">👥</span> ${percentage}% <span class="pop-divider">|</span> ${formattedCount}
           </div>`
        : '';
}

/**
 * Get a description of similarity based on percentage
 * @param {number} percentage - Similarity percentage (0-100)
 * @returns {string} Human-readable description
 */
function getSimilarityDescription(percentage) {
    if (percentage >= 90) return "Nearly identical worldviews";
    if (percentage >= 75) return "Very similar perspectives";
    if (percentage >= 60) return "More alike than different";
    if (percentage >= 40) return "Some common ground";
    if (percentage >= 25) return "Quite different outlooks";
    return "Fundamentally different views";
}
