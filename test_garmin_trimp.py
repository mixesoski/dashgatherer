#!/usr/bin/env python3
import os
import sys
import traceback
import time
import json
from datetime import datetime, timedelta
from garminconnect import Garmin
from dotenv import load_dotenv
from supabase_client import supabase

load_dotenv()

def test_garmin_trimp(email, password, days_back=7):
    print(f"Testing Garmin TRIMP retrieval for {email}")
    print(f"Looking back {days_back} days")
    
    try:
        # Initialize Garmin client with updated approach for version 0.2.25
        print("Initializing Garmin client...")
        
        # First try the current approach with direct client initialization
        client = None
        try:
            client = Garmin(email, password)
            print("Client initialized, attempting login...")
            client.login()
            print("Login successful!")
        except Exception as direct_err:
            print(f"Direct login attempt failed: {str(direct_err)}")
            print("Trying alternate authentication method...")
            
            # Newer versions might use a different login approach
            try:
                from garminconnect import Garmin
                from garminconnect.garmin_client import get_credentials
                print("Getting credentials via get_credentials helper...")
                
                # Try to use get_credentials helper if available in newer versions
                try:
                    creds = get_credentials(email, password)
                    client = Garmin(email=email, password=password, auth_tokens=creds)
                    print("Created client with auth tokens")
                except (ImportError, AttributeError):
                    # Fall back to direct instantiation with tokenstore=True
                    print("Falling back to tokenstore approach")
                    client = Garmin(email=email, password=password, tokenstore=True)
                
                # Connect to Garmin
                client.login()
                print("Login successful with alternate method!")
            except Exception as alt_err:
                print(f"Alternate login also failed: {str(alt_err)}")
                print(f"Full error from alternate login: {traceback.format_exc()}")
                raise Exception(f"All login methods failed: {str(alt_err)}")
        
        # Test the connection by getting user summary
        try:
            summary = client.get_user_summary()
            user_id = summary.get('userId', 'Unknown')
            print(f"Successfully connected to Garmin account for user ID: {user_id}")
        except Exception as test_err:
            print(f"Warning: Connected to Garmin but couldn't get user summary: {str(test_err)}")
            print("Will continue anyway as we might still be able to access activities")
        
        # Get activities for the last X days
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days_back)
        
        print(f"\nFetching activities from {start_date} to {end_date}")
        # Updated get_activities_by_date call for version 0.2.25
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d"),
            activityType=None  # Get all activity types
        )
        
        print(f"Found {len(activities)} activities")
        
        # Try another method to get recent activities
        print("\nTrying alternative method - get_activities...")
        recent_activities = client.get_activities(0, 10)
        print(f"Found {len(recent_activities)} recent activities")
        
        # Try each day separately with debugging
        print("\nTrying each day separately:")
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            print(f"\nChecking activities for {date_str}")
            
            try:
                # Updated get_activities_by_date call for version 0.2.25
                day_activities = client.get_activities_by_date(
                    date_str, 
                    date_str,
                    activityType=None  # Get all activity types
                )
                print(f"Found {len(day_activities)} activities on {date_str}")
            except Exception as e:
                print(f"Error retrieving activities for {date_str}: {e}")
            
            current_date += timedelta(days=1)
        
        # If we have any activities from any method, process them
        combined_activities = activities if activities else recent_activities
        
        if not combined_activities:
            print("\nNo activities found with any method.")
            print("Testing connection with other API endpoints...")
            
            # Try to get user info
            try:
                print("\nTrying to get user profile...")
                profile = client.get_full_name()
                print(f"User profile accessible: {profile}")
            except Exception as e:
                print(f"Could not get user profile: {e}")
            
            # Try to get heart rate data
            try:
                print("\nTrying to get heart rate data...")
                heart_rate = client.get_heart_rates(end_date.strftime("%Y-%m-%d"))
                print(f"Heart rate data accessible: {bool(heart_rate)}")
            except Exception as e:
                print(f"Could not get heart rate data: {e}")
                
            return False
        
        # Process each activity to find TRIMP
        for idx, activity in enumerate(combined_activities):
            activity_id = activity.get('activityId')
            activity_name = activity.get('activityName', 'Unknown Activity')
            
            # Get activity date based on various possible fields
            activity_date = None
            if 'startTimeLocal' in activity:
                activity_date = activity['startTimeLocal'].split()[0]
            elif 'startTimeGMT' in activity:
                activity_date = activity['startTimeGMT'].split()[0]
            elif 'startTime' in activity:
                activity_date = activity['startTime'].split('T')[0]
            
            print(f"\n{idx+1}/{len(combined_activities)}: Processing activity: {activity_name} (ID: {activity_id}, Date: {activity_date})")
            
            # Print the full activity data for debugging
            print(f"Activity data: {json.dumps(activity, indent=2)}")
            
            try:
                # Get detailed activity data - updated for 0.2.25
                print(f"Fetching details for activity {activity_id}")
                details = client.get_activity_details(activity_id)
                
                # Debug the returned keys
                print(f"Activity details keys: {list(details.keys())}")
                
                # Check for different possible locations of TRIMP data in 0.2.25
                trimp_found = False
                
                # 1. Check connectIQMeasurements
                if 'connectIQMeasurements' in details and details['connectIQMeasurements']:
                    print(f"Found connectIQMeasurements with {len(details['connectIQMeasurements'])} items")
                    
                    # Print each measurement to inspect
                    for i, item in enumerate(details['connectIQMeasurements']):
                        print(f"Measurement {i+1}: {item}")
                        
                        # Look for TRIMP specifically - check various possible formats
                        if item.get('developerFieldNumber') == 4 or 'TRIMP' in str(item) or 'trimp' in str(item):
                            try:
                                trimp = round(float(item.get('value', 0)), 1)
                                print(f"FOUND TRIMP: {trimp}")
                                trimp_found = True
                                break
                            except (ValueError, TypeError):
                                print(f"Failed to convert TRIMP value: {item.get('value')}")
                
                # 2. Check in summaryDTO if available and no TRIMP found yet
                if not trimp_found and 'summaryDTO' in details:
                    summary = details['summaryDTO']
                    print(f"Summary keys: {list(summary.keys())}")
                    
                    if 'trainingEffect' in summary:
                        te = summary.get('trainingEffect', 0)
                        if te > 0:
                            # Report training effect - could be used to estimate TRIMP
                            print(f"Training Effect: {te}")
                            
                            if 'movingDuration' in summary and 'averageHR' in summary:
                                duration_min = summary.get('movingDuration', 0) / 60
                                avg_hr = summary.get('averageHR', 0)
                                print(f"Duration: {duration_min} min, Avg HR: {avg_hr} bpm")
                                print(f"Could estimate TRIMP from these values")
                
                # Wait a bit to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                print(f"Error getting details for activity {activity_id}: {e}")
                print(traceback.format_exc())
        
        print("\nTest completed successfully!")
        return True
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        print(traceback.format_exc())
        return False

def get_user_credentials(user_id):
    try:
        print(f"Fetching Garmin credentials for user {user_id}")
        response = supabase.table('garmin_credentials').select('*').eq('user_id', user_id).execute()
        
        if not response.data or len(response.data) == 0:
            print("No Garmin credentials found for user")
            return None, None
            
        credentials = response.data[0]
        email = credentials.get('email')
        password = credentials.get('password')
        
        print(f"Found credentials with email: {email}")
        return email, password
    except Exception as e:
        print(f"Error fetching Garmin credentials: {str(e)}")
        print(traceback.format_exc())
        return None, None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Get user ID from command line
        user_id = sys.argv[1]
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
        
        print(f"Looking up credentials for user ID: {user_id}")
        email, password = get_user_credentials(user_id)
        
        if email and password:
            test_garmin_trimp(email, password, days)
        else:
            print("Could not retrieve credentials. Test aborted.")
    else:
        print("Usage: python test_garmin_trimp.py <user_id> [days_back]")
        print("Example: python test_garmin_trimp.py da6a495a-f12d-4df5-9568-224fd0a96325 7") 