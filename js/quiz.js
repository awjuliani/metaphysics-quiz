// Quiz Logic Module
// Note: Requires data-loader.js to be loaded first (provides dimensions, systems globals)
// Note: TETRALEMMA_VECTORS and MAX_MANHATTAN_DISTANCE are in js/distance-calc.js

// DOM Elements
const views = {
    intro: document.getElementById('intro-view'),
    commitment: document.getElementById('commitment-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view')
};

const startBtn = document.getElementById('start-btn');

const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const showTopBtn = document.getElementById('show-top-btn');
const showRunnerUpBtn = document.getElementById('show-runner-up-btn');
const showWorstBtn = document.getElementById('show-worst-btn');
const showCommitmentBtn = document.getElementById('show-commitment-btn');
const skippedCommitmentBtn = document.getElementById('skip-commitment-btn');
const confirmCommitmentBtn = document.getElementById('confirm-commitment-btn');
const commitmentSelect = document.getElementById('commitment-select');
const resultToggleContainer = document.getElementById('result-toggle-container');
const progressBar = document.getElementById('progress-bar');
const dimensionLabel = document.getElementById('dimension-label');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const themeToggleBtn = document.getElementById('theme-toggle');
const modeStandardBtn = document.getElementById('mode-standard');
const modeExpandedBtn = document.getElementById('mode-expanded');
const commitmentModeStandardBtn = document.getElementById('commitment-mode-standard');
const commitmentModeExpandedBtn = document.getElementById('commitment-mode-expanded');

// State
let currentQuestionIndex = 0;
let userAnswers = {};
let isExpandedMode = false;
let userCommitment = null;

// Load data using shared data-loader
initDataLoader(
    // Success callback
    () => {
        if (startBtn && startBtn.tagName === 'BUTTON') {
            startBtn.disabled = false;
            startBtn.textContent = "Start the Quiz";
        }

        // If we are on the quiz page (no intro view, but quiz view exists), start immediately
        if (!views.intro && views.quiz) {
            startQuizFlow();
        }
    },
    // Error callback
    (error) => {
        if (startBtn && startBtn.tagName === 'BUTTON') {
            startBtn.textContent = "Error loading data. Please run a local server.";
            startBtn.disabled = true;
        }
    }
);

// Event Listeners
if (startBtn && startBtn.tagName === 'BUTTON') startBtn.addEventListener('click', startQuizFlow);
if (commitmentSelect) commitmentSelect.addEventListener('change', toggleCommitmentButtons);
if (skippedCommitmentBtn) skippedCommitmentBtn.addEventListener('click', () => handleCommitment(false));
if (confirmCommitmentBtn) confirmCommitmentBtn.addEventListener('click', () => handleCommitment(true));

if (backBtn) backBtn.addEventListener('click', prevQuestion);
if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
if (showTopBtn) showTopBtn.addEventListener('click', () => toggleResultView('top'));
if (showRunnerUpBtn) showRunnerUpBtn.addEventListener('click', () => toggleResultView('runner-up'));
if (showWorstBtn) showWorstBtn.addEventListener('click', () => toggleResultView('worst'));
if (showCommitmentBtn) showCommitmentBtn.addEventListener('click', () => toggleResultView('commitment'));
// Theme toggle is now handled by js/theme.js via setupThemeToggle()
setupThemeToggle();

// Mode toggle button handlers
function setExpandedMode(expanded) {
    isExpandedMode = expanded;
    // Update all toggle button states
    if (modeStandardBtn) modeStandardBtn.classList.toggle('active', !expanded);
    if (modeExpandedBtn) modeExpandedBtn.classList.toggle('active', expanded);
    if (commitmentModeStandardBtn) commitmentModeStandardBtn.classList.toggle('active', !expanded);
    if (commitmentModeExpandedBtn) commitmentModeExpandedBtn.classList.toggle('active', expanded);
    renderQuestion();
}

if (modeStandardBtn) modeStandardBtn.addEventListener('click', () => setExpandedMode(false));
if (modeExpandedBtn) modeExpandedBtn.addEventListener('click', () => setExpandedMode(true));
if (commitmentModeStandardBtn) commitmentModeStandardBtn.addEventListener('click', () => setExpandedMode(false));
if (commitmentModeExpandedBtn) commitmentModeExpandedBtn.addEventListener('click', () => setExpandedMode(true));

// Theme initialization and toggle are now handled by js/theme.js
// initTheme() is called automatically when theme.js loads
// setupThemeToggle() is called above in the event listeners section;

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

function startQuizFlow() {
    // Populate dropdown
    if (commitmentSelect && systems.length > 0 && commitmentSelect.options.length <= 1) {
        // Sort systems alphabetically
        const sortedSystems = [...systems].map((s, i) => ({ name: s.name, index: i }))
            .sort((a, b) => a.name.localeCompare(b.name));

        sortedSystems.forEach(sys => {
            const option = document.createElement('option');
            option.value = sys.index;
            option.textContent = sys.name;
            commitmentSelect.appendChild(option);
        });
    }

    if (views.commitment) {
        switchView('commitment');
        toggleCommitmentButtons(); // specific check on load
    } else {
        startQuiz();
    }
}

