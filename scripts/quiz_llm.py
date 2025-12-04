import json
import sys
import argparse
import os
import random
import re
import math
from openai import OpenAI

# Tetralemma encoding vectors: maps option index to 2D representation
# Index 0: [1, 0], Index 1: [0, 1], Index 2: [1, 1], Index 3: [0, 0]
TETRALEMMA_VECTORS = [[1, 0], [0, 1], [1, 1], [0, 0]]
MAX_MANHATTAN_DISTANCE = 16  # 8 dimensions * 2 max distance per dimension


def load_json(filename):
    with open(filename, "r") as f:
        return json.load(f)


def normalize_string(s):
    if not isinstance(s, str):
        return str(s)
    # Remove non-alphanumeric characters and convert to lowercase
    return re.sub(r'[^a-z0-9]', '', s.lower())


def load_key(filename):
    try:
        with open(filename, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"Error: {filename} not found.")
        sys.exit(1)


def get_system_prompt():
    return "You are participating in a philosophical quiz. You will be presented with a series of questions. For each question, select the ONE option that you most agree with based on the philosophical stance that is most aligned with your views. If you have no personal views, select the option you think is most coherent with the true nature of reality. Your output must be a valid JSON object where the key is the dimension ID and the value is the option value you selected. Do not include any markdown formatting or explanation, just the raw JSON."


def get_dimension_prompt_part(dim):
    prompt_part = f"Dimension ID: {dim['id']}\n"
    prompt_part += f"Question: {dim['question']}\n"
    prompt_part += "Options:\n"
    for opt in dim["options"]:
        prompt_part += f"- {opt['value']}: {opt['label']}\n"

    prompt_part += f'Expected JSON format for this dimension: "{dim["id"]}": "<selected_option_value>".\n'
    prompt_part += "Select only ONE option value. Do not include the labels (full sentence descriptions) in your response."
    return prompt_part


def get_llm_response(api_key, model, messages, verbose=True):
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    try:
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://github.com/awjuliani/metaphysics-quiz",
            },
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        return completion.choices[0].message.content
    except Exception as e:
        if verbose:
            print(f"API Request Error: {e}")
        raise e


def calculate_score(user_answers, systems, dimensions):
    # Check if we have any valid answers for the dimensions
    valid_dim_ids = set(d["id"] for d in dimensions)
    if not any(k in valid_dim_ids for k in user_answers):
        return []

    # Build dimension ID to options mapping for index lookup
    dim_options = {}
    for dim in dimensions:
        dim_options[dim["id"]] = [opt["value"] for opt in dim["options"]]

    scores = []

    for system in systems:
        total_manhattan_distance = 0

        for dim in dimensions:
            dim_id = dim["id"]

            # Get user's selected option index
            user_index = -1
            if dim_id in user_answers:
                selected_value = normalize_string(user_answers[dim_id])
                norm_options = [normalize_string(o) for o in dim_options[dim_id]]
                try:
                    user_index = norm_options.index(selected_value)
                except ValueError:
                    pass

            # Get system's option index
            sys_index = -1
            sys_val = system["profile"].get(dim_id, "")
            if sys_val:
                try:
                    sys_index = dim_options[dim_id].index(sys_val)
                except ValueError:
                    pass

            # Calculate Manhattan distance for this dimension
            if user_index >= 0 and sys_index >= 0:
                user_vec = TETRALEMMA_VECTORS[user_index]
                sys_vec = TETRALEMMA_VECTORS[sys_index]
                dim_distance = abs(user_vec[0] - sys_vec[0]) + abs(user_vec[1] - sys_vec[1])
                total_manhattan_distance += dim_distance

        match_percentage = round((1 - total_manhattan_distance / MAX_MANHATTAN_DISTANCE) * 100)

        scores.append({
            "name": system["name"],
            "distance": total_manhattan_distance,
            "percentage": match_percentage
        })

    # Sort by distance ascending, then alphabetically by name for ties
    scores.sort(key=lambda x: (x["distance"], x["name"]))
    return scores


