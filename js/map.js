// Load the data
d3.json("data/systems_map.json").then(data => {
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
        .scaleExtent([0.1, 5]) // Allow zooming out more
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Use a single color for all nodes
    const nodeColor = "var(--primary-color)";

    // Scales
    const padding = 50;
    const minDim = Math.min(width, height);
    const spreadFactor = 2.0; // Spread out points significantly
    const mapSize = minDim * spreadFactor;

    // Calculate square range centered in the container
    const xRangeStart = (width - mapSize) / 2 + padding;
    const xRangeEnd = (width + mapSize) / 2 - padding;

    const yRangeStart = (height + mapSize) / 2 - padding; // Bottom
    const yRangeEnd = (height - mapSize) / 2 + padding;   // Top

    const xScale = d3.scaleLinear()
        .domain([-120, 120])
        .range([xRangeStart, xRangeEnd]);

    const yScale = d3.scaleLinear()
        .domain([-120, 120])
        .range([yRangeStart, yRangeEnd]); // Flip Y axis

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
    nodes.append("circle")
        .attr("r", 12)
        .attr("class", "system-node")
        .attr("fill", nodeColor)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .on("mouseover", function (event, d) {
            d3.select(this).attr("r", 16);

            tooltip.style("opacity", 1)
                .html(`
                    <h3>${d.name}</h3>
                    <p style="margin-top:0.5rem; font-size: 0.85rem;">${d.description}</p>
                `);

            // Get tooltip dimensions and container offset
            const tooltipNode = tooltip.node();
            const tooltipRect = tooltipNode.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Calculate position relative to the map container
            let left = event.clientX - containerRect.left + 15;
            let top = event.clientY - containerRect.top - 28;

            // Check right edge
            if (left + tooltipRect.width > containerRect.width) {
                left = event.clientX - containerRect.left - tooltipRect.width - 15;
            }

            // Check bottom edge
            if (top + tooltipRect.height > containerRect.height) {
                top = event.clientY - containerRect.top - tooltipRect.height - 15;
            }

            // Check top edge (if it flipped up and went off screen)
            if (top < 0) {
                top = event.clientY - containerRect.top + 15;
            }

            tooltip.style("left", left + "px")
                .style("top", top + "px");
        })
        .on("mouseout", function () {
            d3.select(this).attr("r", 12);
            tooltip.style("opacity", 0);
        })
        .on("click", function (event, d) {
            const systemId = d.name.toLowerCase().replace(/\s+/g, '-');
            window.location.href = `explore.html#${systemId}`;
        });

    // Labels
    nodes.append("text")
        .attr("class", "system-label")
        .attr("y", 28) // Increased base offset from 25 to 28
        .each(function (d) {
            const words = d.name.split(/\s+/);
            const text = d3.select(this);
            if (words.length === 1) {
                text.text(words[0]);
            } else {
                // For multi-word names, stack them
                // Start with the first word
                text.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "0em")
                    .text(words[0]);

                // Add subsequent words
                for (let i = 1; i < words.length; i++) {
                    text.append("tspan")
                        .attr("x", 0)
                        .attr("dy", "1.2em") // Increased line height slightly
                        .text(words[i]);
                }
            }
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
