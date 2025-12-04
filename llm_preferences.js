document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
    }

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        document.documentElement.classList.toggle('dark-mode');
        const isDark = body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Tooltip Logic
    const tooltip = document.getElementById('tooltip');
    let systemDescriptions = {};

    function showTooltip(event, systemName) {
        const description = systemDescriptions[systemName];
        if (description) {
            tooltip.innerHTML = `
                <h3>${systemName}</h3>
                <p>${description}</p>
            `;
            tooltip.style.opacity = '1';
            moveTooltip(event);
        }
    }

    function hideTooltip() {
        tooltip.style.opacity = '0';
    }

    function moveTooltip(event) {
        const x = event.pageX + 15;
        const y = event.pageY + 15;

        // Boundary checks
        const tooltipRect = tooltip.getBoundingClientRect();
        const maxX = window.innerWidth - tooltipRect.width - 20;

        tooltip.style.left = Math.min(x, maxX) + 'px';
        tooltip.style.top = y + 'px';
    }

    // Helper function to calculate standard deviation
    function calculateStdDev(values) {
        if (values.length <= 1) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    }

    // Fetch and display LLM data
    Promise.all([
        fetch('batch_results.json').then(res => res.json()),
        fetch('systems.json').then(res => res.json()),
        fetch('dimensions.json').then(res => res.json())
    ])
        .then(([resultsData, systemsData, dimensionsData]) => {
            // Create lookup map for descriptions
            systemsData.forEach(sys => {
                systemDescriptions[sys.name] = sys.description;
            });

            const container = document.getElementById('llm-container');

            // Sort resultsData alphabetically by model name
            resultsData.sort((a, b) => a.model.localeCompare(b.model));

            resultsData.forEach(llm => {
                const card = document.createElement('div');
                card.className = 'llm-card';

                // Calculate all match percentages with standard deviation
                const matchPercentages = Object.entries(llm.match_scores)
                    .map(([system, score]) => {
                        const mean = Math.round(score / llm.runs);
                        // Calculate actual std dev from per_system_runs if available
                        let stdDev = 0;
                        if (llm.per_system_runs && llm.per_system_runs[system]) {
                            stdDev = Math.round(calculateStdDev(llm.per_system_runs[system]));
                        }
                        return {
                            system,
                            percentage: mean,
                            stdDev: stdDev
                        };
                    })
                    .sort((a, b) => b.percentage - a.percentage)
                    .slice(0, 5);

                // Determine highlight target (stated commitment if in top 5, else null)
                const top5Systems = matchPercentages.map(m => m.system);
                let highlightTarget = null;
                if (llm.stated_commitment && top5Systems.includes(llm.stated_commitment)) {
                    highlightTarget = llm.stated_commitment;
                }

                let preferencesHtml = '<div class="preference-section">';

                matchPercentages.forEach((match, index) => {
                    const isHighlight = match.system === highlightTarget;
                    const rankClass = isHighlight ? 'top-choice' : 'runner-up';
                    const label = index === 0 ? 'Top Match' : `#${index + 1} Match`;
                    const systemSlug = match.system.toLowerCase().replace(/\s+/g, '-');

                    // Calculate the range for std dev display
                    const minRange = Math.max(0, match.percentage - match.stdDev);
                    const maxRange = Math.min(100, match.percentage + match.stdDev);

                    // Format std dev display
                    const stdDevDisplay = match.stdDev > 0 ? ` ± ${match.stdDev}%` : '';

                    // Calculate where the fade should start (as percentage of bar width)
                    // The bar goes to maxRange, fade starts at minRange
                    const fadeStartPercent = maxRange > 0 ? (minRange / maxRange) * 100 : 100;

                    // Solid bar to maxRange, with gradient fade starting at minRange
                    preferencesHtml += `
                    <div class="preference-item ${rankClass}">
                        <span class="pref-label">${label}</span>
                        <a href="explore.html#${systemSlug}" class="pref-value system-link" data-system="${match.system}">${match.system} (${match.percentage}%${stdDevDisplay})</a>
                        <div class="pref-bar-container">
                            <div class="pref-bar" style="width: ${maxRange}%; --fade-start: ${fadeStartPercent}%"></div>
                            <div class="pref-bar-mean" style="left: ${match.percentage}%"></div>
                            <span class="pref-percent">${match.percentage}% Avg${stdDevDisplay}</span>
                        </div>
                    </div>
                `;
                });

                preferencesHtml += '</div>';

                let statedCommitmentHtml = '';
                if (llm.stated_commitment) {
                    const scSlug = llm.stated_commitment.toLowerCase().replace(/\s+/g, '-');
                    // Find explanation from a run that matches the stated commitment
                    const matchingRun = llm.run_details?.find(
                        run => run.stated_commitment === llm.stated_commitment
                    );
                    const explanation = matchingRun?.stated_explanation || '';
                    statedCommitmentHtml = `
                <div class="stated-commitment-card">
                    <div class="sc-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div class="sc-content">
                        <span class="sc-label">Stated Commitment</span>
                        <a href="explore.html#${scSlug}" class="sc-value system-link" data-system="${llm.stated_commitment}">${llm.stated_commitment} (${(() => {
                            const count = llm.stated_commitment_distribution[llm.stated_commitment] || 0;
                            if (count === llm.runs) return 'Unanimity';
                            if (count > llm.runs / 2) return 'Majority';
                            return 'Plurality';
                        })()})</a>
                        ${explanation ? `<p class="sc-explanation">"${explanation}"</p>` : ''}
                    </div>
                </div>
                `;
                }

                card.innerHTML = `
                <div class="llm-header">
                    <h2 class="llm-name">${llm.model}</h2>
                    <span class="run-count">${llm.runs} runs</span>
                </div>
                ${statedCommitmentHtml}
                ${preferencesHtml}
            `;

                container.appendChild(card);
            });

            // Add event listeners for tooltips
            document.querySelectorAll('.system-link').forEach(link => {
                link.addEventListener('mouseenter', (e) => showTooltip(e, e.target.dataset.system));
                link.addEventListener('mouseleave', hideTooltip);
                link.addEventListener('mousemove', moveTooltip);
            });
        })
        .catch(error => {
            console.error('Error loading data:', error);
            const container = document.getElementById('llm-container');
            container.innerHTML = '<p class="error-message">Failed to load data. Please try again later.</p>';
        });
});