function toggleCommitmentButtons() {
    if (!commitmentSelect || !confirmCommitmentBtn || !skippedCommitmentBtn) return;

    if (commitmentSelect.value !== "") {
        confirmCommitmentBtn.classList.remove('hidden');
        skippedCommitmentBtn.classList.add('hidden');
    } else {
        confirmCommitmentBtn.classList.add('hidden');
        skippedCommitmentBtn.classList.remove('hidden');
    }
}

function handleCommitment(isConfirmed) {
    if (isConfirmed) {
        const val = commitmentSelect.value;
        if (val !== "") {
            userCommitment = parseInt(val);
        } else {
            // If they clicked next but nothing selected, treat as skip or alert? 
            // Treating as skip for smoother UX, or we could require it.
            // Let's require it if they click Next.
            alert("Please select a system or click Skip.");
            return;
        }
    } else {
        userCommitment = null;
    }
    startQuiz();
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
let commitmentMatchData = null;

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

    // Handle Commitment Calculation
    commitmentMatchData = null;
    if (userCommitment !== null) {
        // userCommitment is an index invalid if systems sorted? 
        // Wait, earlier I mapped indices from unsorted source. 
        // Correct way: The dropdown values are indices into the `systems` array.
        const committedSystem = systems[userCommitment];
        if (committedSystem) {
            // We need to find the score object for this system
            commitmentMatchData = scores.find(s => s.system === committedSystem);
        }
    }

    // Sort by distance (ascending), then alphabetically by name for ties
    scores.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.system.name.localeCompare(b.system.name);
    });

    topMatchData = scores[0];
    runnerUpData = scores[1]; // Assumes at least 2 systems
    worstMatchData = scores[scores.length - 1];

    // Track Popularity (only if new result for this session/system)
    const systemName = topMatchData.system.name;
    const storageKey = `metaphysics_recorded_${systemName}`;

    // Simple session storage check to prevent spamming refresh on the same result
    if (!sessionStorage.getItem(storageKey)) {
        if (typeof incrementSystemCount === 'function') {
            incrementSystemCount(systemName);
            sessionStorage.setItem(storageKey, 'true');
        }
    }

    showResult();
}

function showResult() {
    switchView('results');
    if (resultToggleContainer) resultToggleContainer.classList.remove('hidden');


    // Show/Hide Commitment Button
    if (showCommitmentBtn) {
        if (commitmentMatchData) {
            showCommitmentBtn.classList.remove('hidden');
        } else {
            showCommitmentBtn.classList.add('hidden');
        }
    }

    toggleResultView('top');
}

