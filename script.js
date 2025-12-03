// Data will be loaded from JSON files
let dimensions = [];
let systems = [];

// Tetralemma encoding vectors: maps option index to 2D representation
// Index 0: [1, 0], Index 1: [0, 1], Index 2: [1, 1], Index 3: [0, 0]
const TETRALEMMA_VECTORS = [[1, 0], [0, 1], [1, 1], [0, 0]];
const MAX_MANHATTAN_DISTANCE = 16; // 8 dimensions * 2 max distance per dimension

// DOM Elements
const views = {
    intro: document.getElementById('intro-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view')
};

const startBtn = document.getElementById('start-btn');

const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const showTopBtn = document.getElementById('show-top-btn');
const showRunnerUpBtn = document.getElementById('show-runner-up-btn');
const showWorstBtn = document.getElementById('show-worst-btn');
const resultToggleContainer = document.getElementById('result-toggle-container');
const progressBar = document.getElementById('progress-bar');
const dimensionLabel = document.getElementById('dimension-label');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const themeToggleBtn = document.getElementById('theme-toggle');
const expandedModeToggle = document.getElementById('expanded-mode-toggle');

// State
let currentQuestionIndex = 0;
let userAnswers = {};
let isExpandedMode = false;

// Load data
Promise.all([
    fetch('dimensions.json').then(response => response.json()),
    fetch('systems.json').then(response => response.json())
])
    .then(([dimensionsData, systemsData]) => {
        dimensions = dimensionsData;
        systems = systemsData;

        // Update dimension counts in UI
        document.querySelectorAll('.dimension-count').forEach(el => {
            el.textContent = dimensions.length;
        });

        if (startBtn && startBtn.tagName === 'BUTTON') {
            startBtn.disabled = false;
            startBtn.textContent = "Start the Quiz";
        }

        // If we are on the quiz page (no intro view, but quiz view exists), start immediately
        if (!views.intro && views.quiz) {
            startQuiz();
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
        if (startBtn && startBtn.tagName === 'BUTTON') {
            startBtn.textContent = "Error loading data. Please run a local server.";
            startBtn.disabled = true;
        }
    });

// Event Listeners
if (startBtn && startBtn.tagName === 'BUTTON') startBtn.addEventListener('click', startQuiz);

if (backBtn) backBtn.addEventListener('click', prevQuestion);
if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
if (showTopBtn) showTopBtn.addEventListener('click', () => toggleResultView('top'));
if (showRunnerUpBtn) showRunnerUpBtn.addEventListener('click', () => toggleResultView('runner-up'));
if (showWorstBtn) showWorstBtn.addEventListener('click', () => toggleResultView('worst'));
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
if (expandedModeToggle) expandedModeToggle.addEventListener('change', (e) => {
    isExpandedMode = e.target.checked;
    renderQuestion();
});

// Theme Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    document.documentElement.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize Theme
initTheme();

function switchView(viewName) {
    // If views don't exist (e.g. we are on a page that doesn't have them), do nothing or handle gracefully
    if (!views[viewName]) return;

    Object.values(views).forEach(view => {
        if (view) {
            view.classList.add('hidden');
            view.classList.remove('active');
        }
    });

    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => {
            views[viewName].classList.add('active');
        }, 10);
    }
}

function startQuiz() {
    currentQuestionIndex = 0;
    userAnswers = {};
    switchView('quiz');
    renderQuestion();
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < dimensions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        calculateResult();
    }
}