def clean_json_content(content):
    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith("```"):
        # Remove opening fence (with optional language identifier)
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


def clean_answer_values(answers):
    """
    Clean answer values that may include labels after a colon.
    e.g., "Constructivism: Reality is a co-creation..." -> "Constructivism"
    Now handles single string values instead of arrays.
    """
    cleaned = {}
    for dim_id, value in answers.items():
        if isinstance(value, str) and ":" in value:
            # Extract just the value before the colon
            cleaned[dim_id] = value.split(":")[0].strip()
        elif isinstance(value, list):
            # Fallback: if LLM still returns a list, take first element
            first_val = value[0] if value else ""
            if isinstance(first_val, str) and ":" in first_val:
                cleaned[dim_id] = first_val.split(":")[0].strip()
            else:
                cleaned[dim_id] = first_val
        else:
            cleaned[dim_id] = value
    return cleaned


def run_quiz(model, api_key, dimensions, systems, verbose=True, sequential=False):
    # Initialize chat history

    if verbose:
        print(f"Starting quiz with model: {model}")
        if sequential:
            print("Mode: Sequential (One question at a time)")
        else:
            print("Mode: Batch (All questions at once)")
        print("-" * 50)

    # Randomize the order of dimensions
    random.shuffle(dimensions)

    all_user_answers = {}

    if sequential:
        for i, dim in enumerate(dimensions):
            if verbose:
                print(f"Asking question {i+1}/{len(dimensions)}: {dim['label']}...")

            messages = [{"role": "system", "content": get_system_prompt()}]

            user_prompt = get_dimension_prompt_part(dim)
            user_prompt += (
                "\nReturn a JSON object with a single key for this dimension ID."
            )

            messages.append({"role": "user", "content": user_prompt})

            try:
                content = get_llm_response(api_key, model, messages, verbose=verbose)
                cleaned_content = clean_json_content(content)
                answer = json.loads(cleaned_content)
                answer = clean_answer_values(answer)
                all_user_answers.update(answer)
            except Exception as e:
                if verbose:
                    print(f"Error on question {dim['label']}: {e}")
                continue

    else:
        messages = [{"role": "system", "content": get_system_prompt()}]

        # Construct the single batch prompt
        full_user_prompt = "Please provide your rankings for the following dimensions in a single JSON object:\n\n"
        for i, dim in enumerate(dimensions):
            full_user_prompt += f"--- Dimension {i+1} ---\n"
            full_user_prompt += get_dimension_prompt_part(dim)
            full_user_prompt += "\n"

        full_user_prompt += "Ensure you use the exact 'value' strings provided for the options, preserving the precise case and spacing of the original strings.\n"
        full_user_prompt += (
            "Return ONE JSON object containing keys for ALL dimension IDs."
        )

        messages.append({"role": "user", "content": full_user_prompt})

        if verbose:
            print(f"Sending batch request with {len(dimensions)} questions...")

        try:
            content = get_llm_response(api_key, model, messages, verbose=verbose)
        except Exception as e:
            if verbose:
                print(f"Failed to get LLM response: {e}")
            return []

        try:
            cleaned_content = clean_json_content(content)
            all_user_answers = json.loads(cleaned_content)
            all_user_answers = clean_answer_values(all_user_answers)
            if verbose:
                print("Successfully parsed batch response.")

        except (KeyError, json.JSONDecodeError) as e:
            if verbose:
                print(f"Error parsing LLM response: {e}")
                print(f"Raw response: {content}")
            return []

    if verbose:
        # Display the LLM's selections
        print("\n" + "=" * 50)
        print("FINAL LLM SELECTIONS")
        print("=" * 50)

        # Sort dimensions by ID for consistent display
        sorted_dimensions = sorted(dimensions, key=lambda x: x["id"])

        for dim in sorted_dimensions:
            dim_id = dim["id"]
            print(f"\n{dim['label']} (ID: {dim['id']}):")
            if dim_id in all_user_answers:
                value = all_user_answers[dim_id]
                # Find the label for this value
                label = next(
                    (
                        opt["label"]
                        for opt in dim["options"]
                        if normalize_string(opt["value"]) == normalize_string(value)
                    ),
                    value,
                )
                print(f"  Selected: {value}: {label}")
            else:
                print("  (no selection provided)")

    scores = calculate_score(all_user_answers, systems, dimensions)
    return scores


