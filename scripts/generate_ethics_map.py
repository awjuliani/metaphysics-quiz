#!/usr/bin/env python3
"""Generate 2D map of ethical systems using MDS."""

import json
import os
import numpy as np
from sklearn.manifold import MDS
from sklearn.metrics.pairwise import pairwise_distances

# Tetralemma encoding vectors: maps option index to 2D representation
TETRALEMMA_VECTORS = [[1, 0], [0, 1], [1, 1], [0, 0]]


def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)


def main():
    # Load data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), "data")

    systems = load_json(os.path.join(data_dir, "ethical_systems.json"))
    dimensions = load_json(os.path.join(data_dir, "ethical_dimensions.json"))

    # Extract dimension keys
    dim_keys = [d["id"] for d in dimensions]

    # Encode using tetralemma vectors
    print("Using Tetralemma Encoding for ethical systems...")
    encoded_data = []

    for system in systems:
        system_vector = []
        for dim in dimensions:
            dim_id = dim["id"]
            system_val = system["profile"].get(dim_id, "")

            # Find matching option and get its tetralemma vector
            vector = [0, 0]  # Default if not found
            for i, option in enumerate(dim["options"]):
                if option["value"] == system_val:
                    vector = TETRALEMMA_VECTORS[i]
                    break

            system_vector.extend(vector)
        encoded_data.append(system_vector)

    encoded_data = np.array(encoded_data)

    # Compute distance matrix
    distance_matrix = pairwise_distances(encoded_data, metric="euclidean")

    # Run MDS
    print("Running MDS...")
    mds = MDS(
        n_components=2,
        dissimilarity="precomputed",
        random_state=42,
        normalized_stress="auto",
        n_init=100,
        max_iter=1000,
    )
    coords = mds.fit_transform(distance_matrix)
    print(f"MDS Stress: {mds.stress_:.4f}")

    # Normalize coordinates
    min_x = np.min(coords[:, 0])
    max_x = np.max(coords[:, 0])
    min_y = np.min(coords[:, 1])
    max_y = np.max(coords[:, 1])

    scale_x = 180.0 / (max_x - min_x) if max_x != min_x else 1
    scale_y = 180.0 / (max_y - min_y) if max_y != min_y else 1

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2

    final_output = []
    for i in range(len(systems)):
        final_output.append(
            {
                "name": systems[i]["name"],
                "x": float((coords[i, 0] - center_x) * scale_x),
                "y": float((coords[i, 1] - center_y) * scale_y),
                "description": systems[i]["description"],
                "profile": systems[i]["profile"],
            }
        )

    # Save to file
    output_path = os.path.join(data_dir, "ethical_systems_map.json")
    with open(output_path, "w") as f:
        json.dump(final_output, f, indent=4)

    print(f"Successfully generated ethical_systems_map.json")


if __name__ == "__main__":
    main()
