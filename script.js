// Data will be loaded from JSON files
let dimensions = [];
let systems = [];

// Load data
Promise.all([
    fetch('dimensions.json').then(response => response.json()),
    fetch('systems.json').then(response => response.json())
])
    .then(([dimensionsData, systemsData]) => {
        dimensions = dimensionsData;
        systems = systemsData;
        startBtn.disabled = false;
        startBtn.textContent = "Start the Quiz";
    })
    .catch(error => {
        console.error('Error loading data:', error);
        startBtn.textContent = "Error loading data. Please run a local server.";
        startBtn.disabled = true;
    });

// State
let currentQuestionIndex = 0;
let userAnswers = {};

// DOM Elements
// DOM Elements
const views = {
    intro: document.getElementById('intro-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view')
};

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const showTopBtn = document.getElementById('show-top-btn');
const showRunnerUpBtn = document.getElementById('show-runner-up-btn');
const resultToggleContainer = document.getElementById('result-toggle-container');
const progressBar = document.getElementById('progress-bar');
const dimensionLabel = document.getElementById('dimension-label');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

// Event Listeners
startBtn.addEventListener('click', startQuiz);
restartBtn.addEventListener('click', startQuiz);
backBtn.addEventListener('click', prevQuestion);
nextBtn.addEventListener('click', nextQuestion);
showTopBtn.addEventListener('click', () => toggleResultView('top'));
showRunnerUpBtn.addEventListener('click', () => toggleResultView('runner-up'));

function switchView(viewName) {
    Object.values(views).forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    views[viewName].classList.remove('hidden');
    // Small delay to allow display:block to apply before opacity transition
    setTimeout(() => {
        views[viewName].classList.add('active');
    }, 10);
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
    const dimension = dimensions[currentQuestionIndex];
    const currentAnswer = userAnswers[dimension.id] || { most: null, least: null };

    // Update Back Button Visibility
    if (currentQuestionIndex === 0) {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
    }

    // Reset Next Button
    nextBtn.classList.add('hidden');
    // Check if we already have answers to show next button
    if (currentAnswer.most && currentAnswer.least) {
        nextBtn.classList.remove('hidden');
    }

    // Update Progress
    const progress = (currentQuestionIndex / dimensions.length) * 100;
    progressBar.style.width = `${progress}%`;

    // Update Content
    dimensionLabel.textContent = `Dimension ${currentQuestionIndex + 1}: ${dimension.label}`;
    questionText.textContent = dimension.question;

    // Render Options
    optionsContainer.innerHTML = '';
    dimension.options.forEach(option => {
        const card = document.createElement('div');
        card.className = 'option-card';
        if (currentAnswer.most && currentAnswer.least && option.value !== currentAnswer.most && option.value !== currentAnswer.least) {
            card.classList.add('disabled');
        }

        const isMost = currentAnswer.most === option.value;
        const isLeast = currentAnswer.least === option.value;

        card.innerHTML = `
            <div class="option-text">${option.label}</div>
            <div class="option-controls">
                <div class="select-group">
                    <span class="select-label">Most</span>
                    <button class="select-btn most ${isMost ? 'selected' : ''}" onclick="handleSelection('${dimension.id}', '${option.value}', 'most')">
                        ${isMost ? '✓' : '+'}
                    </button>
                </div>
                <div class="select-group">
                    <span class="select-label">Least</span>
                    <button class="select-btn least ${isLeast ? 'selected' : ''}" onclick="handleSelection('${dimension.id}', '${option.value}', 'least')">
                        ${isLeast ? '✕' : '-'}
                    </button>
                </div>
            </div>
        `;
        optionsContainer.appendChild(card);
    });
}

window.handleSelection = function (dimensionId, value, type) {
    let current = userAnswers[dimensionId] || { most: null, least: null };

    if (type === 'most') {
        if (current.most === value) {
            current.most = null; // Deselect
        } else {
            current.most = value;
            if (current.least === value) current.least = null; // Clear conflict
        }
    } else if (type === 'least') {
        if (current.least === value) {
            current.least = null; // Deselect
        } else {
            current.least = value;
            if (current.most === value) current.most = null; // Clear conflict
        }
    }

    userAnswers[dimensionId] = current;
    renderQuestion();
};

let topMatchData = null;
let runnerUpData = null;

function calculateResult() {
    let scores = [];

    systems.forEach(system => {
        let score = 0;
        let breakdown = [];

        dimensions.forEach(dim => {
            const userChoice = userAnswers[dim.id];
            const sysVal = system.profile[dim.id];

            let points = 0;
            let matchType = 'neutral'; // neutral, most, least

            if (sysVal === userChoice.most) {
                points = 1;
                matchType = 'most';
            } else if (sysVal === userChoice.least) {
                points = -1;
                matchType = 'least';
            }

            score += points;
            breakdown.push({
                dim: dim.label,
                matchType: matchType,
                userMost: userChoice.most,
                userLeast: userChoice.least,
                sys: sysVal
            });
        });

        scores.push({ system, score, breakdown });
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    topMatchData = scores[0];
    runnerUpData = scores[1]; // Assumes at least 2 systems

    showResult();
}

function showResult() {
    switchView('results');
    resultToggleContainer.classList.remove('hidden');
    toggleResultView('top');
}

function toggleResultView(viewType) {
    const data = viewType === 'top' ? topMatchData : runnerUpData;
    const system = data.system;

    // Update Buttons
    if (viewType === 'top') {
        showTopBtn.classList.add('active');
        showRunnerUpBtn.classList.remove('active');
    } else {
        showTopBtn.classList.remove('active');
        showRunnerUpBtn.classList.add('active');
    }

    // Update Content
    document.getElementById('result-name').textContent = system.name;
    document.getElementById('result-description').textContent = system.description;
    document.getElementById('result-wiki').href = system.wiki;

    const breakdownList = document.getElementById('result-breakdown');
    breakdownList.innerHTML = '';

    data.breakdown.forEach(item => {
        const li = document.createElement('li');

        // Find the full dimension and option objects to get labels and descriptions
        const dimObj = dimensions.find(d => d.label === item.dim);
        const sysOption = dimObj.options.find(o => o.value === item.sys);

        // Determine styles and text based on match type
        let matchClass = 'match-neutral';
        let badgeHtml = '<span class="match-badge neutral">Neutral</span>';
        let alignmentText = `You chose <strong>${item.userMost}</strong> (Most) and <strong>${item.userLeast}</strong> (Least).`;

        if (item.matchType === 'most') {
            matchClass = 'match-most';
            badgeHtml = '<span class="match-badge success">Match (+1)</span>';
            alignmentText = `✅ <strong>You agree with this view most.</strong>`;
        } else if (item.matchType === 'least') {
            matchClass = 'match-least';
            badgeHtml = '<span class="match-badge danger">Incompatible (-1)</span>';
            alignmentText = `❌ <strong>You agree with this view least.</strong>`;
        }

        li.className = matchClass;
        li.innerHTML = `
            <div class="dim-name">${item.dim}</div>
            <div class="comparison-container">
                <div class="system-stance">
                    <span class="label">System View</span>
                    <div class="value">
                        ${item.sys}
                        ${badgeHtml}
                    </div>
                    <div class="description">"${sysOption ? sysOption.label : ''}"</div>
                </div>
                <div class="user-alignment">
                    ${alignmentText}
                </div>
            </div>
        `;
        breakdownList.appendChild(li);
    });
}

function getOptionLabel(dimensionId, value) {
    const dim = dimensions.find(d => d.id === dimensionId);
    if (!dim) return '';
    const option = dim.options.find(o => o.value === value);
    return option ? option.label : '';
}
