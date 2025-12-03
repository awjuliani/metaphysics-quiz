import argparse
import json
import os
import sys
from collections import Counter
import quiz_llm


def load_models(filename):
    try:
        with open(filename, "r") as f:
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"Error: {filename} not found.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Run Batch Metaphysics Quiz")
    parser.add_argument(
        "--models", default="models.txt", help="File containing list of models"
    )
    parser.add_argument("--n", type=int, default=10, help="Number of runs per model")
    parser.add_argument(
        "--output", default="batch_results.json", help="Output JSON file"
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run the quiz one question at a time without shared context",
    )
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Load shared resources
    dimensions = quiz_llm.load_json(os.path.join(base_dir, "dimensions.json"))
    systems = quiz_llm.load_json(os.path.join(base_dir, "systems.json"))
    api_key = quiz_llm.load_key(os.path.join(base_dir, "key.txt"))

    models = load_models(os.path.join(base_dir, args.models))

    results = []

    print(f"Starting batch execution: {len(models)} models, {args.n} runs each.")

    for model_idx, model in enumerate(models):
        print(f"\n[{model_idx+1}/{len(models)}] Testing model: {model}")

        # Dictionary to store total percentage score for each system
        system_scores = {}
        # List to store details of each run
        run_details = []

        successful_runs = 0

        # List to store stated commitments and explanations for each run
        stated_commitments = []
        stated_explanations = []

        for run in range(args.n):
            print(f"  Run {run+1}/{args.n}...", end="", flush=True)

            # Ask for self-identification for this run
            run_commitment, run_explanation = quiz_llm.ask_self_id(
                model, api_key, systems, verbose=False
            )
            if run_commitment:
                stated_commitments.append(run_commitment)
            if run_explanation:
                stated_explanations.append(run_explanation)

            try:
                # Run quiz silently (verbose=False)
                scores = quiz_llm.run_quiz(
                    model,
                    api_key,
                    dimensions,
                    systems,
                    verbose=False,
                    sequential=args.sequential,
                )

                if scores:
                    successful_runs += 1
                    top_match = scores[0]
                    print(
                        f" Done. Top match: {top_match['name']} ({top_match['percentage']}%), Stated commitment: {run_commitment}"
                    )

                    # Store run detail
                    run_details.append(
                        {
                            "run": run + 1,
                            "stated_commitment": run_commitment,
                            "stated_explanation": run_explanation,
                            "top_match": top_match["name"],
                            "percentage": top_match["percentage"],
                        }
                    )

                    # Aggregate scores
                    for score_item in scores:
                        name = score_item["name"]
                        percentage = score_item["percentage"]
                        system_scores[name] = system_scores.get(name, 0) + percentage

                else:
                    print(" Failed (No scores).")

            except Exception as e:
                print(f" Error: {e}")

        if successful_runs > 0:
            # Sort systems by total score
            sorted_systems = sorted(
                system_scores.items(), key=lambda x: x[1], reverse=True
            )

            top_match_name = sorted_systems[0][0]
            runner_up_name = sorted_systems[1][0] if len(sorted_systems) > 1 else None
            worst_match_name = sorted_systems[-1][0]

            # Calculate most frequent stated commitment
            most_common_commitment = None
            commitment_distribution = {}
            if stated_commitments:
                commitment_counts = Counter(stated_commitments)
                most_common_commitment = commitment_counts.most_common(1)[0][0]
                commitment_distribution = dict(commitment_counts)

            model_result = {
                "model": model,
                "runs": successful_runs,
                "stated_commitment": most_common_commitment,
                "stated_commitment_distribution": commitment_distribution,
                "stated_explanations": stated_explanations,
                "top_match": top_match_name,
                "runner_up": runner_up_name,
                "worst_match": worst_match_name,
                "match_scores": system_scores,
                "run_details": run_details,
            }
            results.append(model_result)
        else:
            print(f"  No successful runs for {model}")

    # Save results
    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nBatch execution complete. Results saved to {args.output}")


if __name__ == "__main__":
    main()
