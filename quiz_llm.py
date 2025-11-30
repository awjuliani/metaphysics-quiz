import json
import requests
import sys
import argparse
import os
import time

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
    return "You are taking a metaphysics quiz. For each dimension presented, rank the 4 options from most agreed (1) to least agreed (4). Your output must be a valid JSON object where the key is the dimension ID and the value is an array of the option values in order of preference (first is most preferred). Do not include any markdown formatting or explanation, just the raw JSON."

def get_dimension_prompt(dim):
    user_prompt = f"Dimension ID: {dim['id']}\n"
    user_prompt += f"Question: {dim['question']}\n"
    user_prompt += "Options:\n"
    for opt in dim['options']:
        user_prompt += f"- {opt['value']}: {opt['label']}\n"
    
    user_prompt += "\nPlease provide your rankings in the following JSON format:\n"
    user_prompt += "{\n"
    user_prompt += f'  "{dim["id"]}": ["value_rank_1", "value_rank_2", "value_rank_3", "value_rank_4"]\n'
    user_prompt += "}\n"
    user_prompt += "Ensure you use the exact 'value' strings provided for the options."
    return user_prompt

def get_llm_response(api_key, model, messages):
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
    
    response = None
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.RequestException, requests.exceptions.ChunkedEncodingError) as e:
            print(f"API Request Error (Attempt {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                if response is not None:
                    print(f"Response content: {response.text}")
                sys.exit(1)

def calculate_score(user_answers, systems, dimensions):
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

def main():
    parser = argparse.ArgumentParser(description='Run Metaphysics Quiz on an LLM')
    parser.add_argument('model', help='The LLM model ID (e.g., google/gemini-2.0-flash-exp)')
    args = parser.parse_args()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    dimensions = load_json(os.path.join(base_dir, 'dimensions.json'))
    systems = load_json(os.path.join(base_dir, 'systems.json'))
    api_key = load_key(os.path.join(base_dir, 'key.txt'))
    
    # Initialize chat history
    messages = [
        {"role": "system", "content": get_system_prompt()}
    ]
    
    all_user_answers = {}
    
    print(f"Starting quiz with model: {args.model}")
    print("-" * 50)

    for i, dim in enumerate(dimensions):
        print(f"Asking Question {i+1}/{len(dimensions)}: {dim['label']}...")
        
        user_prompt = get_dimension_prompt(dim)
        messages.append({"role": "user", "content": user_prompt})
        
        response_data = get_llm_response(api_key, args.model, messages)
        
        try:
            content = response_data['choices'][0]['message']['content']
            
            # Add assistant response to history
            messages.append({"role": "assistant", "content": content})
            
            cleaned_content = clean_json_content(content)
            dimension_answer = json.loads(cleaned_content)
            
            # Merge into main answers dictionary
            all_user_answers.update(dimension_answer)
            
            # Print immediate feedback
            dim_id = dim['id']
            if dim_id in dimension_answer:
                top_choice = dimension_answer[dim_id][0]
                # Find label for top choice
                top_label = next((opt['label'] for opt in dim['options'] if opt['value'] == top_choice), top_choice)
                print(f"  -> Ranked #1: {top_label}")
            
        except (KeyError, json.JSONDecodeError) as e:
            print(f"Error parsing LLM response for {dim['label']}: {e}")
            print(f"Raw response: {response_data}")
            # We continue to the next question even if one fails
            
        # Small delay to be nice to the API
        time.sleep(1)

    # Display the LLM's full rankings
    print("\n" + "="*50)
    print("FINAL LLM RANKINGS")
    print("="*50)
    for dim in dimensions:
        dim_id = dim['id']
        print(f"\n{dim['label']}:")
        if dim_id in all_user_answers:
            rankings = all_user_answers[dim_id]
            for i, value in enumerate(rankings):
                # Find the label for this value
                label = next((opt['label'] for opt in dim['options'] if opt['value'] == value), value)
                print(f"  {i + 1}. {value}: {label}")
        else:
            print("  (no ranking provided)")

    scores = calculate_score(all_user_answers, systems, dimensions)

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
