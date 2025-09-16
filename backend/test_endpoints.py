import requests
import json

# Probar los endpoints de glaciares disponibles
endpoints = [
    'testeo de endpoits'
]

for endpoint in endpoints:
    try:
        response = requests.get(endpoint, timeout=5)
        print(f'\n=== {endpoint} ===')
        print(f'Status: {response.status_code}')
        if response.status_code == 200:
            data = response.json()
            print(f'Type: {type(data)}')
            if isinstance(data, dict):
                print(f'Keys: {list(data.keys())}')
                if 'features' in data:
                    print(f'Features count: {len(data["features"])}')
                    if data['features']:
                        print(f'First feature keys: {list(data["features"][0].keys())}')
                        if 'properties' in data['features'][0]:
                            print(f'First feature properties: {list(data["features"][0]["properties"].keys())}')
            elif isinstance(data, list):
                print(f'List length: {len(data)}')
                if data:
                    print(f'First item keys: {list(data[0].keys()) if isinstance(data[0], dict) else "Not dict"}')
        else:
            print(f'Error: {response.text[:200]}')
    except Exception as e:
        print(f'\n=== {endpoint} ===')
        print(f'Error: {str(e)}')