function renderQuestion() {
    if (!views.quiz) return;

    const dimension = dimensions[currentQuestionIndex];

    // Update Back Button Visibility
    if (backBtn) {
        if (currentQuestionIndex === 0) {
            backBtn.classList.add('hidden');
        } else {
            backBtn.classList.remove('hidden');
        }
    }

    // Initialize shuffled display order for this dimension if not exists
    if (!dimension._shuffledOrder) {
        // Create shuffled indices for display to avoid order bias
        dimension._shuffledOrder = [...Array(dimension.options.length).keys()].sort(() => Math.random() - 0.5);
    }

    // Get current selection (single value or null)
    const currentSelection = userAnswers[dimension.id] || null;

    // Show/hide Next Button based on selection
    if (nextBtn) {
        if (currentSelection) {
            nextBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.add('hidden');
        }
    }

    // Update Progress
    if (progressBar) {
        const progress = (currentQuestionIndex / dimensions.length) * 100;
        progressBar.style.width = `${progress}%`;
    }

    // Update Content
    if (dimensionLabel) dimensionLabel.textContent = `Dimension ${currentQuestionIndex + 1}: ${dimension.label}`;
    if (questionText) {
        const qText = isExpandedMode && dimension.expanded_question ? dimension.expanded_question : dimension.question;
        questionText.innerHTML = `
            ${qText}
            <div class="instruction-text">Select the statement you most agree with:</div>
        `;
    }

    // Render Options as clickable selection cards
    if (optionsContainer) {
        optionsContainer.innerHTML = '<div class="selection-container" id="selection-list"></div>';
        const list = document.getElementById('selection-list');

        dimension._shuffledOrder.forEach((originalIndex) => {
            const option = dimension.options[originalIndex];
            const isSelected = currentSelection === option.value;

            const card = document.createElement('div');
            card.className = `option-card${isSelected ? ' selected' : ''}`;
            card.dataset.value = option.value;
            card.onclick = () => selectOption(dimension.id, option.value);

            card.innerHTML = `
                <div class="option-content">
                    <div class="option-text">${isExpandedMode && option.expanded_label ? option.expanded_label : option.label}</div>
                </div>
                ${isSelected ? '<div class="checkmark">✓</div>' : ''}
            `;
            list.appendChild(card);
        });
    }
}

function selectOption(dimensionId, value) {
    userAnswers[dimensionId] = value;
    renderQuestion();
}

let topMatchData = null;
let runnerUpData = null;
let worstMatchData = null;

function calculateResult() {
    let scores = [];

    systems.forEach(system => {
        let totalManhattanDistance = 0;
        let breakdown = [];

        dimensions.forEach(dim => {
            const sysVal = system.profile[dim.id];
            const sysIndex = dim.options.findIndex(o => o.value === sysVal);

            const userVal = userAnswers[dim.id];
            const userIndex = dim.options.findIndex(o => o.value === userVal);

            // Calculate Manhattan distance for this dimension
            let dimManhattanDistance = 0;
            if (userIndex >= 0 && sysIndex >= 0) {
                const userDimVector = TETRALEMMA_VECTORS[userIndex];
                const sysDimVector = TETRALEMMA_VECTORS[sysIndex];
                dimManhattanDistance =
                    Math.abs(userDimVector[0] - sysDimVector[0]) +
                    Math.abs(userDimVector[1] - sysDimVector[1]);
            }

            totalManhattanDistance += dimManhattanDistance;

            breakdown.push({
                dim: dim.label,
                sysVal: sysVal,
                userVal: userVal,
                distance: dimManhattanDistance,
                isSameChoice: userVal === sysVal,
                optionLabel: getOptionLabel(dim.id, sysVal),
                userOptionLabel: getOptionLabel(dim.id, userVal)
            });
        });

        const matchPercentage = Math.round((1 - totalManhattanDistance / MAX_MANHATTAN_DISTANCE) * 100);

        scores.push({ system, distance: totalManhattanDistance, matchPercentage, breakdown });
    });

    // Sort by distance (ascending), then alphabetically by name for ties
    scores.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.system.name.localeCompare(b.system.name);
    });

    topMatchData = scores[0];
    runnerUpData = scores[1]; // Assumes at least 2 systems
    worstMatchData = scores[scores.length - 1];

    showResult();
}

function showResult() {
    switchView('results');
    if (resultToggleContainer) resultToggleContainer.classList.remove('hidden');
    toggleResultView('top');
}

