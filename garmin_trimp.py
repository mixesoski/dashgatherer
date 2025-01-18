from garminconnect import Garmin
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv, find_dotenv
from supabase import create_client
import pathlib
import time
from requests.exceptions import HTTPError
from garth.exc import GarthHTTPError

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

def get_trimp_values(api):
    try:
        # Get dates for last 9 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=9)
        
        print(f"\nFetching activities from {start_date.date()} to {end_date.date()}")
        
        # Get activities
        activities = api.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )
        print(f"Found {len(activities)} activities")
        
        # Process each activity
        data = []
        for activity in activities:
            try:
                activity_id = activity['activityId']
                print(f"\nProcessing activity: {activity.get('activityName', 'Unknown')}")
                
                # Add delay between requests to avoid rate limiting
                time.sleep(1)
                
                try:
                    activity_details = api.get_activity(activity_id)
                except (HTTPError, GarthHTTPError) as e:
                    if "429" in str(e):
                        print(f"Rate limited. Waiting 5 seconds...")
                        time.sleep(5)
                        activity_details = api.get_activity(activity_id)
                    else:
                        raise
                
                trimp = 0
                if 'connectIQMeasurements' in activity_details:
                    for item in activity_details['connectIQMeasurements']:
                        if item['developerFieldNumber'] == 4:
                            trimp = round(float(item['value']), 1)
                            print(f"Found TRIMP value: {trimp}")
                
                    if activity_details.get('activityTypeDTO', {}).get('typeKey') == 'strength_training':
                        trimp = trimp * 2
                        print("Doubled TRIMP for strength training")
                
                date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                activity_type = activity.get('activityType', {}).get('typeKey', 'Unknown')
                
                data.append({
                    'date': date,
                    'trimp': trimp,
                    'activity_type': activity_type,
                    'activity_name': activity.get('activityName', 'Unknown')
                })
                
                print(f"Date: {date}")
                print(f"Activity type: {activity_type}")
                print(f"TRIMP: {trimp}")
                print("-" * 50)
                
            except Exception as e:
                print(f"Error processing activity {activity_id}: {e}")
                continue
        
        return pd.DataFrame(data)
                
    except Exception as e:
        print(f"Error fetching activities: {e}")
        return pd.DataFrame(columns=['date', 'trimp', 'activity_type', 'activity_name'])

def create_trimp_chart(df):
    plt.figure(figsize=(12, 6))
    plt.plot(df['date'], df['trimp'], marker='o')
    plt.title('TRIMP Values Over Last 9 Days')
    plt.xlabel('Date')
    plt.ylabel('TRIMP')
    plt.grid(True)
    plt.xticks(rotation=45)
    plt.tight_layout()
    
    # Save the chart
    plt.savefig('trimp_chart.png')
    plt.close()

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

def main():
    try:
        # List available users first
        list_available_users()
        
        # Get user_id from input
        user_id = input("Enter user ID to fetch TRIMP data: ")
        
        # Get credentials from Supabase
        email, password = get_garmin_credentials(user_id)
        print(f"\nFetching data for user with email: {email}")
        
        # Initialize Garmin client with retry logic
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
        
        # Get TRIMP data
        df = get_trimp_values(client)
        
        if len(df) == 0:
            print("No activities found!")
            return
        
        # Sort by date
        df = df.sort_values('date', ascending=False)
        
        # Print summary
        print("\nSummary:")
        print(f"Total activities: {len(df)}")
        print(f"Total TRIMP: {round(df['trimp'].sum(), 1)}")
        print(f"Average TRIMP per activity: {round(df['trimp'].mean(), 1)}")
        print(f"Date range: {df['date'].min().strftime('%Y-%m-%d')} to {df['date'].max().strftime('%Y-%m-%d')}")
        
        # Create chart
        create_trimp_chart(df)
        print("\nChart has been created successfully!")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    main() 