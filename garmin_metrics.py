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
            # Użyj pandas do parsowania daty
            date = pd.to_datetime(last_record['date']).date()
            return {
                'atl': last_record.get('atl', 50.0),
                'ctl': last_record.get('ctl', 50.0),
                'date': date
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
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=9)  # Zawsze bierzemy ostatnie 9 dni
        
        # Pobierz wszystkie rekordy z tego zakresu dat
        existing_records = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.strftime("%Y-%m-%d"))\
            .lte('date', end_date.strftime("%Y-%m-%d"))\
            .execute()
        
        # Stwórz mapę istniejących rekordów po dacie
        existing_map = {}
        last_metrics = {'atl': 50.0, 'ctl': 50.0}
        
        if existing_records.data:
            for record in existing_records.data:
                # Użyj pandas do parsowania daty
                date = pd.to_datetime(record['date']).date()
                date_str = date.strftime("%Y-%m-%d")
                existing_map[date_str] = record
                
            # Znajdź ostatnie wartości ATL/CTL przed start_date
            last_values = supabase.table('garmin_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .lt('date', start_date.strftime("%Y-%m-%d"))\
                .order('date', desc=True)\
                .limit(1)\
                .execute()
                
            if last_values.data:
                last_metrics = {
                    'atl': last_values.data[0].get('atl', 50.0),
                    'ctl': last_values.data[0].get('ctl', 50.0)
                }
        
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
            date_str = current_date.strftime("%Y-%m-%d")
            
            # Calculate new values
            trimp = day_data['trimp']
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            if trimp > 0:
                print(f"[Chart Update] {current_date} - TRIMP: {trimp}, ATL: {round(atl, 1)}, CTL: {round(ctl, 1)}, TSB: {round(tsb, 1)}")
            
            update_data = {
                'user_id': user_id,
                'date': date_str,
                'trimp': trimp,
                'activity': ', '.join(day_data['activities']),
                'atl': round(atl, 1),
                'ctl': round(ctl, 1),
                'tsb': round(tsb, 1)
            }
            
            # Sprawdź czy dane się zmieniły
            existing_record = existing_map.get(date_str)
            if not existing_record or \
               existing_record['trimp'] != trimp or \
               existing_record['atl'] != round(atl, 1) or \
               existing_record['ctl'] != round(ctl, 1):
                updates.append(update_data)
                print(f"[Chart Update] Data changed for {date_str}, will update")
            else:
                print(f"[Chart Update] No changes for {date_str}, skipping update")
            
            prev_atl = atl
            prev_ctl = ctl
            current_date += timedelta(days=1)
        
        # Update database only for changed records
        if updates:
            print(f"\n[Chart Update] Saving {len(updates)} changed records to database")
            for update in updates:
                try:
                    response = supabase.table('garmin_data')\
                        .upsert(update, on_conflict='user_id,date')\
                        .execute()
                except Exception as e:
                    print(f"[Chart Update] Error saving {update['date']}: {e}")
        else:
            print("\n[Chart Update] No changes to save")
        
        # Prepare chart data - use all records for consistent display
        all_dates = []
        all_trimps = []
        all_atl = []
        all_ctl = []
        all_tsb = []
        
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            record = existing_map.get(date_str)
            
            # Jeśli rekord został zaktualizowany, użyj nowych wartości
            for update in updates:
                if update['date'] == date_str:
                    record = update
                    break
            
            if record:
                all_dates.append(date_str)
                all_trimps.append(record['trimp'])
                all_atl.append(record['atl'])
                all_ctl.append(record['ctl'])
                all_tsb.append(record['tsb'])
            
            current_date += timedelta(days=1)
        
        chart_data = {
            'dates': all_dates,
            'trimps': all_trimps,
            'atl': all_atl,
            'ctl': all_ctl,
            'tsb': all_tsb
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