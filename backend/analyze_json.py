import json
import sys

def analyze():
    print("Analyzing tests/activity_json.json")
    try:
        with open('tests/activity_json.json', 'r') as f:
            data = json.load(f)
            
        print("Top level keys:", list(data.keys()))
        
        for k, v in data.items():
            print(f"Key {k} is type {type(v)}")
            if isinstance(v, dict):
                print(f"  {k} keys:", list(v.keys()))
                
        if 'splits' in data:
            if not data['splits']:
                print("splits is empty!")
            elif isinstance(data['splits'], dict):
                print("splits keys:", list(data['splits'].keys()))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    analyze()
