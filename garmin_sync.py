from garminconnect import Garmin
import pandas as pd
from datetime import datetime, timedelta
import time
from requests.exceptions import HTTPError
from garth.exc import GarthHTTPError
from supabase_client import supabase, get_garmin_credentials
from metrics_calculator import calculate_metrics

def sync_garmin_data(user_id, start_date=None):
    try:
        print(f"\nStarting data sync for user ID: {user_id}")
        
        # Check if this is first sync for user
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('date', desc=True)\
            .execute()
        
        is_first_sync = len(existing_data.data) == 0
        print(f"Is first sync: {is_first_sync}")

        # Get credentials and initialize client
        email, password = get_garmin_credentials(user_id)
        client = Garmin(email, password)
        client.login()
        print("Login successful!")

        # Get dates range
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            start_date = start_date.replace(tzinfo=None)
        else:
            start_date = end_date - timedelta(days=9)

        # Get activities from Garmin
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )
        print(f"Found {len(activities)} new activities")

        # Process activities
        daily_data = {}
        for activity in activities:
            try:
                activity_id = activity['activityId']
                activity_name = activity.get('activityName', 'Unknown')
                activity_type = activity.get('activityType', {}).get('typeKey', '').lower()
                
                activity_details = client.get_activity(activity_id)
                trimp = 0
                if 'connectIQMeasurements' in activity_details:
                    for item in activity_details['connectIQMeasurements']:
                        if item['developerFieldNumber'] == 4:
                            trimp = round(float(item['value']), 1)
                            # Apply multiplier for strength training
                            if 'strength' in activity_type or 'training' in activity_type:
                                trimp *= 2
                                print(f"Applied x2 multiplier for strength training")
                
                date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                date_str = date.strftime("%Y-%m-%d")
                
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        'date': date.replace(hour=12),
                        'trimp': 0,
                        'activities': []
                    }
                
                daily_data[date_str]['trimp'] += trimp
                daily_data[date_str]['activities'].append(activity_name)
                print(f"Added TRIMP {trimp} for {date_str} - {activity_name}")
                
                time.sleep(1)  # Rate limiting
            except Exception as e:
                print(f"Error processing activity: {e}")
                continue

        # Sort days chronologically
        sorted_days = sorted(daily_data.keys())
        
        # For first sync, set initial values
        if is_first_sync and sorted_days:
            first_day = sorted_days[0]
            data = daily_data[first_day]
            first_date = data['date']
            
            # Set initial metrics for first record
            activity_data = {
                'user_id': user_id,
                'date': first_date.isoformat(),
                'trimp': float(data['trimp']),
                'activity': ', '.join(data['activities']),
                'atl': 50,
                'ctl': 50,
                'tsb': 0
            }
            
            try:
                # Save first record with initial values
                response = supabase.table('garmin_data')\
                    .upsert(activity_data, 
                           on_conflict='user_id,date')\
                    .execute()
                print(f"Set initial metrics for {first_day} - ATL: 50.0, CTL: 50.0, TSB: 0.0")
                
                # Calculate metrics for remaining days starting from the day after first record
                if len(sorted_days) > 1:
                    calc_start_date = first_date + timedelta(days=1)
                    result = calculate_metrics(user_id, calc_start_date)
                    if not result['success']:
                        return result
                    
            except Exception as e:
                print(f"Error setting initial metrics: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }
        else:
            # If not first sync, calculate metrics for the entire range
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            result = calculate_metrics(user_id, start_date)
            if not result['success']:
                return result

        return {
            'success': True,
            'newActivities': len(daily_data)
        }

    except Exception as e:
        print(f"Error syncing data: {e}")
        return {
            'success': False,
            'error': str(e)
        } 