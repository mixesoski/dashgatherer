from datetime import datetime, timedelta
import pandas as pd
import math
from decimal import Decimal
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
            date = pd.to_datetime(last_record['date']).date()
            return {
                'atl': float(last_record.get('atl', 50.0)) if last_record.get('atl') else 50.0,
                'ctl': float(last_record.get('ctl', 50.0)) if last_record.get('ctl') else 50.0,
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
            trimp = Decimal('0.0')
            for item in activity_details['connectIQMeasurements']:
                if item['developerFieldNumber'] == 4:
                    trimp = Decimal(item['value']).quantize(Decimal('0.0'))
                    break
            
            if activity_details['activityTypeDTO']['typeKey'] == 'strength_training':
                print(f"[Chart Update] Applying 2x multiplier for strength training: {trimp} -> {trimp * 2}")
                trimp *= 2
            
            start_time = activity_details['summaryDTO']['startTimeLocal']
            date_part = start_time.split('T')[0]
            activity_date = datetime.strptime(date_part, "%Y-%m-%d").date()
            activity_name = activity_details['activityName']
            
            if activity_date not in activity_data:
                activity_data[activity_date] = {'trimp': Decimal('0.0'), 'activities': set()}
            
            activity_data[activity_date]['trimp'] += trimp
            activity_data[activity_date]['activities'].add(activity_name)
    
    # Konwersja Decimal na float i set na list
    return {
        date: {
            'trimp': float(trimp_data['trimp']),
            'activities': list(trimp_data['activities'])
        }
        for date, trimp_data in activity_data.items()
    }

def update_chart_data(user_id, email, password):
    """Update chart data with new activities and recalculate metrics."""
    try:
        print(f"\n[Chart Update] Starting for user_id: {user_id}")
        
        api = init_garmin_api(email, password)
        if not api:
            return {'success': False, 'error': 'Failed to initialize Garmin API'}
        
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=9)
        
        # Pobierz istniejące rekordy
        existing_records = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.isoformat())\
            .lte('date', end_date.isoformat())\
            .execute()
        
        existing_map = {rec['date']: rec for rec in existing_records.data}
        
        # Pobierz ostatnie metryki
        last_metrics = get_last_metrics(user_id)
        print(f"Last metrics: ATL={last_metrics['atl']}, CTL={last_metrics['ctl']}")
        
        # Pobierz aktywności
        activity_data = process_garmin_activities(api, start_date, end_date)
        
        updates = []
        current_date = start_date
        prev_atl = Decimal(str(last_metrics['atl']))
        prev_ctl = Decimal(str(last_metrics['ctl']))
        
        while current_date <= end_date:
            date_str = current_date.isoformat()
            day_data = activity_data.get(current_date, {'trimp': 0.0, 'activities': ['Rest day']})
            
            # Obliczenia z Decimal
            trimp = Decimal(str(day_data['trimp']))
            atl = prev_atl + (trimp - prev_atl) / Decimal('7')
            ctl = prev_ctl + (trimp - prev_ctl) / Decimal('42')
            tsb = prev_ctl - prev_atl
            
            # Formatowanie wyników
            format_decimal = lambda x: float(x.quantize(Decimal('0.00')))
            atl_val = format_decimal(atl)
            ctl_val = format_decimal(ctl)
            tsb_val = format_decimal(tsb)
            
            update_data = {
                'user_id': user_id,
                'date': date_str,
                'trimp': float(trimp.quantize(Decimal('0.00'))),
                'activity': ', '.join(day_data['activities']),
                'atl': atl_val,
                'ctl': ctl_val,
                'tsb': tsb_val
            }
            
            # Sprawdź czy potrzebna aktualizacja
            existing = existing_map.get(date_str)
            needs_update = not existing or any([
                not math.isclose(existing.get('trimp', 0), update_data['trimp'], rel_tol=1e-9),
                not math.isclose(existing.get('atl', 0), update_data['atl'], rel_tol=1e-9),
                not math.isclose(existing.get('ctl', 0), update_data['ctl'], rel_tol=1e-9),
                not math.isclose(existing.get('tsb', 0), update_data['tsb'], rel_tol=1e-9)
            ])
            
            if needs_update:
                updates.append(update_data)
                print(f"[Update] {date_str}: TRIMP={update_data['trimp']}, ATL={atl_val}, CTL={ctl_val}")
            
            prev_atl = atl
            prev_ctl = ctl
            current_date += timedelta(days=1)
        
        # Zapis do bazy
        if updates:
            print(f"\nSaving {len(updates)} updates to database")
            response = supabase.table('garmin_data').upsert(
                updates,
                returning='minimal',
                on_conflict='user_id,date'
            ).execute()
            
            if hasattr(response, 'error') and response.error:
                print(f"Database error: {response.error}")
        
        return {'success': True, 'updated': len(updates)}
    
    except Exception as e:
        print(f"Critical error: {str(e)}")
        return {'success': False, 'error': str(e)}