function toggleResultView(viewType) {
    if (!views.results) return;

    let data;
    if (viewType === 'top') data = topMatchData;
    else if (viewType === 'runner-up') data = runnerUpData;
    else if (viewType === 'commitment') data = commitmentMatchData;
    else data = worstMatchData;

    const system = data.system;

    // Update Buttons
    if (showTopBtn && showRunnerUpBtn && showWorstBtn && showCommitmentBtn) {
        if (viewType === 'top') {
            showTopBtn.classList.add('active');
            showRunnerUpBtn.classList.remove('active');
            showWorstBtn.classList.remove('active');
            showCommitmentBtn.classList.remove('active');
        } else if (viewType === 'runner-up') {
            showTopBtn.classList.remove('active');
            showRunnerUpBtn.classList.add('active');
            showWorstBtn.classList.remove('active');
            showCommitmentBtn.classList.remove('active');
        } else if (viewType === 'commitment') {
            showTopBtn.classList.remove('active');
            showRunnerUpBtn.classList.remove('active');
            showWorstBtn.classList.remove('active');
            showCommitmentBtn.classList.add('active');
        } else {
            showTopBtn.classList.remove('active');
            showRunnerUpBtn.classList.remove('active');
            showWorstBtn.classList.add('active');
            showCommitmentBtn.classList.remove('active');
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

    // Populate Share Banner
    const bannerName = document.getElementById('banner-system-name');
    const bannerScore = document.getElementById('banner-match-score');
    const bannerDesc = document.getElementById('banner-description');

    if (bannerName) bannerName.textContent = system.name;
    if (bannerScore) bannerScore.textContent = `${data.matchPercentage}% Match`;
    if (bannerDesc) bannerDesc.textContent = system.description;

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

// Social Sharing Functionality
const shareTwitterBtn = document.getElementById('share-twitter');
const shareBlueSkyBtn = document.getElementById('share-bluesky');
const shareFacebookBtn = document.getElementById('share-facebook');
const shareThreadsBtn = document.getElementById('share-threads');
const shareLinkedInBtn = document.getElementById('share-linkedin');
const shareRedditBtn = document.getElementById('share-reddit');
const shareDownloadBtn = document.getElementById('share-download');
const shareCopyBtn = document.getElementById('share-copy');

function getShareUrl() {
    // Get the base URL (without query parameters)
    const baseUrl = window.location.origin + window.location.pathname.replace('quiz.html', '');
    return baseUrl;
}

function getShareText() {
    if (!topMatchData) return "I just discovered my metaphysical worldview!";
    const systemName = topMatchData.system.name;
    const matchPercent = topMatchData.matchPercentage;
    return `I just took the Metaphysics Quiz and found out my worldview is ${systemName} (${matchPercent}% match). What's yours?`;
}

function shareOnTwitter() {
    const text = getShareText();
    const url = getShareUrl();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
}

function shareOnBlueSky() {
    const text = getShareText();
    const url = getShareUrl();
    const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(text + ' ' + url)}`;
    window.open(bskyUrl, '_blank', 'width=550,height=420');
}

async function shareOnFacebook() {
    const text = getShareText();
    const url = getShareUrl();

    // Copy text to clipboard
    try {
        await navigator.clipboard.writeText(text);

        // Show feedback on button
        if (shareFacebookBtn) {
            const originalHtml = shareFacebookBtn.innerHTML;
            shareFacebookBtn.classList.add('copied');
            // Keep icon but change text
            const iconSvg = shareFacebookBtn.querySelector('svg').outerHTML;
            shareFacebookBtn.innerHTML = `${iconSvg}<span>Text Copied!</span>`;

            setTimeout(() => {
                shareFacebookBtn.classList.remove('copied');
                shareFacebookBtn.innerHTML = originalHtml;
            }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy text:', err);
    }

    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
}

function shareOnThreads() {
    const text = getShareText();
    const url = getShareUrl();
    const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(text + ' ' + url)}`;
    window.open(threadsUrl, '_blank', 'width=550,height=420');
}

function shareOnLinkedIn() {
    const text = getShareText();
    const url = getShareUrl();
    // Use the feed share URL which allows pre-filling text
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text + ' ' + url)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
}

function shareOnReddit() {
    const text = getShareText();
    const url = getShareUrl();
    const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
    window.open(redditUrl, '_blank', 'width=550,height=420');
}

function downloadResultImage() {
    const banner = document.getElementById('share-banner');
    if (!banner) return;

    // Show loading state on button
    const originalContent = shareDownloadBtn.innerHTML;
    shareDownloadBtn.innerHTML = '<span>Generating...</span>';
    shareDownloadBtn.disabled = true;

    // We need to temporarily make it visible (but still off-screen) for some browsers to render correctly
    // Since it's fixed at left: -9999px, it is "visible" in the DOM but not to the user.
    // html2canvas handles this well usually.

    html2canvas(banner, {
        scale: 1, // Banner is already large (1200x630)
        useCORS: true,
        backgroundColor: null // Transparent background if needed, but we set a gradient
    }).then(canvas => {
        // Create download link
        const link = document.createElement('a');
        link.download = `my-metaphysics-${topMatchData.system.name.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Restore button
        shareDownloadBtn.innerHTML = originalContent;
        shareDownloadBtn.disabled = false;
    }).catch(err => {
        console.error('Error generating image:', err);
        shareDownloadBtn.innerHTML = '<span>Error</span>';
        setTimeout(() => {
            shareDownloadBtn.innerHTML = originalContent;
            shareDownloadBtn.disabled = false;
        }, 2000);
    });
}

async function copyShareLink() {
    const text = getShareText();
    const url = getShareUrl();
    const fullText = `${text}\n${url}`;

    try {
        await navigator.clipboard.writeText(fullText);
        // Show feedback
        if (shareCopyBtn) {
            const originalText = shareCopyBtn.querySelector('span').textContent;
            shareCopyBtn.classList.add('copied');
            shareCopyBtn.querySelector('span').textContent = 'Copied!';
            setTimeout(() => {
                shareCopyBtn.classList.remove('copied');
                shareCopyBtn.querySelector('span').textContent = originalText;
            }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// Add event listeners for share buttons
if (shareTwitterBtn) shareTwitterBtn.addEventListener('click', shareOnTwitter);
if (shareBlueSkyBtn) shareBlueSkyBtn.addEventListener('click', shareOnBlueSky);
if (shareFacebookBtn) shareFacebookBtn.addEventListener('click', shareOnFacebook);
if (shareThreadsBtn) shareThreadsBtn.addEventListener('click', shareOnThreads);
if (shareLinkedInBtn) shareLinkedInBtn.addEventListener('click', shareOnLinkedIn);
if (shareRedditBtn) shareRedditBtn.addEventListener('click', shareOnReddit);
if (shareDownloadBtn) shareDownloadBtn.addEventListener('click', downloadResultImage);
if (shareCopyBtn) shareCopyBtn.addEventListener('click', copyShareLink);