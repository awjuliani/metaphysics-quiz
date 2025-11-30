// Load the data
d3.json("systems_map.json").then(data => {
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
        .scaleExtent([0.5, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Use a single color for all nodes
    const nodeColor = "var(--primary-color)";

    // Scales
    // We need to map the data coordinates (-100 to 100) to the screen
    // Let's add some padding
    const padding = 50;
    const xScale = d3.scaleLinear()
        .domain([-120, 120])
        .range([padding, width - padding]);

    const yScale = d3.scaleLinear()
        .domain([-120, 120])
        .range([height - padding, padding]); // Flip Y axis for standard cartesian

    // Tooltip
    const tooltip = d3.select("#tooltip");

    // Draw links? Maybe too messy. Let's just draw nodes.

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

            // Get tooltip dimensions
            const tooltipNode = tooltip.node();
            const tooltipRect = tooltipNode.getBoundingClientRect();

            // Calculate position
            let left = event.pageX + 15;
            let top = event.pageY - 28;

            // Check right edge
            if (left + tooltipRect.width > window.innerWidth) {
                left = event.pageX - tooltipRect.width - 15;
            }

            // Check bottom edge
            if (top + tooltipRect.height > window.innerHeight) {
                top = event.pageY - tooltipRect.height - 15;
            }

            // Check top edge (if it flipped up and went off screen)
            if (top < 0) {
                top = event.pageY + 15;
            }

            tooltip.style("left", left + "px")
                .style("top", top + "px");
        })
        .on("mouseout", function () {
            d3.select(this).attr("r", 12);
            tooltip.style("opacity", 0);
        });

    // Labels
    nodes.append("text")
        .attr("class", "system-label")
        .attr("dy", 25) // Position below the circle
        .text(d => d.name)

        .each(function (d) {
            // Simple wrap logic if needed, or just let it be
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

    // Initial centering if needed, but our scales are centered on 0,0 mapping to center of screen
    // if the data is centered.

    // Legend removed as requested

}).catch(err => {
    console.error("Error loading data:", err);
});
