from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectConnectionError, GarminConnectTooManyRequestsError
import pandas as pd
from datetime import datetime, timedelta
import time
from requests.exceptions import HTTPError
import garth
from garth.exc import GarthHTTPError
from supabase_client import supabase, get_garmin_credentials
import traceback
import sys
import os

# Print environment information for debugging
print(f"Python version: {sys.version}")
print(f"Running on: {sys.platform}")
print(f"Working directory: {os.getcwd()}")

# Print package versions
try:
    import pkg_resources
    garminconnect_version = pkg_resources.get_distribution("garminconnect").version
    print(f"Installed garminconnect version: {garminconnect_version}")
    garth_version = pkg_resources.get_distribution("garth").version
    print(f"Installed garth version: {garth_version}")
except Exception as e:
    print(f"Error getting package versions: {e}")

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

def test_raw_garmin_login(email, password):
    """Test raw Garmin login without any error handling to see raw exceptions"""
    print(f"\n===== DIAGNOSTIC: Testing raw Garmin login for {email} =====")
    try:
        # Direct API client creation
        print("Creating raw Garmin client...")
        import inspect
        print(f"Garmin constructor signature: {inspect.signature(Garmin.__init__)}")
        
        raw_client = Garmin(email, password)
        print("Raw client created successfully")
        
        # Try login directly
        print("Attempting raw login...")
        raw_client.login()
        print("Raw login successful")
        
        return True
    except Exception as e:
        print(f"Raw login test failed with error: {str(e)}")
        print(f"Raw error type: {type(e)}")
        print(f"Raw error traceback: {traceback.format_exc()}")
        return False

