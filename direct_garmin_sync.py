#!/usr/bin/env python3
"""
Direct Garmin sync implementation that doesn't rely on the garminconnect package.
This uses a direct OAuth flow and REST API calls to Garmin Connect.
"""

import os
import sys
import requests
import json
import re
import urllib.parse
import pandas as pd
import traceback
from datetime import datetime, timedelta
from supabase_client import supabase

# Constants for Garmin OAuth flow
BASE_URL = "https://connect.garmin.com"
SSO_URL = "https://sso.garmin.com/sso"
MODERN_URL = "https://connect.garmin.com/modern"
SIGNIN_URL = "https://sso.garmin.com/sso/signin"

def get_garmin_credentials(supabase_client, user_id):
    print(f"Fetching Garmin credentials for user {user_id}")
    try:
        response = supabase_client.table('garmin_credentials').select('*').eq('user_id', user_id).execute()
        print(f"Credential response data length: {len(response.data) if response.data else 0}")
        
        if not response.data or len(response.data) == 0:
            print("No Garmin credentials found for user")
            return None, None
            
        credentials = response.data[0]
        email = credentials.get('email')
        password = credentials.get('password')
        
        if not email or not password:
            print("Invalid credentials format - missing email or password")
            return None, None
            
        print(f"Found credentials with email: {email}")
        return email, password
    except Exception as e:
        print(f"Error fetching Garmin credentials: {str(e)}")
        print(f"Full error: {traceback.format_exc()}")
        return None, None

def direct_garmin_login(email, password):
    """
    Direct Garmin authentication that doesn't use the garminconnect package.
    Uses custom OAuth flow to get the necessary tokens.
    """
    print(f"\nInitializing direct Garmin authentication for {email}")
    
    # Create session with standard browser headers
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'origin': 'https://sso.garmin.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    })
    
    # Step 1: Get the login page to obtain CSRF token and cookies
    params = {
        'service': MODERN_URL,
        'webhost': MODERN_URL,
        'source': f"{MODERN_URL}/auth/login/",
        'redirectAfterAccountLoginUrl': MODERN_URL,
        'redirectAfterAccountCreationUrl': MODERN_URL,
        'gauthHost': SSO_URL,
        'locale': 'en_US',
        'id': 'gauth-widget',
        'cssUrl': 'https://connect.garmin.com/gauth-custom-v1.2-min.css',
        'clientId': 'GarminConnect',
        'rememberMeShown': 'true',
        'rememberMeChecked': 'false',
        'createAccountShown': 'true',
        'openCreateAccount': 'false',
        'displayNameShown': 'false',
        'consumeServiceTicket': 'false',
        'initialFocus': 'true',
        'embedWidget': 'false',
        'generateExtraServiceTicket': 'true',
        'generateTwoExtraServiceTickets': 'false',
        'generateNoServiceTicket': 'false',
        'globalOptInShown': 'true',
        'globalOptInChecked': 'false',
        'mobile': 'false',
        'connectLegalTerms': 'true',
        'showTermsOfUse': 'false',
        'showPrivacyPolicy': 'false',
        'showConnectLegalAge': 'false',
        'locationPromptShown': 'true',
        'showPassword': 'true',
        'useCustomHeader': 'false',
        'mfaRequired': 'false',
        'performMFACheck': 'false',
        'rememberMyBrowserShown': 'false',
        'rememberMyBrowserChecked': 'false'
    }
    
    try:
        print("Step 1: Fetching login page...")
        response = session.get(SIGNIN_URL, params=params)
        print(f"Login page status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Failed to load login page. Status: {response.status_code}")
            raise Exception("Failed to load Garmin login page")
            
        # Extract CSRF token and form action
        csrf_token = None
        match = re.search(r'<input type="hidden" name="_csrf" value="([^"]+)"', response.text)
        if match:
            csrf_token = match.group(1)
            print(f"Found CSRF token: {csrf_token[:10]}...")
        else:
            print("CSRF token not found in the login page")
            raise Exception("Could not find CSRF token in login page")
            
        # Step 2: Send login credentials
        print("Step 2: Submitting login form...")
        
        # Check if password needs encoding
        safe_password = password
        if any(c in password for c in ['@', '!', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '?', '/']):
            print(f"Password contains special characters, URL encoding it")
            safe_password = urllib.parse.quote_plus(password)
        
        # Form data for login
        form_data = {
            'username': email,
            'password': password,  # Using original password, not URL encoded
            '_csrf': csrf_token,
            'embed': 'true',
            'rememberme': 'on'
        }
        
        login_response = session.post(SIGNIN_URL, params=params, data=form_data)
        print(f"Login response status: {login_response.status_code}")
        
        if "success" in login_response.text.lower() or "ticket" in login_response.text.lower():
            print("Login successful! Found success or ticket in response.")
        else:
            print("Login appears to have failed.")
            print(f"Response excerpt: {login_response.text[:300]}...")
            raise Exception("Login authentication failed")
            
        # Extract ticket URL from the response if available
        ticket_url = None
        match = re.search(r'"(https://connect\.garmin\.com/modern\?ticket=.+?)"', login_response.text)
        if match:
            ticket_url = match.group(1)
            print(f"Found ticket URL: {ticket_url[:50]}...")
        else:
            print("No ticket URL found in the response, trying to continue anyway")
            
        # Step 3: Exchange the ticket for authentication
        if ticket_url:
            print("Step 3: Exchanging ticket for authentication...")
            response = session.get(ticket_url)
            print(f"Ticket exchange status: {response.status_code}")
            
        # Step 4: Verify authentication by fetching user profile
        print("Step 4: Verifying authentication...")
        profile_url = f"{MODERN_URL}/currentuser-service/user/info"
        profile_response = session.get(profile_url)
        
        if profile_response.status_code == 200:
            try:
                profile_data = profile_response.json()
                display_name = profile_data.get('displayName', 'Unknown')
                print(f"Authentication successful! User: {display_name}")
            except:
                print("Could not parse profile response as JSON, but continuing anyway")
        else:
            print(f"Profile request failed with status {profile_response.status_code}")
            print("Will try to continue with other API endpoints")
            
        # Return the authenticated session
        return session
    
    except Exception as e:
        print(f"Direct login failed with error: {str(e)}")
        print(f"Full error: {traceback.format_exc()}")
        raise Exception(f"Garmin authentication failed: {str(e)}")

