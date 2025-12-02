// Data will be loaded from JSON files
let dimensions = [];
let systems = [];

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
    const currentAnswer = userAnswers[dimension.id] || { most: null, least: null };

    // Update Back Button Visibility
    if (backBtn) {
        if (currentQuestionIndex === 0) {
            backBtn.classList.add('hidden');
        } else {
            backBtn.classList.remove('hidden');
        }
    }

    // Initialize user answers for this dimension if not exists
    if (!userAnswers[dimension.id]) {
        // Randomize initial order to avoid bias
        const shuffledOptions = [...dimension.options].sort(() => Math.random() - 0.5);
        userAnswers[dimension.id] = shuffledOptions.map(opt => opt.value);
    }

    const currentOrder = userAnswers[dimension.id];

    // Reset Next Button
    if (nextBtn) nextBtn.classList.remove('hidden');

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
            <div class="instruction-text">Rank the following from most agreed (top) to least agreed (bottom):</div>
        `;
    }

    // Render Options in the current order
    if (optionsContainer) {
        optionsContainer.innerHTML = '<div class="ranking-container" id="ranking-list"></div>';
        const list = document.getElementById('ranking-list');

        currentOrder.forEach((val, index) => {
            const option = dimension.options.find(o => o.value === val);
            // Find original index for consistent coloring
            const originalIndex = dimension.options.findIndex(o => o.value === val);

            const card = document.createElement('div');
            card.className = `rank-card variant-${originalIndex}`;
            card.draggable = true;
            card.dataset.value = val;
            card.dataset.index = index;

            card.innerHTML = `
                <div class="drag-handle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </div>
                <div class="rank-indicator">#${index + 1}</div>
                <div class="rank-content">
                    <div class="rank-text">${isExpandedMode && option.expanded_label ? option.expanded_label : option.label}</div>
                </div>
                <div class="rank-controls">
                    <button class="rank-btn up-btn" onclick="moveOption('${dimension.id}', ${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="rank-btn down-btn" onclick="moveOption('${dimension.id}', ${index}, 1)" ${index === 3 ? 'disabled' : ''}>▼</button>
                </div>
            `;
            list.appendChild(card);
        });

        setupDragAndDrop(list, dimension.id);
    }
}

window.moveOption = function (dimensionId, index, direction) {
    const newIndex = index + direction;
    const currentOrder = userAnswers[dimensionId];

    if (newIndex >= 0 && newIndex < currentOrder.length) {
        // Swap
        const temp = currentOrder[index];
        currentOrder[index] = currentOrder[newIndex];
        currentOrder[newIndex] = temp;

        userAnswers[dimensionId] = currentOrder;
        renderQuestion();
    }
};

function setupDragAndDrop(list, dimensionId) {
    let draggedItem = null;

    const items = list.querySelectorAll('.rank-card');

    items.forEach(item => {
        item.addEventListener('dragstart', function (e) {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', function () {
            item.classList.remove('dragging');
            draggedItem = null;

            // Update state based on new DOM order
            const newOrder = [];
            list.querySelectorAll('.rank-card').forEach(card => {
                newOrder.push(card.dataset.value);
            });
            userAnswers[dimensionId] = newOrder;
            renderQuestion(); // Re-render to update numbers and buttons
        });

        item.addEventListener('dragover', function (e) {
            e.preventDefault();
            const afterElement = getDragAfterElement(list, e.clientY);
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.rank-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

let topMatchData = null;
let runnerUpData = null;
let worstMatchData = null;

function calculateResult() {
    let scores = [];

    systems.forEach(system => {
        let score = 0;
        let breakdown = [];

        dimensions.forEach(dim => {
            const userRankings = userAnswers[dim.id]; // Array of values [1st, 2nd, 3rd, 4th]
            const sysVal = system.profile[dim.id]; // The option value the system holds

            // Find the rank of the system's preferred value in the user's list
            // index 0 = Rank 1 (+2)
            // index 1 = Rank 2 (+1)
            // index 2 = Rank 3 (-1)
            // index 3 = Rank 4 (-2)

            const rankIndex = userRankings.indexOf(sysVal);
            let points = 0;
            let matchType = 'neutral';

            if (rankIndex === 0) {
                points = 8;
                matchType = 'rank-1';
            } else if (rankIndex === 1) {
                points = 4;
                matchType = 'rank-2';
            } else if (rankIndex === 2) {
                points = 2;
                matchType = 'rank-3';
            } else if (rankIndex === 3) {
                points = 1;
                matchType = 'rank-4';
            }

            score += points;

            // Add to breakdown
            breakdown.push({
                dim: dim.label,
                sysVal: sysVal,
                userRank: rankIndex + 1,
                points: points,
                optionLabel: getOptionLabel(dim.id, sysVal)
            });
        });

        // Calculate Percentage
        // Max score per dimension is 8. Min is 1.
        // Total max = dimensions.length * 8
        const maxPossible = dimensions.length * 8;
        const matchPercentage = Math.round((score / maxPossible) * 100);

        scores.push({ system, score, matchPercentage, breakdown });
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

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

            // Determine styles and text based on rank
            let matchClass = 'match-neutral';
            let badgeHtml = '';
            let alignmentText = '';

            if (item.userRank === 1) {
                matchClass = 'match-most';
                badgeHtml = '<span class="match-badge success">Ranked #1 (+8)</span>';
                alignmentText = `✅ <strong>You ranked this as your top choice.</strong>`;
            } else if (item.userRank === 2) {
                matchClass = 'match-most'; // Still positive-ish
                badgeHtml = '<span class="match-badge success" style="background:#dbeafe;color:#1e40af">Ranked #2 (+4)</span>';
                alignmentText = `☑️ <strong>You ranked this second.</strong>`;
            } else if (item.userRank === 3) {
                matchClass = 'match-least';
                badgeHtml = '<span class="match-badge danger" style="background:#ffedd5;color:#9a3412">Ranked #3 (+2)</span>';
                alignmentText = `⚠️ <strong>You ranked this third.</strong>`;
            } else if (item.userRank === 4) {
                matchClass = 'match-least';
                badgeHtml = '<span class="match-badge danger">Ranked #4 (+1)</span>';
                alignmentText = `❌ <strong>You ranked this last.</strong>`;
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