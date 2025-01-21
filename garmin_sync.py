from garminconnect import Garmin
import pandas as pd
from datetime import datetime, timedelta
import time
from requests.exceptions import HTTPError
from garth.exc import GarthHTTPError
from supabase_client import supabase, get_garmin_credentials

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
        
        # Calculate and update metrics
        prev_atl = 50 if is_first_sync else float(existing_data.data[0]['atl'])
        prev_ctl = 50 if is_first_sync else float(existing_data.data[0]['ctl'])
        
        for day in sorted_days:
            data = daily_data[day]
            trimp = float(data['trimp'])
            
            # For first record in first sync, use initial values
            if is_first_sync and day == sorted_days[0]:
                atl = 50
                ctl = 50
                tsb = 0
            else:
                # Calculate new values
                atl = prev_atl + (trimp - prev_atl) / 7
                ctl = prev_ctl + (trimp - prev_ctl) / 42
                tsb = ctl - atl
            
            # Update database
            activity_data = {
                'user_id': user_id,
                'date': data['date'].isoformat(),
                'trimp': trimp,
                'activity': ', '.join(data['activities']),
                'atl': round(float(atl), 1),
                'ctl': round(float(ctl), 1),
                'tsb': round(float(tsb), 1)
            }
            
            try:
                response = supabase.table('garmin_data')\
                    .upsert(activity_data, 
                           on_conflict='user_id,date')\
                    .execute()
                print(f"Updated {day} - ATL: {atl:.1f}, CTL: {ctl:.1f}, TSB: {tsb:.1f}")
            except Exception as e:
                print(f"Error updating {day}: {e}")
            
            # Update previous values for next iteration
            prev_atl = atl
            prev_ctl = ctl

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