def get_activities_by_date(session, start_date_str, end_date_str):
    """
    Get activities between start_date and end_date using the direct API.
    """
    print(f"Getting activities from {start_date_str} to {end_date_str}")
    
    # Format for the API request
    activities_url = f"{MODERN_URL}/activitylist-service/activities/search/between"
    params = {
        'startDate': start_date_str,
        'endDate': end_date_str,
        'limit': 1000  # Get a lot of activities at once
    }
    
    try:
        response = session.get(activities_url, params=params)
        
        if response.status_code != 200:
            print(f"Failed to get activities. Status: {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            return []
            
        activities = response.json()
        print(f"Found {len(activities)} activities")
        return activities
    except Exception as e:
        print(f"Error getting activities: {str(e)}")
        print(f"Full error: {traceback.format_exc()}")
        return []

def get_activity_details(session, activity_id):
    """
    Get detailed information for a specific activity.
    """
    print(f"Getting details for activity {activity_id}")
    
    details_url = f"{MODERN_URL}/activity-service/activity/{activity_id}/details"
    
    try:
        response = session.get(details_url)
        
        if response.status_code != 200:
            print(f"Failed to get activity details. Status: {response.status_code}")
            return None
            
        details = response.json()
        return details
    except Exception as e:
        print(f"Error getting activity details: {str(e)}")
        print(f"Full error: {traceback.format_exc()}")
        return None

def sync_garmin_data(user_id, start_date=None, is_first_sync=False):
    try:
        # Check for existing sync
        lock_key = f"sync_lock_{user_id}"
        lock_data = supabase.table('sync_locks')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()

        if lock_data.data:
            print(f"Sync already in progress for user {user_id}")
            return {
                'success': True,
                'message': 'Sync already in progress'
            }

        # Set lock
        try:
            supabase.table('sync_locks')\
                .insert({'user_id': user_id, 'timestamp': datetime.now().isoformat()})\
                .execute()
        except Exception as e:
            print(f"Error setting lock: {e}")
            pass

        try:
            print(f"\nStarting data sync for user ID: {user_id}")

            # Get credentials and initialize client
            email, password = get_garmin_credentials(supabase, user_id)
            if not email or not password:
                raise Exception("Missing or invalid Garmin credentials")
            
            print(f"Attempting to initialize Garmin client with credentials for {email}")
            print(f"Password length: {len(password) if password else 0} chars, first char: {password[0] if password else 'none'}")
                
            # Initialize client with new direct method
            try:
                session = direct_garmin_login(email, password)
                print("Successfully initialized Garmin client with direct authentication")
            except Exception as auth_err:
                print(f"Failed to initialize Garmin client: {str(auth_err)}")
                raise auth_err
            
            # Get activities and save them
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            elif start_date is None:
                # Default to 30 days ago if no start date specified
                start_date = datetime.now() - timedelta(days=30)

            # Get activities from Garmin
            activities = get_activities_by_date(
                session,
                start_date.strftime("%Y-%m-%d"),
                datetime.now().strftime("%Y-%m-%d")
            )

            print(f"Found {len(activities)} activities")

            # Create a complete date range
            end_date = datetime.now()
            date_range = pd.date_range(start=start_date, end=end_date, freq='D')
            daily_data = {date.strftime("%Y-%m-%d"): {
                'date': date,
                'trimp': 0,
                'activities': ['Rest day']
            } for date in date_range}

            # Process activities
            for activity in activities:
                try:
                    activity_id = activity.get('activityId')
                    if not activity_id:
                        print("Activity missing ID, skipping")
                        continue
                        
                    activity_name = activity.get('activityName', 'Unknown')

                    activity_details = get_activity_details(session, activity_id)
                    if not activity_details:
                        print(f"Could not get details for activity {activity_id}, skipping")
                        continue
                        
                    trimp = 0
                    if 'connectIQMeasurements' in activity_details:
                        for item in activity_details['connectIQMeasurements']:
                            if item.get('developerFieldNumber') == 4:
                                trimp = round(float(item.get('value', 0)), 1)
                                print(f"Found TRIMP value: {trimp}")

                    # Apply multiplier for Strength Training (both English and Polish names)
                    if activity_name in ['Strength Training', 'Siła']:
                        print(f"Applying 2x multiplier for strength training: {trimp} -> {trimp * 2}")
                        trimp = trimp * 2
                    
                    # Get the date from the activity start time
                    if 'startTimeLocal' in activity:
                        activity_date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                    elif 'startTimeGMT' in activity:
                        # If no local time, use GMT and adjust later if needed
                        activity_date = datetime.strptime(activity['startTimeGMT'], "%Y-%m-%d %H:%M:%S")
                    else:
                        print(f"Activity {activity_id} has no start time, skipping")
                        continue
                        
                    date_str = activity_date.strftime("%Y-%m-%d")
                    
                    # Make sure this date is in our date range
                    if date_str not in daily_data:
                        print(f"Activity date {date_str} not in our date range, skipping")
                        continue

                    if daily_data[date_str]['activities'] == ['Rest day']:
                        daily_data[date_str]['activities'] = []
                    
                    daily_data[date_str]['trimp'] += trimp
                    # Add each activity individually, without deduplication
                    daily_data[date_str]['activities'].append(activity_name)
                    print(f"Saved activity data for {date_str}")

                except Exception as e:
                    print(f"Error processing activity: {e}")
                    print(f"Full error: {traceback.format_exc()}")
                    continue

            # Save activity data with metrics in a single operation
            print("\nSaving data for all days:")
            processed_dates = []
            
            # Get all previous data to initialize metrics calculation
            all_data = supabase.table('garmin_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('date')\
                .execute()
                
            # Convert to DataFrame for metrics calculation
            if all_data.data:
                df = pd.DataFrame(all_data.data)
                df['date'] = pd.to_datetime(df['date'], format='ISO8601').dt.tz_localize(None)
                # Sort by date
                df = df.sort_values('date')
            else:
                df = pd.DataFrame(columns=['date', 'user_id', 'trimp', 'activity', 'atl', 'ctl', 'tsb'])
            
            # Determine if we need to set initial metrics (for first sync or missing metrics)
            need_initial_metrics = is_first_sync or len(df) == 0 or df.iloc[0]['atl'] is None
            
            # Add day before start date if needed for metrics calculation
            day_before_start = start_date - timedelta(days=1)
            day_before_str = day_before_start.strftime("%Y-%m-%d")
            
            # Initialize metrics if needed
            if need_initial_metrics:
                print(f"Setting initial metrics for day before start: {day_before_str}")
                # Check if we already have this day
                day_before_entry = df[df['date'] == pd.Timestamp(day_before_start)]
                
                if len(day_before_entry) == 0:
                    # Create entry for day before
                    initial_entry = {
                        'user_id': user_id,
                        'date': day_before_str,
                        'trimp': 0,
                        'activity': 'Rest day',
                        'atl': 50.0,
                        'ctl': 50.0,
                        'tsb': 0.0
                    }
                    
                    # Insert initial entry
                    supabase.table('garmin_data')\
                        .upsert(initial_entry, on_conflict='user_id,date')\
                        .execute()
                        
                    # Add to DataFrame for metrics calculation
                    day_before_row = pd.DataFrame([{
                        'date': pd.Timestamp(day_before_start),
                        'user_id': user_id,
                        'trimp': 0,
                        'activity': 'Rest day',
                        'atl': 50.0,
                        'ctl': 50.0,
                        'tsb': 0.0
                    }])
                    df = pd.concat([day_before_row, df], ignore_index=True)
                    df = df.sort_values('date')
                else:
                    # Update existing day before
                    idx = df[df['date'] == pd.Timestamp(day_before_start)].index[0]
                    df.at[idx, 'atl'] = 50.0
                    df.at[idx, 'ctl'] = 50.0
                    df.at[idx, 'tsb'] = 0.0
                    
                    # Update in database
                    supabase.table('garmin_data')\
                        .update({'atl': 50.0, 'ctl': 50.0, 'tsb': 0.0})\
                        .eq('user_id', user_id)\
                        .eq('date', day_before_str)\
                        .execute()
            
            # Now process each day, calculate and save both activity and metrics in one go
            for date_str, data in daily_data.items():
                print(f"\nProcessing date {date_str}:")
                print(f"- TRIMP: {data['trimp']}")
                print(f"- Activities: {data['activities']}")
                
                # Get existing data for this date if any
                existing = supabase.table('garmin_data')\
                    .select('*')\
                    .eq('user_id', user_id)\
                    .eq('date', data['date'].isoformat())\
                    .execute()
                
                # Track this date as processed
                processed_dates.append(data['date'].isoformat())
                
                # Determine activity data
                if existing.data and len(existing.data) > 0:
                    existing_data = existing.data[0]
                    existing_activities = existing_data.get('activity', '')
                    
                    # If there's activity data to update
                    if data['activities'] != ['Rest day'] or existing_activities == 'Rest day':
                        if existing_activities and existing_activities != 'Rest day' and data['activities'] != ['Rest day']:
                            # Combine activities from both entries (avoiding duplicates)
                            existing_list = existing_activities.split(', ')
                            existing_activity_set = set(existing_list)
                            new_activity_set = set(data['activities'])
                            combined_activities = list(existing_activity_set.union(new_activity_set))
                            
                            # Don't include 'Rest day' in the combined list
                            if 'Rest day' in combined_activities:
                                combined_activities.remove('Rest day')
                            
                            activity = ', '.join(combined_activities)
                            trimp = float(existing_data.get('trimp', 0)) + float(data['trimp'])
                        elif existing_activities == 'Rest day' and data['activities'] != ['Rest day']:
                            # Replace 'Rest day' with actual activities
                            activity = ', '.join(data['activities'])
                            trimp = float(data['trimp'])
                        elif data['activities'] == ['Rest day'] and existing_activities != 'Rest day':
                            # Keep existing activities (don't replace with Rest day)
                            activity = existing_activities
                            trimp = float(existing_data.get('trimp', 0))
                        else:
                            activity = existing_activities
                            trimp = float(existing_data.get('trimp', 0))
                    else:
                        activity = existing_activities
                        trimp = float(existing_data.get('trimp', 0))
                else:
                    # No existing data, use new activity data
                    activity = ', '.join(data['activities'])
                    trimp = float(data['trimp'])
                
                # Calculate metrics for this date
                # Look for previous day's metrics in our DataFrame
                prev_date = data['date'] - timedelta(days=1)
                prev_date_entry = df[df['date'] == prev_date]
                
                if len(prev_date_entry) > 0:
                    prev_atl = float(prev_date_entry.iloc[0]['atl']) if prev_date_entry.iloc[0]['atl'] is not None else 50.0
                    prev_ctl = float(prev_date_entry.iloc[0]['ctl']) if prev_date_entry.iloc[0]['ctl'] is not None else 50.0
                else:
                    # If no previous day, use default values
                    prev_atl = 50.0
                    prev_ctl = 50.0
                
                # Calculate new metrics
                atl = prev_atl + (trimp - prev_atl) / 7
                ctl = prev_ctl + (trimp - prev_ctl) / 42
                tsb = prev_ctl - prev_atl
                
                # Create complete entry with both activity and metrics
                complete_entry = {
                    'user_id': user_id,
                    'date': data['date'].isoformat(),
                    'trimp': trimp,
                    'activity': activity,
                    'atl': round(atl, 1),
                    'ctl': round(ctl, 1),
                    'tsb': round(tsb, 1)
                }
                
                # Upsert the complete entry
                supabase.table('garmin_data')\
                    .upsert(complete_entry, on_conflict='user_id,date')\
                    .execute()
                
                print(f"Saved data for {date_str}:")
                print(f"- TRIMP: {trimp}, Activity: {activity}")
                print(f"- Metrics: ATL={round(atl, 1)}, CTL={round(ctl, 1)}, TSB={round(tsb, 1)}")
                
                # Add this entry to our DataFrame for next day's calculations
                df = pd.concat([df, pd.DataFrame([{
                    'date': data['date'],
                    'user_id': user_id,
                    'trimp': trimp,
                    'activity': activity,
                    'atl': round(atl, 1),
                    'ctl': round(ctl, 1),
                    'tsb': round(tsb, 1)
                }])], ignore_index=True)
                df = df.drop_duplicates(subset=['date', 'user_id'], keep='last')
                df = df.sort_values('date')

            # Return the processed dates
            return {
                'success': True,
                'newActivities': len(daily_data),
                'processed_dates': processed_dates,
                'message': 'Activities and metrics saved in a single row per date'
            }

        finally:
            # Always remove lock at the end
            try:
                supabase.table('sync_locks')\
                    .delete()\
                    .eq('user_id', user_id)\
                    .execute()
            except Exception as e:
                print(f"Error removing lock: {e}")
                pass

    except Exception as e:
        print(f"Error syncing data: {e}")
        print(f"Full error: {traceback.format_exc()}")
        return {
            'success': False,
            'error': str(e)
        }

# For testing this script directly
if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
        days_back = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        
        start_date = datetime.now() - timedelta(days=days_back)
        is_first_sync = len(sys.argv) > 3 and sys.argv[3].lower() == 'true'
        
        print(f"Testing sync for user {user_id}, {days_back} days back, first sync: {is_first_sync}")
        result = sync_garmin_data(user_id, start_date, is_first_sync)
        print(f"Sync result: {result}")
    else:
        print("Usage: python direct_garmin_sync.py <user_id> [days_back] [is_first_sync]")
        print("Example: python direct_garmin_sync.py 123e4567-e89b-12d3-a456-426614174000 30 false") 