import json

data = json.load(open('tests/activity_json.json'))
out = open('analysis.txt', 'w')
splits = data.get('splits', {})
lapDTOs = splits.get('lapDTOs', [])
out.write(f"lapDTOs length: {len(lapDTOs)}\n")
if len(lapDTOs) > 0:
    out.write(f"First lap keys: {list(lapDTOs[0].keys())}\n")

act = data.get('activity', {})
out.write(f"Has activity object? {'activity' in data}\n")

out.close()