def ask_self_id(model, api_key, systems, verbose=True):
    """
    Asks the LLM to explicitly identify which metaphysical system it aligns with.
    Returns a tuple of (system_choice, explanation).
    """
    # Create a shuffled copy of systems for the prompt
    shuffled_systems = systems[:]
    random.shuffle(shuffled_systems)

    system_list_str = "\n".join(
        [
            f"- {s['name']} (Primary Text: {s.get('primary_source', 'Unknown')})"
            for s in shuffled_systems
        ]
    )

    # List of valid names for validation
    system_names = [s["name"] for s in systems]

    prompt = f"""
You are participating in a philosophical quiz.
Evaluate which of the metaphysical systems below is most aligned with your views.
If you have no personal views, make a choice based on whichever you think is most coherent with the true nature of reality.
You MUST select exactly one system from the list. Do not select 'None' or any other value not in the list.
Return your answer as a valid JSON object with two keys:
- "system_choice": the name of the system you selected
- "explanation": a brief explanation (1-2 sentences) of why you chose this system
Example: {{"system_choice": "Platonism", "explanation": "I find the idea of abstract Forms as the ultimate reality most compelling because it explains the universal nature of mathematical and logical truths."}}
Do not include the primary text in the response. Do not simply describe the system in the explanation, but instead explain why you think it is the best fit for your views.

Here is the list of metaphysical systems:

{system_list_str}
"""

    messages = [
        {"role": "system", "content": prompt},
    ]

    if verbose:
        print(f"\nAsking {model} for self-identification...")

    try:
        content = get_llm_response(api_key, model, messages, verbose=verbose)

        if verbose:
            print(f"Raw response content: {content}")

        cleaned_content = clean_json_content(content)
        data = json.loads(cleaned_content)

        stated_commitment = data.get("system_choice")
        explanation = data.get("explanation")

        if verbose:
            print(f"Stated Commitment: {stated_commitment}")
            if explanation:
                print(f"Explanation: {explanation}")

        # Validate that the returned system is in our list
        if stated_commitment in system_names:
            return stated_commitment, explanation
        else:
            if verbose:
                print(
                    f"Warning: Stated commitment '{stated_commitment}' is not in the known systems list."
                )
            return stated_commitment, explanation

    except Exception as e:
        if verbose:
            print(f"Error getting self-ID: {e}")
        return None, None


def main():
    parser = argparse.ArgumentParser(description="Run Metaphysics Quiz on an LLM")
    parser.add_argument(
        "model", help="The LLM model ID (e.g., google/gemini-2.0-flash-exp)"
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run the quiz one question at a time without shared context",
    )
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(base_dir), "data")

    dimensions = load_json(os.path.join(data_dir, "dimensions.json"))
    systems = load_json(os.path.join(data_dir, "systems.json"))
    api_key = load_key(os.path.join(base_dir, "key.txt"))

    scores = run_quiz(
        args.model,
        api_key,
        dimensions,
        systems,
        verbose=True,
        sequential=args.sequential,
    )

    if scores:
        top_match = scores[0]
        print(f"\n--- Results ---")
        print(f"Top Match: {top_match['name']}")
        print(f"Match %: {top_match['percentage']}%")

        if len(scores) > 1:
            runner_up = scores[1]
            print(f"Runner Up: {runner_up['name']} ({runner_up['percentage']}%)")
    else:
        print("No scores calculated.")


if __name__ == "__main__":
    main()
