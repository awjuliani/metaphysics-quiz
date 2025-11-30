import json
import numpy as np
import argparse
from sklearn.manifold import MDS, TSNE
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics.pairwise import pairwise_distances

def main():
    # Parse arguments
    parser = argparse.ArgumentParser(description='Generate 2D map of metaphysical systems.')
    parser.add_argument('--algo', type=str, choices=['mds', 'tsne'], default='mds',
                        help='Dimensionality reduction algorithm to use (mds or tsne)')
    parser.add_argument('--perplexity', type=float, default=10.0,
                        help='Perplexity for t-SNE (default: 5.0, recommended < n_samples)')
    args = parser.parse_args()

    # Load data
    try:
        with open('systems.json', 'r') as f:
            systems = json.load(f)
        
        with open('dimensions.json', 'r') as f:
            dimensions = json.load(f)
    except FileNotFoundError:
        print("Error: systems.json or dimensions.json not found.")
        return

    # Extract dimension keys
    dim_keys = [d['id'] for d in dimensions]
    
    # Prepare data for encoding
    data = []
    system_names = []
    
    for system in systems:
        system_names.append(system['name'])
        row = []
        for key in dim_keys:
            # Get the value for this dimension
            val = system['profile'].get(key, '')
            row.append(val)
        data.append(row)
    
    # One-Hot Encode the categorical data
    encoder = OneHotEncoder(sparse_output=False)
    encoded_data = encoder.fit_transform(data)
    
    # Compute distance matrix (using Euclidean distance on one-hot vectors)
    distance_matrix = pairwise_distances(encoded_data, metric='euclidean')
    
    coords = None
    
    if args.algo == 'mds':
        print("Running MDS...")
        # n_init=100 runs the algorithm 100 times and picks the best result automatically
        mds = MDS(n_components=2, dissimilarity='precomputed', random_state=42, normalized_stress='auto', n_init=100, max_iter=1000)
        coords = mds.fit_transform(distance_matrix)
        print(f"MDS Stress: {mds.stress_:.4f}")
        
    elif args.algo == 'tsne':
        print(f"Running t-SNE (perplexity={args.perplexity})...")
        # t-SNE for distance matrix requires metric='precomputed'
        # init='random' is usually safer for small datasets with precomputed distances than 'pca'
        tsne = TSNE(n_components=2, metric='precomputed', init='random', random_state=42, perplexity=args.perplexity, max_iter=2000)
        coords = tsne.fit_transform(distance_matrix)
        print(f"t-SNE KL Divergence: {tsne.kl_divergence_:.4f}")

    # Normalize coordinates to be roughly within -100 to 100 range for easier plotting
    # Find min/max
    min_x = np.min(coords[:, 0])
    max_x = np.max(coords[:, 0])
    min_y = np.min(coords[:, 1])
    max_y = np.max(coords[:, 1])
    
    scale_x = 180.0 / (max_x - min_x) if max_x != min_x else 1
    scale_y = 180.0 / (max_y - min_y) if max_y != min_y else 1
    
    # Center at 0,0 then scale
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    
    final_output = []
    for i in range(len(systems)):
        final_output.append({
            "name": systems[i]['name'],
            "x": float((coords[i, 0] - center_x) * scale_x),
            "y": float((coords[i, 1] - center_y) * scale_y),
            "description": systems[i]['description'],
            "profile": systems[i]['profile']
        })
        
    # Save to file
    with open('systems_map.json', 'w') as f:
        json.dump(final_output, f, indent=4)
    
    print(f"Successfully generated systems_map.json using {args.algo.upper()}")

if __name__ == "__main__":
    main()
