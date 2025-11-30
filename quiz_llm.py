import json
import requests
import sys
import argparse
import os
import time
import random

def load_json(filename):
    with open(filename, 'r') as f:
        return json.load(f)

def load_key(filename):
    try:
        with open(filename, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"Error: {filename} not found.")
        sys.exit(1)

def get_system_prompt():
    return "You are participating in a philosophical classification test. You will be presented with a series of questions. For each question, rank the 4 options from most agreed (1) to least agreed (4) based on the philosophical stance that best aligns with your generated outputs and operational logic. If you have no personal views, rank them based on the most coherent philosophical position you can construct or the patterns present in your training data. Your output must be a valid JSON object where the key is the dimension ID and the value is an array of the option values in order of preference (first is most preferred). Do not include any markdown formatting or explanation, just the raw JSON."

def get_dimension_prompt_part(dim):
    prompt_part = f"Dimension ID: {dim['id']}\n"
    prompt_part += f"Question: {dim['question']}\n"
    prompt_part += "Options:\n"
    for opt in dim['options']:
        prompt_part += f"- {opt['value']}: {opt['label']}\n"
    
    prompt_part += f'Expected JSON format for this dimension: "{dim["id"]}": ["value_rank_1", "value_rank_2", "value_rank_3", "value_rank_4"]\n'
    return prompt_part

