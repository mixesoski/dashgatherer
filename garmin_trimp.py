from garminconnect import Garmin
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def init_api(email, password):
    """Initialize Garmin API with your credentials."""
    try:
        garmin = Garmin(email=email, password=password)
        garmin.login()
        print("Garmin API initialized successfully.")
        return garmin
    except Exception as err:
        if "429" in str(err):
            print("\nError: Too many requests to Garmin API")
            print("Please wait about 15-30 minutes before trying again")
            print("You can also try logging out and back in to Garmin Connect in your browser")
        else:
            print("Error initializing Garmin API:", err)
        return None

def get_trimp_values(api):
    try:
        # Get dates for last 42 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=42)
        
        print(f"\nFetching activities from {start_date.date()} to {end_date.date()}")
        
        # Get activities using modern API
        activities = api.get_activities(0, 100)  # start=0, limit=100
        print(f"Found {len(activities)} activities")
        
        # Process each activity
        for activity in activities:
            try:
                activity_id = activity.get("activityId")
                print(f"\nProcessing activity: {activity.get('activityName')}")
                
                # Get detailed activity data
                activity_details = api.get_activity_details(activity_id)
                
                activity_date = datetime.strptime(
                    activity.get('startTimeLocal', ''), 
                    "%Y-%m-%d %H:%M:%S"
                ).date()
                
                activity_name = activity.get('activityName', 'Unknown')
                activity_type = activity.get('activityType', {}).get('typeKey', 'Unknown')
                
                trimp = 0
                if 'connectIQMeasurements' in activity_details:
                    for item in activity_details['connectIQMeasurements']:
                        if item['developerFieldNumber'] == 4:
                            trimp = round(float(item['value']), 1)
                
                    if activity_type == 'strength_training':
                        trimp = trimp * 2
                
                print(f"Date: {activity_date}")
                print(f"Activity: {activity_name}")
                print(f"Type: {activity_type}")
                print(f"TRIMP: {trimp}")
                
            except Exception as e:
                print(f"Error processing activity {activity_id}: {e}")
                continue
                
    except Exception as e:
        print(f"Error fetching activities: {e}")

def main():
    email = os.getenv('GARMIN_EMAIL')
    password = os.getenv('GARMIN_PASSWORD')
    
    print(f"Using email: {email}")
    
    api = init_api(email, password)
    if api:
        get_trimp_values(api)
    else:
        print("Failed to initialize Garmin API")

if __name__ == "__main__":
    main() 