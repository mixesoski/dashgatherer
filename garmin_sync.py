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
        except:
            pass

        try:
            print(f"\nStarting data sync for user ID: {user_id}")
            
            # Check if this is first sync for user (no ATL/CTL values)
            existing_metrics = supabase.table('garmin_data')\
                .select('atl,ctl')\
                .eq('user_id', user_id)\
                .not_('atl', 'is', 'null')\
                .not_('ctl', 'is', 'null')\
                .limit(1)\
                .execute()
            
            is_first_sync = len(existing_metrics.data) == 0
            print(f"Is first sync: {is_first_sync}")

            # Get credentials and initialize client
            email, password = get_garmin_credentials(user_id)
            client = Garmin(email, password)
            client.login()

            # Get activities and save them
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            
            # Limit the date range if not first sync
            if not is_first_sync and start_date < (datetime.now() - timedelta(days=30)):
                start_date = datetime.now() - timedelta(days=30)
                
            print(f"Fetching activities from {start_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}")
            
            # Get activities from Garmin
            activities = client.get_activities_by_date(
                start_date.strftime("%Y-%m-%d"),
                datetime.now().strftime("%Y-%m-%d")
            )
            
            print(f"Found {len(activities)} activities")

            # Process activities
            daily_data = {}
            
            # Create a date range from start_date to today
            current_date = start_date
            while current_date <= datetime.now():
                date_str = current_date.strftime("%Y-%m-%d")
                daily_data[date_str] = {
                    'date': current_date,
                    'trimp': 0,
                    'activities': ['Rest day']
                }
                current_date += timedelta(days=1)

            # Now process actual activities
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
                    
                    # Apply multiplier for Strength Training
                    strength_training_names = ['Siła', 'Trening siłowy', 'Strength Training', 'strength_training']
                    if any(name.lower() in activity_name.lower().strip() for name in strength_training_names):
                        trimp = trimp * 2
                    
                    date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                    date_str = date.strftime("%Y-%m-%d")
                    
                    # Update existing day data
                    if date_str in daily_data:
                        if daily_data[date_str]['activities'] == ['Rest day']:
                            daily_data[date_str]['activities'] = []
                        daily_data[date_str]['trimp'] += trimp
                        daily_data[date_str]['activities'].append(activity_name)
                    
                except Exception as e:
                    print(f"Error processing activity: {e}")
                    continue

            # Save activity data
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
                except Exception as e:
                    print(f"Error saving activity data: {e}")
                    continue

            # Calculate metrics using sync_metrics_calculator
            metrics_result = calculate_sync_metrics(user_id, start_date, is_first_sync=is_first_sync)
            
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
            except:
                pass

    except Exception as e:
        print(f"Error syncing data: {e}")
        return {
            'success': False,
            'error': str(e)
        } 