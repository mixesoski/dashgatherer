from garminconnect import Garmin
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv, find_dotenv
from supabase import create_client
import pathlib
import time
from requests.exceptions import HTTPError
from garth.exc import GarthHTTPError
import traceback
from metrics_calculator import calculate_metrics  # zamiast calculate_sync_metrics

# Debug: Print current directory
print("Current directory:", os.getcwd())
print("Looking for .env file:", pathlib.Path('.env').absolute())

# Load environment variables for Supabase
load_dotenv(find_dotenv())

# Get environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Debug print
print("SUPABASE_URL:", SUPABASE_URL)
print("SUPABASE_KEY:", SUPABASE_KEY[:10] + "..." if SUPABASE_KEY else None)

# Initialize Supabase client
if not SUPABASE_URL or not SUPABASE_URL.startswith('https://'):
    raise Exception("Invalid SUPABASE_URL. Must start with https://")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_garmin_credentials(user_id):
    """Get Garmin credentials from Supabase for given user_id."""
    response = supabase.table('garmin_credentials').select('*').eq('user_id', user_id).execute()
    if not response.data:
        raise Exception(f"No credentials found for user_id: {user_id}")
    
    credentials = response.data[0]
    return credentials['email'], credentials['password']

def get_trimp_values(api, user_id, start_date=None, update_only=False, recalculate_only=False):
    try:
        print(f"\nStarting get_trimp_values for user_id: {user_id}")
        
        # Get dates range and ensure they're timezone-naive
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            start_date = start_date.replace(tzinfo=None)
        else:
            start_date = end_date - timedelta(days=9)
        
        print(f"\nFetching activities from {start_date.date()} to {end_date.date()}")
        
        # Get activities from Garmin
        activities = api.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )
        print(f"Found {len(activities)} activities")

        # Process each activity
        daily_data = {}
        for activity in activities:
            try:
                activity_id = activity['activityId']
                activity_name = activity.get('activityName', 'Unknown')
                
                activity_details = api.get_activity(activity_id)
                trimp = 0
                if 'connectIQMeasurements' in activity_details:
                    for item in activity_details['connectIQMeasurements']:
                        if item['developerFieldNumber'] == 4:
                            trimp = round(float(item['value']), 1)
                
                # Apply multiplier for Strength Training
                strength_training_names = ['Siła', 'Trening siłowy', 'Strength Training', 'strength_training']
                if any(name.lower() in activity_name.lower().strip() for name in strength_training_names):
                    trimp = trimp * 2
                
                date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                date_str = date.strftime("%Y-%m-%d")
                
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        'date': date,
                        'trimp': 0,
                        'activities': []
                    }
                
                daily_data[date_str]['trimp'] += trimp
                daily_data[date_str]['activities'].append(activity_name)
                
                time.sleep(1)  # Rate limiting
            except Exception as e:
                print(f"Error processing activity: {e}")
                continue

        # Save activity data to Supabase
        for date_str, data in daily_data.items():
            activity_data = {
                'user_id': user_id,
                'date': data['date'].isoformat(),
                'trimp': float(data['trimp']),
                'activity': ', '.join(data['activities'])
            }
            
            try:
                supabase.table('garmin_data')\
                    .upsert(activity_data, on_conflict='user_id,date')\
                    .execute()
                print(f"Saved activity data for {date_str}")
            except Exception as e:
                print(f"Error saving activity data: {e}")
                continue

        return daily_data
                
    except Exception as e:
        print(f"Error fetching activities: {e}")
        return {}

def list_available_users():
    try:
        response = supabase.table('garmin_credentials').select('user_id, email').execute()
        print("\nAvailable users:")
        print("==================")
        for user in response.data:
            print(f"User ID: {user['user_id']}, Email: {user['email']}")
        print("==================\n")
    except Exception as e:
        print(f"Error fetching users: {str(e)}")

def main(user_id=None, start_date=None, update_only=False, recalculate_only=False):
    try:
        if user_id:
            print(f"\nProcessing data for user ID: {user_id}")
        else:
            list_available_users()
            user_id = input("Enter user ID to fetch TRIMP data: ")
        
        # Get credentials and login to Garmin
        email, password = get_garmin_credentials(user_id)
        print(f"\nFetching data for user with email: {email}")
        
        client = Garmin(email, password)
        max_retries = 3
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                client.login()
                print("Login successful!")
                break
            except (HTTPError, GarthHTTPError) as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    print(f"Rate limited. Waiting {retry_delay} seconds before retry...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                raise
        
        # Get TRIMP data from Garmin and save to Supabase
        daily_data = get_trimp_values(client, user_id, start_date, update_only, recalculate_only)
        
        if not daily_data:
            print("No activities found!")
            return {
                'success': False,
                'error': 'No activities found'
            }
        
        # Calculate metrics using metrics_calculator
        metrics_result = calculate_metrics(user_id, start_date)  # zamiast calculate_sync_metrics

        return {
            'success': True,
            'message': 'Data fetched and saved successfully',
            'newActivities': len(daily_data)
        }
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print(traceback.format_exc())
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    import sys
    user_id = sys.argv[1] if len(sys.argv) > 1 else None
    start_date = sys.argv[2] if len(sys.argv) > 2 else None
    update_only = sys.argv[3] == 'update_only' if len(sys.argv) > 3 else False
    recalculate_only = sys.argv[4] == 'recalculate_only' if len(sys.argv) > 4 else False
    main(user_id, start_date, update_only, recalculate_only) 