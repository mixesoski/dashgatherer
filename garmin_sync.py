from garminconnect import Garmin
import pandas as pd
from datetime import datetime, timedelta
import time
from requests.exceptions import HTTPError
from garth.exc import GarthHTTPError
from supabase_client import supabase, get_garmin_credentials
import traceback

def get_garmin_credentials(supabase_client, user_id):
    print(f"Fetching Garmin credentials for user {user_id}")
    try:
        response = supabase_client.table('garmin_credentials').select('*').eq('user_id', user_id).execute()
        print(f"Credential response: {response}")
        
        if not response.data or len(response.data) == 0:
            print("No Garmin credentials found for user")
            return None, None
            
        credentials = response.data[0]
        print(f"Found credentials with email: {credentials.get('email')}")
        return credentials.get('email'), credentials.get('password')
    except Exception as e:
        print(f"Error fetching Garmin credentials: {str(e)}")
        print(f"Full error: {traceback.format_exc()}")
        return None, None

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
            print("Fetching Garmin credentials...")
            email, password = get_garmin_credentials(supabase, user_id)
            print(f"Found credentials for email: {email}")
            
            print("Initializing Garmin client...")
            client = Garmin(email, password)
            
            print("Attempting to login to Garmin...")
            try:
                client.login()
                print("Successfully logged into Garmin")
            except Exception as e:
                print(f"Failed to login to Garmin: {str(e)}")
                print(f"Full error: {traceback.format_exc()}")
                raise Exception(f"Error logging into Garmin: {str(e)}")

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
