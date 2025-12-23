#!/usr/bin/env python3
"""
Generate 2D map of ethical systems using a simple distance-based layout.
No external dependencies required.
"""

import json
import os
import math
import random

# Tetralemma encoding vectors
TETRALEMMA_VECTORS = [[1, 0], [0, 1], [1, 1], [0, 0]]


def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)


def encode_system(system, dimensions):
    """Encode a system using tetralemma vectors."""
    vector = []
    for dim in dimensions:
        dim_id = dim["id"]
        system_val = system["profile"].get(dim_id, "")

        tetra_vec = [0, 0]
        for i, option in enumerate(dim["options"]):
            if option["value"] == system_val:
                tetra_vec = TETRALEMMA_VECTORS[i]
                break
        vector.extend(tetra_vec)
    return vector


def euclidean_distance(v1, v2):
    """Calculate Euclidean distance between two vectors."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))


def simple_mds(distance_matrix, n_iter=1000):
    """
    Simple MDS using stress minimization with gradient descent.
    Returns 2D coordinates for each point.
    """
    n = len(distance_matrix)

    # Initialize with random positions
    random.seed(42)
    coords = [[random.uniform(-100, 100), random.uniform(-100, 100)] for _ in range(n)]

    learning_rate = 1.0

    for iteration in range(n_iter):
        # Calculate gradients
        gradients = [[0.0, 0.0] for _ in range(n)]

        for i in range(n):
            for j in range(i + 1, n):
                # Current distance in 2D space
                dx = coords[i][0] - coords[j][0]
                dy = coords[i][1] - coords[j][1]
                current_dist = math.sqrt(dx * dx + dy * dy) + 1e-10

                # Target distance from distance matrix
                target_dist = distance_matrix[i][j]

                # Gradient (force pushing/pulling points)
                scale = (current_dist - target_dist) / current_dist

                gradients[i][0] += scale * dx
                gradients[i][1] += scale * dy
                gradients[j][0] -= scale * dx
                gradients[j][1] -= scale * dy

        # Update positions
        for i in range(n):
            coords[i][0] -= learning_rate * gradients[i][0] / n
            coords[i][1] -= learning_rate * gradients[i][1] / n

        # Decay learning rate
        learning_rate *= 0.999

    return coords


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), "data")

    systems = load_json(os.path.join(data_dir, "ethical_systems.json"))
    dimensions = load_json(os.path.join(data_dir, "ethical_dimensions.json"))

    print(f"Encoding {len(systems)} ethical systems...")

    # Encode all systems
    encoded = [encode_system(s, dimensions) for s in systems]

    # Build distance matrix
    n = len(systems)
    distance_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            dist = euclidean_distance(encoded[i], encoded[j])
            distance_matrix[i][j] = dist
            distance_matrix[j][i] = dist

    print("Running simple MDS...")
    coords = simple_mds(distance_matrix, n_iter=2000)

    # Normalize to -90 to 90 range
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    scale_x = 180.0 / (max_x - min_x) if max_x != min_x else 1
    scale_y = 180.0 / (max_y - min_y) if max_y != min_y else 1

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2

    final_output = []
    for i, system in enumerate(systems):
        final_output.append({
            "name": system["name"],
            "x": round((coords[i][0] - center_x) * scale_x, 2),
            "y": round((coords[i][1] - center_y) * scale_y, 2),
            "description": system["description"],
            "profile": system["profile"],
        })

    output_path = os.path.join(data_dir, "ethical_systems_map.json")
    with open(output_path, "w") as f:
        json.dump(final_output, f, indent=4)

    print(f"Successfully generated ethical_systems_map.json")


if __name__ == "__main__":
    main()