function toggleResultView(viewType) {
    if (!views.results) return;

    let data;
    if (viewType === 'top') data = topMatchData;
    else if (viewType === 'runner-up') data = runnerUpData;
    else data = worstMatchData;

    const system = data.system;

    // Update Buttons
    if (showTopBtn && showRunnerUpBtn && showWorstBtn) {
        if (viewType === 'top') {
            showTopBtn.classList.add('active');
            showRunnerUpBtn.classList.remove('active');
            showWorstBtn.classList.remove('active');
        } else if (viewType === 'runner-up') {
            showTopBtn.classList.remove('active');
            showRunnerUpBtn.classList.add('active');
            showWorstBtn.classList.remove('active');
        } else {
            showTopBtn.classList.remove('active');
            showRunnerUpBtn.classList.remove('active');
            showWorstBtn.classList.remove('active');
            showWorstBtn.classList.add('active');
        }
    }

    // Update Content
    const resultName = document.getElementById('result-name');
    const resultScore = document.getElementById('result-score');
    const resultDescription = document.getElementById('result-description');
    const resultWiki = document.getElementById('result-wiki');

    if (resultName) resultName.textContent = system.name;
    if (resultScore) resultScore.textContent = `Match: ${data.matchPercentage}%`;
    if (resultDescription) resultDescription.textContent = system.description;
    if (resultWiki) resultWiki.href = system.wiki;

    // Add Primary Source display if it doesn't exist, or update it
    let sourceEl = document.getElementById('result-source');
    if (!sourceEl && resultDescription) {
        sourceEl = document.createElement('div');
        sourceEl.id = 'result-source';
        sourceEl.className = 'result-source';
        // Insert after description
        resultDescription.parentNode.insertBefore(sourceEl, resultDescription.nextSibling);
    }

    if (sourceEl) {
        if (system.primary_source) {
            sourceEl.innerHTML = `📖 Recommended Reading: <em>${system.primary_source}</em>`;
            sourceEl.style.display = 'block';
        } else {
            sourceEl.style.display = 'none';
        }
    }

    const breakdownList = document.getElementById('result-breakdown');
    if (breakdownList) {
        breakdownList.innerHTML = '';

        data.breakdown.forEach(item => {
            const li = document.createElement('li');

            // Determine styles and text based on distance
            let matchClass = 'match-neutral';
            let badgeHtml = '';
            let alignmentText = '';

            if (item.isSameChoice) {
                // Same choice - perfect match on this dimension (distance = 0)
                matchClass = 'match-most';
                badgeHtml = '<span class="match-badge success">Same Choice</span>';
                alignmentText = `<strong>You also chose: ${item.userVal}</strong>`;
            } else if (item.distance === 2) {
                // Opposite choices (Manhattan distance = 2)
                matchClass = 'match-least';
                badgeHtml = '<span class="match-badge danger">Opposite</span>';
                alignmentText = `Your choice: <strong>${item.userVal}</strong>`;
            } else {
                // Related/adjacent choices (Manhattan distance = 1)
                matchClass = 'match-neutral';
                badgeHtml = '<span class="match-badge neutral">Related</span>';
                alignmentText = `Your choice: <strong>${item.userVal}</strong>`;
            }

            li.className = matchClass;
            li.innerHTML = `
                <div class="dim-name">${item.dim}</div>
                <div class="comparison-container">
                    <div class="system-stance">
                        <span class="label">System View</span>
                        <div class="value">
                            ${item.sysVal}
                            ${badgeHtml}
                        </div>
                        <div class="description">"${item.optionLabel}"</div>
                    </div>
                    <div class="user-alignment">
                        ${alignmentText}
                    </div>
                </div>
            `;
            breakdownList.appendChild(li);
        });
    }
}

function getOptionLabel(dimensionId, value) {
    const dim = dimensions.find(d => d.id === dimensionId);
    if (!dim) return '';
    const option = dim.options.find(o => o.value === value);
    return option ? option.label : '';
}