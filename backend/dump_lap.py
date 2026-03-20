import json
with open('tests/activity_json.json', 'r') as f:
    data = json.load(f)

with open('lap_dump.txt', 'w') as f:
    if 'splits' in data and 'lapDTOs' in data['splits']:
        f.write(json.dumps(data['splits']['lapDTOs'][:2], indent=2))
    else:
        f.write("No lapDTOs found in splits!")