def initialize_garmin_client(email, password):
    print(f"\nInitializing Garmin client for {email}")
    try:
        # Create API client with basic initialization
        print("Initializing GarminConnect client...")
        print("Debugging Garmin constructor...")
        
        # Add URL encoding for special characters in password
        import urllib.parse
        safe_password = password
        if any(c in password for c in ['@', '!', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '?', '/']):
            print("Password contains special characters - applying URL encoding")
            safe_password = urllib.parse.quote_plus(password)
        
        try:
            # Test raw login first for diagnostic purposes
            test_raw_garmin_login(email, safe_password)
        except Exception as test_err:
            print(f"Raw login test generated exception: {str(test_err)}")
            # Continue with regular flow
        
        # Try direct authentication through cookies approach
        print("\nTrying manual cookie-based authentication...")
        try:
            import requests
            import json
            from http.cookiejar import LWPCookieJar
            
            session = requests.Session()
            
            # Setup session with proper headers
            session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'origin': 'https://sso.garmin.com',
                'nk': 'NT'
            })
            
            # First get the SSO page to collect initial cookies
            sso_url = "https://sso.garmin.com/sso/signin"
            print(f"Fetching initial SSO page: {sso_url}")
            
            params = {
                'service': 'https://connect.garmin.com/modern',
                'webhost': 'https://connect.garmin.com/modern',
                'source': 'https://connect.garmin.com/signin',
                'redirectAfterAccountLoginUrl': 'https://connect.garmin.com/modern',
                'redirectAfterAccountCreationUrl': 'https://connect.garmin.com/modern',
                'gauthHost': 'https://sso.garmin.com/sso',
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
                'locationPromptShown': 'true',
                'showPassword': 'true'
            }
            
            print("Sending initial request...")
            response = session.get(sso_url, params=params)
            print(f"Initial response status: {response.status_code}")
            
            if response.status_code != 200:
                print("Initial SSO page request failed")
                print(f"Error body: {response.text[:200]}...")
                raise Exception("Failed to load Garmin login page")
            
            # Now attempt the actual login
            print("Preparing login request...")
            payload = {
                'username': email,
                'password': safe_password,
                'embed': 'false',
                'rememberme': 'on'  # Keep the session alive longer
            }
            
            login_url = "https://sso.garmin.com/sso/signin"
            print(f"Sending login request to: {login_url}")
            
            login_response = session.post(login_url, params=params, data=payload)
            print(f"Login response status: {login_response.status_code}")
            
            if login_response.status_code != 200:
                print("Login request failed")
                print(f"Error body: {login_response.text[:200]}...")
                raise Exception("Failed to login to Garmin Connect")
            
            # Check if login was successful by looking for ticket in response
            if "ticket" not in login_response.text:
                print("No ticket found in response, login likely failed")
                print(f"Response excerpt: {login_response.text[:200]}...")
                raise Exception("Login authentication failed - no ticket found")
            
            print("Login appears successful, found ticket in response")
            
            # Use the existing client but with our authenticated session
            garmin_client = Garmin(email, password, session=session)
            print("Created Garmin client with authenticated session")
            
            return garmin_client
            
        except Exception as cookie_err:
            print(f"Cookie-based authentication failed: {str(cookie_err)}")
            print(f"Full error: {traceback.format_exc()}")
            print("Falling back to regular client initialization...")
        
        # Fall back to regular client creation
        garmin_client = Garmin(email, password)
        
        print("Attempting Garmin login...")
        try:
            # Try to get user info first to verify credentials
            print(f"Calling get_user_summary with date: {datetime.now().strftime('%Y-%m-%d')}")
            garmin_client.get_user_summary(datetime.now().strftime("%Y-%m-%d"))
            print("Successfully logged into Garmin using get_user_summary")
        except Exception as e:
            print(f"Failed to get user info: {str(e)}")
            print(f"Full error from get_user_summary: {traceback.format_exc()}")
            print("Falling back to regular login method...")
            try:
                # If that fails, try the regular login
                garmin_client.login()
                print("Successfully logged into Garmin with regular login")
            except Exception as login_err:
                print(f"Regular login also failed: {str(login_err)}")
                print(f"Full error from regular login: {traceback.format_exc()}")
                raise login_err
        
        return garmin_client
        
    except GarminConnectAuthenticationError as err:
        print(f"Authentication failed for {email}")
        print(f"Error details: {str(err)}")
        print(f"Error type: {type(err)}")
        print(f"Full authentication error traceback: {traceback.format_exc()}")
        print(f"Please verify your Garmin credentials at https://connect.garmin.com")
        print(f"Check if your account has 2FA enabled or if you need to sign in to Garmin Connect first manually")
        raise Exception(f"Garmin authentication failed: {str(err)}")
    except GarminConnectTooManyRequestsError as err:
        print(f"Too many requests error for {email}")
        print(f"Error details: {str(err)}")
        raise Exception(f"Too many requests to Garmin API: {str(err)}")
    except GarminConnectConnectionError as err:
        print(f"Connection error for {email}")
        print(f"Error details: {str(err)}")
        raise Exception(f"Garmin connection error: {str(err)}")
    except Exception as err:
        print(f"Unknown error during Garmin login: {str(err)}")
        print(f"Full error: {traceback.format_exc()}")
        raise Exception(f"Error logging into Garmin: {str(err)}")

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
                
            # Initialize client with new method
            try:
                client = initialize_garmin_client(email, password)
                print("Successfully initialized Garmin client")
            except Exception as auth_err:
                print(f"Failed to initialize Garmin client: {str(auth_err)}")
                print(f"Garmin API version: {Garmin.__version__ if hasattr(Garmin, '__version__') else 'unknown'}")
                raise auth_err
            
            # Get activities and save them
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', ''))

            # Get activities from Garmin
            activities = client.get_activities_by_date(
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
                    activity_id = activity['activityId']
                    activity_name = activity.get('activityName', 'Unknown')

                    activity_details = client.get_activity(activity_id)
                    trimp = 0
                    if 'connectIQMeasurements' in activity_details:
                        for item in activity_details['connectIQMeasurements']:
                            if item['developerFieldNumber'] == 4:
                                trimp = round(float(item['value']), 1)

                    # Apply multiplier for Strength Training (both English and Polish names)
                    if activity_name in ['Strength Training', 'Siła']:
                        print(f"Applying 2x multiplier for strength training: {trimp} -> {trimp * 2}")
                        trimp = trimp * 2
                    
                    date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                    date_str = date.strftime("%Y-%m-%d")

                    if daily_data[date_str]['activities'] == ['Rest day']:
                        daily_data[date_str]['activities'] = []
                    
                    daily_data[date_str]['trimp'] += trimp
                    # Add each activity individually, without deduplication
                    daily_data[date_str]['activities'].append(activity_name)
                    print(f"Saved activity data for {date_str}")

                except Exception as e:
                    print(f"Error processing activity: {e}")
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
        return {
            'success': False,
            'error': str(e)
        }
