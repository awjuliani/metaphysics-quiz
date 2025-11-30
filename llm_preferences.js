document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle functionality (copied from script.js for consistency)
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

    // Fetch and display LLM data
    fetch('batch_results.json')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('llm-container');

            data.forEach(llm => {
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

                    preferencesHtml += `
                        <div class="preference-item ${rankClass}">
                            <span class="pref-label">${label}</span>
                            <div class="pref-value">${match.system}</div>
                            <div class="pref-bar-container">
                                <div class="pref-bar" style="width: ${match.percentage}%"></div>
                                <span class="pref-percent">${match.percentage}% Avg Match</span>
                            </div>
                        </div>
                    `;
                });

                preferencesHtml += '</div>';

                card.innerHTML = `
                    <div class="llm-header">
                        <h2 class="llm-name">${llm.model}</h2>
                        <span class="run-count">${llm.runs} runs</span>
                    </div>

                    ${llm.stated_commitment ? `
                    <div class="stated-commitment-card">
                        <div class="sc-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="sc-content">
                            <span class="sc-label">Stated Commitment</span>
                            <span class="sc-value">${llm.stated_commitment}</span>
                        </div>
                    </div>
                    ` : ''}
                    ${preferencesHtml}
                `;

                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error loading LLM data:', error);
            const container = document.getElementById('llm-container');
            container.innerHTML = '<p class="error-message">Failed to load LLM data. Please try again later.</p>';
        });
});