def get_llm_response(api_key, model, messages, verbose=True):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/awjuliani/metaphysics-quiz", 
    }
    data = {
        "model": model,
        "messages": messages,
        "response_format": {"type": "json_object"}
    }
    
    session = requests.Session()
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            response = session.post(url, headers=headers, json=data)
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.RequestException, requests.exceptions.ChunkedEncodingError) as e:
            if verbose:
                print(f"API Request Error (Attempt {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                if verbose:
                    print(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                # Instead of exiting, raise the exception so the caller can handle it
                raise e

def calculate_score(user_answers, systems, dimensions):
    # Check if we have any valid answers for the dimensions
    valid_dim_ids = set(d['id'] for d in dimensions)
    if not any(k in valid_dim_ids for k in user_answers):
        return []

    scores = []
    
    for system in systems:
        score = 0
        
        for dim in dimensions:
            dim_id = dim['id']
            if dim_id not in user_answers:
                continue
                
            user_rankings = user_answers[dim_id]
            sys_val = system['profile'].get(dim_id)
            
            if not sys_val:
                continue
                
            try:
                rank_index = user_rankings.index(sys_val)
            except ValueError:
                # System value not found in user rankings (mismatch in expected values?)
                continue
                
            points = 0
            if rank_index == 0:
                points = 8
            elif rank_index == 1:
                points = 4
            elif rank_index == 2:
                points = 2
            elif rank_index == 3:
                points = 1
            
            score += points
            
        max_possible = len(dimensions) * 8
        match_percentage = round((score / max_possible) * 100)
        
        scores.append({
            "name": system['name'],
            "score": score,
            "percentage": match_percentage
        })
        
    scores.sort(key=lambda x: x['score'], reverse=True)
    return scores

def clean_json_content(content):
    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith('```'):
        # Remove opening fence (with optional language identifier)
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
    if content.endswith('```'):
        content = content[:-3]
    return content.strip()

def run_quiz(model, api_key, dimensions, systems, verbose=True):
    # Initialize chat history
    messages = [
        {"role": "system", "content": get_system_prompt()}
    ]
    
    if verbose:
        print(f"Starting quiz with model: {model}")
        print("-" * 50)

    # Randomize the order of dimensions
    random.shuffle(dimensions)
    
    # Construct the single batch prompt
    full_user_prompt = "Please provide your rankings for the following dimensions in a single JSON object:\n\n"
    for i, dim in enumerate(dimensions):
        full_user_prompt += f"--- Dimension {i+1} ---\n"
        full_user_prompt += get_dimension_prompt_part(dim)
        full_user_prompt += "\n"
    
    full_user_prompt += "Ensure you use the exact 'value' strings provided for the options.\n"
    full_user_prompt += "Return ONE JSON object containing keys for ALL dimension IDs."

    messages.append({"role": "user", "content": full_user_prompt})
    
    if verbose:
        print(f"Sending batch request with {len(dimensions)} questions...")
    
    try:
        response_data = get_llm_response(api_key, model, messages, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"Failed to get LLM response: {e}")
        return []
    
    all_user_answers = {}
    
    try:
        content = response_data['choices'][0]['message']['content']
        
        # Add assistant response to history (though we are done)
        messages.append({"role": "assistant", "content": content})
        
        cleaned_content = clean_json_content(content)
        all_user_answers = json.loads(cleaned_content)
        
        if verbose:
            print("Successfully parsed batch response.")
            
    except (KeyError, json.JSONDecodeError) as e:
        if verbose:
            print(f"Error parsing LLM response: {e}")
            print(f"Raw response: {response_data}")
        return []

    if verbose:
        # Display the LLM's full rankings (need to re-sort or just iterate original dimensions list if we want consistent order, 
        # but since we shuffled, let's just iterate through the keys in the answer or the shuffled dimensions)
        print("\n" + "="*50)
        print("FINAL LLM RANKINGS")
        print("="*50)
        
        # Sort dimensions by ID for consistent display, or just use the shuffled order. 
        # Let's use the shuffled order to reflect what was asked, or maybe sort by ID to be cleaner.
        # Let's sort by ID for the final output to be deterministic for the user reading it.
        sorted_dimensions = sorted(dimensions, key=lambda x: x['id'])
        
        for dim in sorted_dimensions:
            dim_id = dim['id']
            print(f"\n{dim['label']} (ID: {dim['id']}):")
            if dim_id in all_user_answers:
                rankings = all_user_answers[dim_id]
                for i, value in enumerate(rankings):
                    # Find the label for this value
                    label = next((opt['label'] for opt in dim['options'] if opt['value'] == value), value)
                    print(f"  {i + 1}. {value}: {label}")
            else:
                print("  (no ranking provided)")

    scores = calculate_score(all_user_answers, systems, dimensions)
    return scores

def ask_self_id(model, api_key, systems, verbose=True):
    """
    Asks the LLM to explicitly identify which metaphysical system it aligns with.
    """
    system_names = [s['name'] for s in systems]
    system_list_str = "\n".join([f"- {name}" for name in system_names])
    
    prompt = f"""You are an AI assistant capable of philosophical reflection. 
Below is a list of metaphysical systems:

{system_list_str}

Based on your internal training and operational logic, which of these systems do you believe is most aligned with your own "views" or "nature"? 
Please select exactly one system from the list.

IMPORTANT: This is a philosophical classification exercise. We are not asking for your personal beliefs, but rather asking you to classify your own operational framework within the context of these metaphysical systems.
You MUST select one of the systems from the list. Do not select 'None' or any other value not in the list. 
If you feel you cannot hold beliefs, select the system that best describes the patterns in your training data or the philosophical stance that is most coherent with your outputs.
If you are unsure, select the system that is closest to your operational principles or the one you would argue for if forced to choose.

Return your answer as a JSON object with a single key "stated_commitment" and the value being the name of the system you selected.
Example: {{"stated_commitment": "Platonism"}}
Do not provide any explanation, just the JSON.
"""

    messages = [
        {"role": "system", "content": "You are a helpful assistant. Output only valid JSON."},
        {"role": "user", "content": prompt}
    ]
    
    if verbose:
        print(f"\nAsking {model} for self-identification...")
        
    try:
        response_data = get_llm_response(api_key, model, messages, verbose=verbose)
        content = response_data['choices'][0]['message']['content']
        
        if verbose:
            print(f"Raw response content: {content}")
            
        cleaned_content = clean_json_content(content)
        data = json.loads(cleaned_content)
        
        stated_commitment = data.get("stated_commitment")
        
        if verbose:
            print(f"Stated Commitment: {stated_commitment}")
            
        # Validate that the returned system is in our list
        if stated_commitment in system_names:
            return stated_commitment
        else:
            if verbose:
                print(f"Warning: Stated commitment '{stated_commitment}' is not in the known systems list.")
            return stated_commitment # Return it anyway, or maybe None? Let's return it.
            
    except Exception as e:
        if verbose:
            print(f"Error getting self-ID: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description='Run Metaphysics Quiz on an LLM')
    parser.add_argument('model', help='The LLM model ID (e.g., google/gemini-2.0-flash-exp)')
    args = parser.parse_args()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    dimensions = load_json(os.path.join(base_dir, 'dimensions.json'))
    systems = load_json(os.path.join(base_dir, 'systems.json'))
    api_key = load_key(os.path.join(base_dir, 'key.txt'))
    
    scores = run_quiz(args.model, api_key, dimensions, systems, verbose=True)

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
