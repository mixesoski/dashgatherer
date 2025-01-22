from garminconnect import Garmin
from datetime import datetime
from garth.exc import GarthHTTPError
from supabase_client import supabase, get_garmin_credentials

def sync_garmin_data(user_id, start_date=None):
    try:
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

        # Process activities
        daily_data = {}
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
                
                date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                date_str = date.strftime("%Y-%m-%d")
                
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        'date': date,
                        'trimp': 0,
                        'activities': []
                    }
                
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