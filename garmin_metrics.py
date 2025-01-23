from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase
from garminconnect import Garmin

def init_garmin_api(email, password):
    """Initialize Garmin API with credentials."""
    try:
        garmin = Garmin(email=email, password=password, is_cn=False)
        garmin.login()
        print("Garmin API initialized successfully.")
        return garmin
    except Exception as err:
        print("Error initializing Garmin API:", err)
        return None

def get_last_metrics(user_id):
    """Get the last ATL and CTL values from the database."""
    try:
        result = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('date', desc=True)\
            .limit(1)\
            .execute()
        
        if result.data:
            last_record = result.data[0]
            date_str = last_record['date'].split('T')[0]  # Get just the date part
            return {
                'atl': last_record.get('atl', 50.0),
                'ctl': last_record.get('ctl', 50.0),
                'date': datetime.strptime(date_str, "%Y-%m-%d").date()
            }
        return {'atl': 50.0, 'ctl': 50.0, 'date': None}
    except Exception as e:
        print(f"Error getting last metrics: {e}")
        return {'atl': 50.0, 'ctl': 50.0, 'date': None}

def process_garmin_activities(api, start_date, end_date):
    """Process Garmin activities and calculate TRIMP values."""
    activities = api.get_activities_by_date(start_date, end_date, sortorder='asc')
    print(f"[Chart Update] Found {len(activities)} activities")
    
    activity_data = {}
    for activity in activities:
        activity_id = activity.get("activityId")
        activity_details = api.get_activity(activity_id)
        
        if 'connectIQMeasurements' in activity_details:
            trimp = 0
            for item in activity_details['connectIQMeasurements']:
                if item['developerFieldNumber'] == 4:
                    trimp = round(float(item['value']), 1)
                    break
            
            if activity_details['activityTypeDTO']['typeKey'] == 'strength_training':
                print(f"[Chart Update] Applying 2x multiplier for strength training: {trimp} -> {trimp * 2}")
                trimp = trimp * 2
            
            # Uproszczone przetwarzanie daty - bierzemy tylko datę bez czasu i strefy
            activity_date = datetime.strptime(
                activity_details['summaryDTO']['startTimeLocal'].split('T')[0],
                "%Y-%m-%d"
            ).date()
            
            activity_name = activity_details['activityName']
            
            if activity_date not in activity_data:
                activity_data[activity_date] = {'trimp': 0, 'activities': []}
            
            activity_data[activity_date]['trimp'] += trimp
            activity_data[activity_date]['activities'].append(activity_name)
    
    return activity_data

def update_chart_data(user_id, email, password):
    """Update chart data with new activities and recalculate metrics."""
    try:
        print(f"\n[Chart Update] Starting for user_id: {user_id}")
        
        # Initialize Garmin API
        api = init_garmin_api(email, password)
        if not api:
            return {'success': False, 'error': 'Failed to initialize Garmin API'}
        
        # Get last metrics and determine date range
        last_metrics = get_last_metrics(user_id)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=9)
        
        if last_metrics['date']:
            start_date = min(start_date, last_metrics['date'])
        
        print(f"[Chart Update] Processing date range: {start_date} to {end_date}")
        print(f"[Chart Update] Starting from - ATL: {last_metrics['atl']}, CTL: {last_metrics['ctl']}")
        
        # Get activities from Garmin
        activity_data = process_garmin_activities(api, start_date, end_date)
        
        # Calculate metrics for all days
        updates = []
        current_date = start_date
        prev_atl = last_metrics['atl']
        prev_ctl = last_metrics['ctl']
        
        while current_date <= end_date:
            day_data = activity_data.get(current_date, {'trimp': 0, 'activities': ['Rest day']})
            
            # Calculate new values
            trimp = day_data['trimp']
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            if trimp > 0:
                print(f"[Chart Update] {current_date} - TRIMP: {trimp}, ATL: {round(atl, 1)}, CTL: {round(ctl, 1)}, TSB: {round(tsb, 1)}")
            
            updates.append({
                'user_id': user_id,
                'date': current_date.strftime("%Y-%m-%d"),  # Tylko data bez czasu
                'trimp': trimp,
                'activity': ', '.join(day_data['activities']),
                'atl': round(atl, 1),
                'ctl': round(ctl, 1),
                'tsb': round(tsb, 1)
            })
            
            prev_atl = atl
            prev_ctl = ctl
            current_date += timedelta(days=1)
        
        # Update database
        print(f"\n[Chart Update] Saving {len(updates)} records to database")
        for update in updates:
            try:
                response = supabase.table('garmin_data')\
                    .upsert(update, on_conflict='user_id,date')\
                    .execute()
            except Exception as e:
                print(f"[Chart Update] Error saving {update['date']}: {e}")
        
        # Prepare chart data
        chart_data = {
            'dates': [u['date'] for u in updates],  # Już jest w formacie YYYY-MM-DD
            'trimps': [u['trimp'] for u in updates],
            'atl': [u['atl'] for u in updates],
            'ctl': [u['ctl'] for u in updates],
            'tsb': [u['tsb'] for u in updates]
        }
        
        print("[Chart Update] Complete")
        return {
            'success': True,
            'data': chart_data
        }
        
    except Exception as e:
        print(f"\n[Chart Update] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        } 