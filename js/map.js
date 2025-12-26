// Map visualization with optional popularity view
let popularityMode = false;
let stats = {};
let maxCount = 0;

// Load stats data
async function loadStats() {
    try {
        stats = await getSystemStats();
        maxCount = Math.max(...Object.values(stats), 1);
    } catch (error) {
        console.warn("Could not load stats:", error);
        stats = {};
        maxCount = 1;
    }
}

// Calculate radius based on popularity
function getPopularityRadius(systemName) {
    const count = stats[systemName] || 0;
    const minRadius = 8;
    const maxRadius = 28;

    if (maxCount === 0) return minRadius;

    // Use square root scale for better visual distribution
    const scale = Math.sqrt(count / maxCount);
    return minRadius + (maxRadius - minRadius) * scale;
}

// Calculate glow intensity based on popularity (0 to 1)
function getGlowIntensity(systemName) {
    const count = stats[systemName] || 0;
    if (count === 0 || maxCount === 0) return 0;

    // Use square root scale for smoother distribution
    const intensity = Math.sqrt(count / maxCount);

    // Only show glow for systems above a threshold (top ~60% of popularity)
    const threshold = 0.3;
    if (intensity < threshold) return 0;

    // Normalize to 0-1 range above threshold
    return (intensity - threshold) / (1 - threshold);
}

// Generate glow filter style based on intensity
function getGlowStyle(systemName) {
    const intensity = getGlowIntensity(systemName);
    if (intensity === 0) return 'none';

    // Scale blur and opacity based on intensity
    const blur1 = 4 + intensity * 8;   // 4-12px
    const blur2 = 8 + intensity * 16;  // 8-24px
    const opacity1 = 0.4 + intensity * 0.4;  // 0.4-0.8
    const opacity2 = 0.2 + intensity * 0.3;  // 0.2-0.5

    // Use primary color (indigo) for glow
    const color1 = `rgba(99, 102, 241, ${opacity1})`;
    const color2 = `rgba(99, 102, 241, ${opacity2})`;

    return `drop-shadow(0 0 ${blur1}px ${color1}) drop-shadow(0 0 ${blur2}px ${color2})`;
}

// Load the data
Promise.all([
    d3.json("data/systems_map.json"),
    loadStats()
]).then(([data]) => {
    const container = document.getElementById('map-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create SVG
    const svg = d3.select("#map-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("max-width", "100%")
        .style("height", "auto");

    // Create a group for the zoomable content
    const g = svg.append("g");

    // Define zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Use a single color for all nodes
    const nodeColor = "var(--primary-color)";

    // Scales
    const padding = 50;
    const minDim = Math.min(width, height);
    const spreadFactor = 2.0;
    const mapSize = minDim * spreadFactor;

    const xRangeStart = (width - mapSize) / 2 + padding;
    const xRangeEnd = (width + mapSize) / 2 - padding;

    const yRangeStart = (height + mapSize) / 2 - padding;
    const yRangeEnd = (height - mapSize) / 2 + padding;

    const xScale = d3.scaleLinear()
        .domain([-120, 120])
        .range([xRangeStart, xRangeEnd]);

    const yScale = d3.scaleLinear()
        .domain([-120, 120])
        .range([yRangeStart, yRangeEnd]);

    // Tooltip
    const tooltip = d3.select("#tooltip");

    // Draw nodes
    const nodes = g.selectAll(".node")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${xScale(d.x)},${yScale(d.y)})`);

    // Circles
    const circles = nodes.append("circle")
        .attr("r", 12)
        .attr("class", "system-node")
        .attr("fill", nodeColor)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .on("mouseover", function (event, d) {
            const baseRadius = popularityMode ? getPopularityRadius(d.name) : 12;
            d3.select(this).attr("r", baseRadius + 4);

            // Build tooltip content
            let tooltipHtml = `
                <h3>${d.name}</h3>
                <p style="margin-top:0.5rem; font-size: 0.85rem;">${d.description}</p>
            `;

            // Add popularity badge if in popularity mode and has matches
            if (popularityMode) {
                const count = stats[d.name] || 0;
                tooltipHtml += `
                    <div class="popularity-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        ${count.toLocaleString()} match${count !== 1 ? 'es' : ''}
                    </div>
                `;
            }

            tooltip.style("opacity", 1).html(tooltipHtml);

            // Get tooltip dimensions and container offset
            const tooltipNode = tooltip.node();
            const tooltipRect = tooltipNode.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            let left = event.clientX - containerRect.left + 15;
            let top = event.clientY - containerRect.top - 28;

            if (left + tooltipRect.width > containerRect.width) {
                left = event.clientX - containerRect.left - tooltipRect.width - 15;
            }
            if (top + tooltipRect.height > containerRect.height) {
                top = event.clientY - containerRect.top - tooltipRect.height - 15;
            }
            if (top < 0) {
                top = event.clientY - containerRect.top + 15;
            }

            tooltip.style("left", left + "px")
                .style("top", top + "px");
        })
        .on("mouseout", function (event, d) {
            const baseRadius = popularityMode ? getPopularityRadius(d.name) : 12;
            d3.select(this).attr("r", baseRadius);
            tooltip.style("opacity", 0);
        })
        .on("click", function (event, d) {
            const systemId = d.name.toLowerCase().replace(/\s+/g, '-');
            window.location.href = `explore.html#${systemId}`;
        });

    // Labels
    nodes.append("text")
        .attr("class", "system-label")
        .attr("y", 28)
        .each(function (d) {
            const words = d.name.split(/\s+/);
            const text = d3.select(this);
            if (words.length === 1) {
                text.text(words[0]);
            } else {
                text.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "0em")
                    .text(words[0]);

                for (let i = 1; i < words.length; i++) {
                    text.append("tspan")
                        .attr("x", 0)
                        .attr("dy", "1.2em")
                        .text(words[i]);
                }
            }
        });

    // Toggle popularity view
    function updatePopularityView() {
        const toggleBtn = document.getElementById('view-toggle');
        const toggleLabel = toggleBtn.querySelector('.toggle-label');

        if (popularityMode) {
            toggleBtn.classList.add('active');
            toggleLabel.textContent = 'Standard';

            // Animate circles to popularity sizes with glow
            circles.transition()
                .duration(500)
                .attr("r", d => getPopularityRadius(d.name))
                .style("filter", d => getGlowStyle(d.name));

            // Adjust label positions based on new circle sizes
            nodes.selectAll("text")
                .transition()
                .duration(500)
                .attr("y", d => getPopularityRadius(d.name) + 16);

        } else {
            toggleBtn.classList.remove('active');
            toggleLabel.textContent = 'Popularity';

            // Reset circles to standard size and remove glow
            circles.transition()
                .duration(500)
                .attr("r", 12)
                .style("filter", "none");

            // Reset label positions
            nodes.selectAll("text")
                .transition()
                .duration(500)
                .attr("y", 28);
        }
    }

    // Toggle button click handler
    document.getElementById('view-toggle').addEventListener('click', () => {
        popularityMode = !popularityMode;
        updatePopularityView();
    });

    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => {
        svg.transition().call(zoom.scaleBy, 1.2);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        svg.transition().call(zoom.scaleBy, 0.8);
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
        svg.transition().call(zoom.transform, d3.zoomIdentity);
    });

}).catch(err => {
    console.error("Error loading data:", err);
});
