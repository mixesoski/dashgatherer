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

def get_trimp_values(api, user_id, start_date=None):
    try:
        print(f"\nStarting get_trimp_values for user_id: {user_id}")
        print(f"Start date: {start_date}")
        print(f"Supabase URL: {SUPABASE_URL}")
        print(f"Supabase key starts with: {SUPABASE_KEY[:10]}...")
        
        # Test Supabase connection and permissions
        try:
            print("\nTesting Supabase connection and permissions...")
            # Test select
            select_response = supabase.table('garmin_data').select('*').limit(1).execute()
            print("Select test successful")
            
            # Test insert with a dummy record
            test_data = {
                'user_id': user_id,
                'date': datetime.now().isoformat(),
                'trimp': 0,
                'activity': 'TEST_RECORD'
            }
            print(f"\nTrying test insert with data: {test_data}")
            insert_response = supabase.table('garmin_data').insert(test_data).execute()
            print(f"Insert test response: {insert_response}")
            
            # Delete test record
            delete_response = supabase.table('garmin_data').delete().eq('activity', 'TEST_RECORD').execute()
            print("Delete test successful")
            
            print("All Supabase permission tests passed!")
        except Exception as e:
            print(f"Supabase test failed: {str(e)}")
            print(f"Full error details: {traceback.format_exc()}")
            raise

        # Get dates range
        end_date = datetime.now()
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        else:
            start_date = end_date - timedelta(days=9)
        
        print(f"\nFetching activities from {start_date.date()} to {end_date.date()}")
        
        # Create a dictionary to store daily activities and TRIMP values
        daily_data = {}
        
        # Initialize all days with 0 TRIMP
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            daily_data[date_str] = {
                'date': current_date.replace(hour=12),  # Set to noon to avoid timezone issues
                'trimp': 0,
                'activities': []
            }
            current_date += timedelta(days=1)
        
        # Get activities
        activities = api.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )
        print(f"Found {len(activities)} activities")
        
        # Process each activity
        for activity in activities:
            try:
                activity_id = activity['activityId']
                activity_name = activity.get('activityName', 'Unknown')
                print(f"\nProcessing activity: {activity_name}")
                
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
                date_str = date.strftime("%Y-%m-%d")
                
                # Add TRIMP to daily total and append activity name
                daily_data[date_str]['trimp'] += trimp
                daily_data[date_str]['activities'].append(activity_name)
                
                print(f"Date: {date}")
                print(f"Activity: {activity_name}")
                print(f"TRIMP: {trimp}")
                print("-" * 50)
                
            except Exception as e:
                print(f"Error processing activity {activity_id}: {e}")
                continue
        
        # Sort daily_data by date
        sorted_dates = sorted(daily_data.keys())
        
        # Initialize metrics for first day
        first_date = sorted_dates[0]
        daily_data[first_date]['atl'] = 50
        daily_data[first_date]['ctl'] = 50
        daily_data[first_date]['tsb'] = 0
        
        # Calculate metrics for subsequent days
        for i in range(1, len(sorted_dates)):
            current_date = sorted_dates[i]
            prev_date = sorted_dates[i-1]
            
            # ATL = previous_ATL + (today_TRIMP - previous_ATL) / 7
            daily_data[current_date]['atl'] = (
                daily_data[prev_date]['atl'] + 
                (daily_data[current_date]['trimp'] - daily_data[prev_date]['atl']) / 7
            )
            
            # CTL = previous_CTL + (today_TRIMP - previous_CTL) / 42
            daily_data[current_date]['ctl'] = (
                daily_data[prev_date]['ctl'] + 
                (daily_data[current_date]['trimp'] - daily_data[prev_date]['ctl']) / 42
            )
            
            # TSB = previous_CTL - previous_ATL
            daily_data[current_date]['tsb'] = daily_data[prev_date]['ctl'] - daily_data[prev_date]['atl']
        
        # Save daily data to Supabase
        data = []
        for date_str, day_data in daily_data.items():
            activity_data = {
                'user_id': user_id,
                'date': day_data['date'].isoformat(),
                'trimp': float(day_data['trimp']),
                'activity': ', '.join(day_data['activities']) if day_data['activities'] else 'Rest day',
                'atl': round(float(day_data['atl']), 1),
                'ctl': round(float(day_data['ctl']), 1),
                'tsb': round(float(day_data['tsb']), 1)
            }
            
            print(f"Saving data for {date_str}: {activity_data}")
            
            try:
                response = supabase.table('garmin_data').insert(activity_data).execute()
                print(f"Saved to Supabase: {date_str}")
                data.append(activity_data)
            except Exception as e:
                print(f"Error saving to Supabase: {str(e)}")
                print(f"Full error details: {traceback.format_exc()}")
                raise
        
        return pd.DataFrame(data)
                
    except Exception as e:
        print(f"Error fetching activities: {e}")
        return pd.DataFrame(columns=['date', 'trimp', 'activity', 'atl', 'ctl', 'tsb'])

def create_trimp_chart(df):
    # Use Agg backend which doesn't require GUI
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    
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
    plt.close('all')  # Make sure to close all figures

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

def main(user_id=None, start_date=None):
    try:
        if user_id:
            print(f"\nProcessing data for user ID: {user_id}")
        else:
            # List available users first
            list_available_users()
            # Get user_id from input if not provided
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
        
        # Get TRIMP data and save to Supabase
        df = get_trimp_values(client, user_id, start_date)
        
        if len(df) == 0:
            print("No activities found!")
            return {
                'success': False,
                'error': 'No activities found'
            }
        
        # Convert date strings to datetime objects
        df['date'] = pd.to_datetime(df['date'])
        
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
        
        return {
            'success': True,
            'message': 'Data fetched and saved successfully',
            'summary': {
                'total_activities': len(df),
                'total_trimp': round(df['trimp'].sum(), 1),
                'avg_trimp': round(df['trimp'].mean(), 1),
                'date_range': {
                    'start': df['date'].min().strftime('%Y-%m-%d'),
                    'end': df['date'].max().strftime('%Y-%m-%d')
                }
            }
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
    main(user_id, start_date) 