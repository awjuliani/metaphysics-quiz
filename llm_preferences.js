document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
    }

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
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

    // Fetch and display LLM data
    Promise.all([
        fetch('batch_results.json').then(res => res.json()),
        fetch('systems.json').then(res => res.json())
    ])
        .then(([resultsData, systemsData]) => {
            // Create lookup map for descriptions
            systemsData.forEach(sys => {
                systemDescriptions[sys.name] = sys.description;
            });

            const container = document.getElementById('llm-container');

            resultsData.forEach(llm => {
                const card = document.createElement('div');
                card.className = 'llm-card';

                // Calculate all match percentages
                const matchPercentages = Object.entries(llm.match_scores)
                    .map(([system, score]) => ({
                        system,
                        percentage: Math.round(score / llm.runs)
                    }))
                    .sort((a, b) => b.percentage - a.percentage)
                    .slice(0, 5);

                let preferencesHtml = '<div class="preference-section">';

                matchPercentages.forEach((match, index) => {
                    const rankClass = index === 0 ? 'top-choice' : 'runner-up';
                    const label = index === 0 ? 'Top Match' : `#${index + 1} Match`;
                    const systemSlug = match.system.toLowerCase().replace(/\s+/g, '-');

                    preferencesHtml += `
                    <div class="preference-item ${rankClass}">
                        <span class="pref-label">${label}</span>
                        <a href="explore.html#${systemSlug}" class="pref-value system-link" data-system="${match.system}">${match.system} (${match.percentage}%)</a>
                        <div class="pref-bar-container">
                            <div class="pref-bar" style="width: ${match.percentage}%"></div>
                            <span class="pref-percent">${match.percentage}% Avg Match</span>
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
