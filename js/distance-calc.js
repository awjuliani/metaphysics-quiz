// Shared Distance Calculation Module
// This module provides tetralemma-based distance calculations for comparing systems

// Tetralemma encoding vectors: maps option index to 2D representation
// Index 0: [1, 0], Index 1: [0, 1], Index 2: [1, 1], Index 3: [0, 0]
const TETRALEMMA_VECTORS = [[1, 0], [0, 1], [1, 1], [0, 0]];

// Maximum possible Manhattan distance (8 dimensions * 2 max distance per dimension)
const MAX_MANHATTAN_DISTANCE = 16;

/**
 * Get the index of an option value within a dimension
 * @param {string} dimensionId - The dimension ID
 * @param {string} value - The option value to find
 * @param {Array} dimensionsData - The dimensions data array
 * @returns {number} The index of the option, or -1 if not found
 */
function getOptionIndex(dimensionId, value, dimensionsData) {
    const dim = dimensionsData.find(d => d.id === dimensionId);
    if (!dim) return -1;
    return dim.options.findIndex(o => o.value === value);
}

/**
 * Calculate the Manhattan distance between two option values for a dimension
 * @param {string} val1 - First option value
 * @param {string} val2 - Second option value
 * @param {string} dimensionId - The dimension ID
 * @param {Array} dimensionsData - The dimensions data array
 * @returns {number} The Manhattan distance (0, 1, or 2)
 */
function getDimensionDistance(val1, val2, dimensionId, dimensionsData) {
    const idx1 = getOptionIndex(dimensionId, val1, dimensionsData);
    const idx2 = getOptionIndex(dimensionId, val2, dimensionsData);

    if (idx1 < 0 || idx2 < 0) return 0;

    const vec1 = TETRALEMMA_VECTORS[idx1];
    const vec2 = TETRALEMMA_VECTORS[idx2];

    // Manhattan distance
    return Math.abs(vec1[0] - vec2[0]) + Math.abs(vec1[1] - vec2[1]);
}

/**
 * Calculate the total Manhattan distance between two systems across all dimensions
 * @param {Object} sys1 - First system object with profile property
 * @param {Object} sys2 - Second system object with profile property
 * @param {Array} dimensionsData - The dimensions data array
 * @returns {number} The total Manhattan distance
 */
function calculateTotalDistance(sys1, sys2, dimensionsData) {
    let totalManhattanDistance = 0;
    const profileKeys = Object.keys(sys1.profile);

    profileKeys.forEach(key => {
        totalManhattanDistance += getDimensionDistance(
            sys1.profile[key],
            sys2.profile[key],
            key,
            dimensionsData
        );
    });

    return totalManhattanDistance;
}

/**
 * Categorize a distance value into 'same', 'related', or 'opposite'
 * @param {number} distance - The Manhattan distance (0, 1, or 2)
 * @returns {string} The distance category
 */
function getDistanceCategory(distance) {
    if (distance === 0) return 'same';
    if (distance === 2) return 'opposite';
    return 'related';
}

/**
 * Calculate similarity percentage from total distance
 * @param {number} totalDistance - The total Manhattan distance
 * @returns {number} Similarity percentage (0-100)
 */
function calculateSimilarityPercentage(totalDistance) {
    return Math.round((1 - totalDistance / MAX_MANHATTAN_DISTANCE) * 100);
}
