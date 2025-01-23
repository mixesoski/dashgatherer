from datetime import datetime, timedelta
import math
from supabase_client import supabase
from garminconnect import Garmin
import logging

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO)

def get_historical_metrics(user_id, before_date):
    """Pobiera ostatnie metryki sprzed podanej daty"""
    result = supabase.table('garmin_data')\
        .select('atl, ctl')\
        .eq('user_id', user_id)\
        .lt('date', before_date.isoformat())\
        .order('date', desc=True)\
        .limit(1)\
        .execute()
    
    return result.data[0] if result.data else None

def calculate_metrics(user_id, activity_data, start_date, end_date):
    """Oblicza metryki w oparciu o historyczne dane"""
    metrics = []
    current_date = start_date
    
    # Pobierz ostatnie metryki sprzed okresu
    historical_data = get_historical_metrics(user_id, start_date)
    
    # Jeżeli brak historii, zaczynamy od pierwszego dnia z aktywnością
    if not historical_data:
        first_day_data = next(
            (v for k, v in sorted(activity_data.items()) if k >= start_date),
            None
        )
        
        if not first_day_data:
            return metrics  # Brak danych do obliczeń
            
        prev_atl = first_day_data['trimp']
        prev_ctl = first_day_data['trimp']
        start_calculating = False
    else:
        prev_atl = historical_data['atl']
        prev_ctl = historical_data['ctl']
        start_calculating = True

    while current_date <= end_date:
        daily_data = activity_data.get(current_date, {'trimp': 0.0, 'activities': ['Rest day']})
        date_str = current_date.isoformat()
        
        if not start_calculating:
            # Szukaj pierwszego dnia z aktywnością do inicjalizacji
            if daily_data['trimp'] > 0:
                prev_atl = daily_data['trimp']
                prev_ctl = daily_data['trimp']
                start_calculating = True
            else:
                current_date += timedelta(days=1)
                continue

        # Obliczenia
        atl = prev_atl + (daily_data['trimp'] - prev_atl) / 7
        ctl = prev_ctl + (daily_data['trimp'] - prev_ctl) / 42
        tsb = ctl - atl
        
        # Zabezpieczenie przed NaN
        atl = round(atl, 1) if not math.isnan(atl) else 0.0
        ctl = round(ctl, 1) if not math.isnan(ctl) else 0.0
        tsb = round(tsb, 1) if not math.isnan(tsb) else 0.0
        
        metrics.append({
            'user_id': user_id,
            'date': date_str,
            'trimp': round(daily_data['trimp'], 1),
            'activity': ', '.join(daily_data['activities']),
            'atl': atl,
            'ctl': ctl,
            'tsb': tsb
        })
        
        prev_atl = atl
        prev_ctl = ctl
        current_date += timedelta(days=1)
    
    return metrics

def sync_garmin_data(user_id, email, password):
    """Główna funkcja synchronizująca"""
    try:
        api = init_garmin_api(email, password)
        if not api:
            return {'success': False, 'error': 'Błąd połączenia z Garmin'}
        
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=9)
        
        # Przetwórz aktywności
        activity_data = process_activities(api, start_date, end_date)
        
        # Oblicz metryki
        calculated_metrics = calculate_metrics(user_id, activity_data, start_date, end_date)
        
        # Aktualizacja bazy
        if calculated_metrics:
            response = supabase.table('garmin_data').upsert(
                calculated_metrics,
                on_conflict='user_id,date',
                returning='minimal'
            ).execute()
            
            logging.info(f"Upsert response: {response}")
        
        return {'success': True, 'updated': len(calculated_metrics)}
    
    except Exception as e:
        logging.error(f"Błąd synchronizacji: {str(e)}")
        return {'success': False, 'error': str(e)}

def update_chart_data(user_id, email, password):
    """Główna funkcja aktualizująca dane wykresu"""
    try:
        # Inicjalizacja API Garmin
        api = init_garmin_api(email, password)
        if not api:
            return {'success': False, 'error': 'Błąd autentykacji Garmin'}

        # Okres danych (ostatnie 10 dni)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=9)

        # Synchronizacja i przeliczenie metryk
        result = sync_garmin_data(user_id, email, password)
        
        if not result['success']:
            return result

        # Pobierz zaktualizowane dane dla wykresu
        chart_data = get_chart_data(user_id, start_date, end_date)
        
        return {
            'success': True,
            'data': chart_data,
            'updated': result['updated']
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}

def get_chart_data(user_id, start_date, end_date):
    """Pobiera dane dla wykresu z bazy danych"""
    records = supabase.table('garmin_data')\
        .select('date, trimp, atl, ctl, tsb')\
        .eq('user_id', user_id)\
        .gte('date', start_date.isoformat())\
        .lte('date', end_date.isoformat())\
        .order('date', asc=True)\
        .execute()

    return {
        'dates': [rec['date'] for rec in records.data],
        'trimp': [rec['trimp'] for rec in records.data],
        'atl': [rec['atl'] for rec in records.data],
        'ctl': [rec['ctl'] for rec in records.data],
        'tsb': [rec['tsb'] for rec in records.data]
    }