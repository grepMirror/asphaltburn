from service.garmin_client_connect import GarminClientConnect

EMAIL = "mroy0407@gmail.com"
PASSWORD = "3s*5dcD#JGx5gHn!VAJF"
ACTIVITY_ID = "22206303677"

try:
    print("Logging in...")
    client = GarminClientConnect(EMAIL, PASSWORD)
    if not client.login():
        print("Login failed")
        exit(1)
        
    print("Fetching splits...")
    splits = client.client.get_activity_splits(ACTIVITY_ID)
    print("Splits fetched!")
    
    print("Fetching details...")
    details = client.client.get_activity_details(ACTIVITY_ID)
    print("Details fetched!")
    
except Exception as e:
    print(f"Error occurred: {e}")
