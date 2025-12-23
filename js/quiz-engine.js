// Generic Quiz Engine Module
// Can be configured for metaphysics, ethics, or narrative quizzes

// Tetralemma vectors for distance calculation
const TETRALEMMA_VECTORS = [
    [1, 0], // Option 0
    [0, 1], // Option 1
    [1, 1], // Option 2
    [0, 0]  // Option 3
];

class QuizEngine {
    constructor(config) {
        this.quizType = config.quizType; // 'metaphysics', 'ethics', 'narrative'
        this.dimensions = [];
        this.systems = [];
        this.dimensionsPath = config.dimensionsPath;
        this.systemsPath = config.systemsPath;
        this.onDataLoaded = config.onDataLoaded || (() => {});
        this.onError = config.onError || ((e) => console.error(e));

        // State
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.isExpandedMode = false;
        this.userCommitment = null;

        // Results
        this.topMatch = null;
        this.runnerUp = null;
        this.worstMatch = null;
        this.commitmentMatch = null;
    }

    async loadData() {
        try {
            const [dimensionsRes, systemsRes] = await Promise.all([
                fetch(this.dimensionsPath),
                fetch(this.systemsPath)
            ]);

            if (!dimensionsRes.ok || !systemsRes.ok) {
                throw new Error('Failed to load quiz data');
            }

            this.dimensions = await dimensionsRes.json();
            this.systems = await systemsRes.json();

            // Calculate max distance based on dimensions
            this.maxManhattanDistance = this.dimensions.length * 2;

            this.onDataLoaded();
        } catch (e) {
            this.onError(e);
        }
    }

    getDimensionCount() {
        return this.dimensions.length;
    }

    getSystemCount() {
        return this.systems.length;
    }

    getCurrentDimension() {
        return this.dimensions[this.currentQuestionIndex];
    }

    getCurrentQuestionIndex() {
        return this.currentQuestionIndex;
    }

    getTotalQuestions() {
        return this.dimensions.length;
    }

    getProgress() {
        return (this.currentQuestionIndex / this.dimensions.length) * 100;
    }

    setAnswer(dimensionId, value) {
        this.userAnswers[dimensionId] = value;
    }

    getAnswer(dimensionId) {
        return this.userAnswers[dimensionId] || null;
    }

    hasCurrentAnswer() {
        const dim = this.getCurrentDimension();
        return dim && this.userAnswers[dim.id] != null;
    }

    canGoBack() {
        return this.currentQuestionIndex > 0;
    }

    canGoNext() {
        return this.hasCurrentAnswer() && this.currentQuestionIndex < this.dimensions.length - 1;
    }

    isLastQuestion() {
        return this.currentQuestionIndex === this.dimensions.length - 1;
    }

    goBack() {
        if (this.canGoBack()) {
            this.currentQuestionIndex--;
            return true;
        }
        return false;
    }

    goNext() {
        if (this.currentQuestionIndex < this.dimensions.length - 1) {
            this.currentQuestionIndex++;
            return true;
        }
        return false;
    }

    reset() {
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.userCommitment = null;
        this.topMatch = null;
        this.runnerUp = null;
        this.worstMatch = null;
        this.commitmentMatch = null;
    }

    setCommitment(systemIndex) {
        this.userCommitment = systemIndex;
    }

    setExpandedMode(expanded) {
        this.isExpandedMode = expanded;
    }

    getShuffledOptionsOrder(dimension) {
        // Create or return cached shuffled order
        if (!dimension._shuffledOrder) {
            dimension._shuffledOrder = [...Array(dimension.options.length).keys()]
                .sort(() => Math.random() - 0.5);
        }
        return dimension._shuffledOrder;
    }

    calculateResults() {
        let scores = [];

        this.systems.forEach(system => {
            let totalManhattanDistance = 0;
            let breakdown = [];

            this.dimensions.forEach(dim => {
                const sysVal = system.profile[dim.id];
                const sysIndex = dim.options.findIndex(o => o.value === sysVal);

                const userVal = this.userAnswers[dim.id];
                const userIndex = dim.options.findIndex(o => o.value === userVal);

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
                    dimId: dim.id,
                    sysVal: sysVal,
                    userVal: userVal,
                    distance: dimManhattanDistance,
                    isSameChoice: userVal === sysVal,
                    optionLabel: this.getOptionLabel(dim.id, sysVal),
                    userOptionLabel: this.getOptionLabel(dim.id, userVal)
                });
            });

            const matchPercentage = Math.round((1 - totalManhattanDistance / this.maxManhattanDistance) * 100);

            scores.push({
                system,
                distance: totalManhattanDistance,
                matchPercentage,
                breakdown,
                answers: { ...this.userAnswers }
            });
        });

        // Handle commitment
        this.commitmentMatch = null;
        if (this.userCommitment !== null) {
            const committedSystem = this.systems[this.userCommitment];
            if (committedSystem) {
                this.commitmentMatch = scores.find(s => s.system === committedSystem);
            }
        }

        // Sort by distance
        scores.sort((a, b) => {
            if (a.distance !== b.distance) return a.distance - b.distance;
            return a.system.name.localeCompare(b.system.name);
        });

        this.topMatch = scores[0];
        this.runnerUp = scores[1];
        this.worstMatch = scores[scores.length - 1];

        return {
            top: this.topMatch,
            runnerUp: this.runnerUp,
            worst: this.worstMatch,
            commitment: this.commitmentMatch,
            allScores: scores
        };
    }

    getOptionLabel(dimensionId, value) {
        const dim = this.dimensions.find(d => d.id === dimensionId);
        if (!dim) return '';
        const option = dim.options.find(o => o.value === value);
        return option ? option.label : '';
    }

    getSortedSystemsForDropdown() {
        return [...this.systems]
            .map((s, i) => ({ name: s.name, index: i }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuizEngine;
}
