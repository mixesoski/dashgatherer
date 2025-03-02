
from garminconnect import Garmin
import pandas as pd
from datetime import datetime, timedelta
import time
from requests.exceptions import HTTPError
from garth.exc import GarthHTTPError
from supabase_client import supabase, get_garmin_credentials
from sync_metrics_calculator import calculate_sync_metrics

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
            email, password = get_garmin_credentials(user_id)
            client = Garmin(email, password)
            client.login()

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

            # Save activity data
            print("\nSaving data for all days:")
            for date_str, data in daily_data.items():
                activity_data = {
                    'user_id': user_id,
                    'date': data['date'].isoformat(),
                    'trimp': float(data['trimp']),
                    'activity': ', '.join(data['activities'])
                }

                try:
                    # Get existing data for this date if any
                    existing = supabase.table('garmin_data')\
                        .select('*')\
                        .eq('user_id', user_id)\
                        .eq('date', data['date'].isoformat())\
                        .execute()
                    
                    if existing.data and len(existing.data) > 0:
                        existing_data = existing.data[0]
                        existing_activities = existing_data.get('activity', '')
                        
                        # If existing data has activities and it's not just "Rest day"
                        if existing_activities and existing_activities != 'Rest day' and data['activities'] != ['Rest day']:
                            # Combine existing activities with new ones
                            existing_list = existing_activities.split(', ')
                            combined_activities = existing_list + data['activities']
                            # Don't remove duplicates - preserve all entries
                            activity_data['activity'] = ', '.join(combined_activities)
                            activity_data['trimp'] = float(existing_data.get('trimp', 0)) + float(data['trimp'])
                    
                    supabase.table('garmin_data')\
                        .upsert(activity_data, on_conflict='user_id,date')\
                        .execute()
                    print(f"Saved data for {date_str} - TRIMP: {activity_data['trimp']}, Activity: {activity_data['activity']}")
                except Exception as e:
                    print(f"Error saving activity data for {date_str}: {e}")
                    continue

            # Calculate metrics
            print("\n=== CALCULATING METRICS ===")
            print(f"Date range: {start_date.date()} to {datetime.now().date()}")
            metrics_result = calculate_sync_metrics(user_id, start_date, is_first_sync)

            return {
                'success': True,
                'newActivities': len(daily_data),
                'metrics': metrics_result
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
