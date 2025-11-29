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
const themeToggleBtn = document.getElementById('theme-toggle');

// Event Listeners
startBtn.addEventListener('click', startQuiz);
restartBtn.addEventListener('click', startQuiz);
backBtn.addEventListener('click', prevQuestion);
nextBtn.addEventListener('click', nextQuestion);
showTopBtn.addEventListener('click', () => toggleResultView('top'));
showRunnerUpBtn.addEventListener('click', () => toggleResultView('runner-up'));
themeToggleBtn.addEventListener('click', toggleTheme);

// Theme Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize Theme
initTheme();

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

    // Initialize user answers for this dimension if not exists
    if (!userAnswers[dimension.id]) {
        userAnswers[dimension.id] = {};
        dimension.options.forEach(opt => {
            userAnswers[dimension.id][opt.value] = 'neutral';
        });
    }

    const currentAnswers = userAnswers[dimension.id];

    // Reset Next Button
    nextBtn.classList.add('hidden');
    // Check if we have at least one non-neutral answer
    const hasNonNeutral = Object.values(currentAnswers).some(val => val !== 'neutral');
    if (hasNonNeutral) {
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

        const userState = currentAnswers[option.value]; // 'agree', 'neutral', 'disagree'

        card.innerHTML = `
            <div class="option-text">${option.label}</div>
            <div class="option-controls">
                <button class="select-btn agree ${userState === 'agree' ? 'selected' : ''}" 
                        onclick="handleSelection('${dimension.id}', '${option.value}', 'agree')"
                        data-tooltip="Agree">
                    ✓
                </button>
                <button class="select-btn neutral ${userState === 'neutral' ? 'selected' : ''}" 
                        onclick="handleSelection('${dimension.id}', '${option.value}', 'neutral')"
                        data-tooltip="Neutral">
                    -
                </button>
                <button class="select-btn disagree ${userState === 'disagree' ? 'selected' : ''}" 
                        onclick="handleSelection('${dimension.id}', '${option.value}', 'disagree')"
                        data-tooltip="Disagree">
                    ✕
                </button>
            </div>
        `;
        optionsContainer.appendChild(card);
    });
}

window.handleSelection = function (dimensionId, value, type) {
    // type is 'agree', 'neutral', or 'disagree'
    if (!userAnswers[dimensionId]) userAnswers[dimensionId] = {};

    // If clicking the already selected one, do we toggle to neutral? 
    // The prompt implies explicit choices. Let's just set it. 
    // If they click "Agree" and it's already "Agree", maybe nothing happens or toggle off?
    // Let's stick to simple: clicking sets the state. 
    // If they want neutral, they click neutral.

    userAnswers[dimensionId][value] = type;
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
            const userChoices = userAnswers[dim.id]; // { optionVal: 'agree'|'neutral'|'disagree' }
            const sysVal = system.profile[dim.id]; // The option value the system holds

            // We need to iterate over ALL options in this dimension to calculate score
            dim.options.forEach(option => {
                const userChoice = userChoices[option.value];
                const isSystemView = (option.value === sysVal);

                let points = 0;
                let matchType = 'neutral';

                if (isSystemView) {
                    // This is the system's view
                    if (userChoice === 'agree') {
                        points = 1;
                        matchType = 'agree-match';
                    } else if (userChoice === 'disagree') {
                        points = -1;
                        matchType = 'disagree-mismatch';
                    }
                } else {
                    // This is NOT the system's view
                    if (userChoice === 'agree') {
                        points = -1;
                        matchType = 'agree-mismatch';
                    } else if (userChoice === 'disagree') {
                        points = 0.5;
                        matchType = 'disagree-match';
                    }
                }

                score += points;

                // Only add to breakdown if it's significant (non-neutral user choice OR it's the system's view)
                // Actually, let's just show the System's View and how the user reacted to it, 
                // plus any major disagreements where the user agreed with something else.

                // For the breakdown display, we probably want to simplify. 
                // The old breakdown showed one line per dimension.
                // Now we have multiple interactions per dimension.

                // Let's collect the "System View" interaction specifically for the summary
                if (isSystemView) {
                    breakdown.push({
                        dim: dim.label,
                        sysVal: sysVal,
                        userChoice: userChoice,
                        points: points,
                        optionLabel: option.label
                    });
                }
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

        // Determine styles and text based on user choice regarding the System's view
        let matchClass = 'match-neutral';
        let badgeHtml = '<span class="match-badge neutral">Neutral</span>';
        let alignmentText = `You were neutral about this.`;

        if (item.userChoice === 'agree') {
            matchClass = 'match-most'; // Reusing green style
            badgeHtml = '<span class="match-badge success">Agreed (+1)</span>';
            alignmentText = `✅ <strong>You agreed with the system's view.</strong>`;
        } else if (item.userChoice === 'disagree') {
            matchClass = 'match-least'; // Reusing red style
            badgeHtml = '<span class="match-badge danger">Disagreed (-1)</span>';
            alignmentText = `❌ <strong>You disagreed with the system's view.</strong>`;
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

function getOptionLabel(dimensionId, value) {
    const dim = dimensions.find(d => d.id === dimensionId);
    if (!dim) return '';
    const option = dim.options.find(o => o.value === value);
    return option ? option.label : '';
}
