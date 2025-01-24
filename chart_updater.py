from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from supabase_client import supabase
from garminconnect import Garmin
from typing import Dict, Any, Optional

def get_last_metrics(user_id: str, before_date: datetime) -> Optional[Dict[str, float]]:
    """Pobiera ostatnie metryki przed podaną datą"""
    result = supabase.table('garmin_data')\
        .select('atl, ctl')\
        .eq('user_id', user_id)\
        .lt('date', before_date.isoformat())\
        .order('date', desc=True)\
        .limit(1)\
        .execute()
    
    if result.data:
        return {
            'atl': float(result.data[0]['atl']) if result.data[0]['atl'] is not None else 50.0,
            'ctl': float(result.data[0]['ctl']) if result.data[0]['ctl'] is not None else 50.0
        }
    return None

def calculate_metrics(df: pd.DataFrame, last_metrics: Optional[Dict[str, float]]) -> pd.DataFrame:
    """Oblicza metryki z zachowaniem ciągłości historycznej"""
    if last_metrics:
        prev_atl = last_metrics['atl']
        prev_ctl = last_metrics['ctl']
    else:
        # Jeśli brak historycznych danych, użyj pierwszego TRIMP lub wartości domyślnej
        first_trimp = float(df['trimp'].iloc[0]) if not df.empty else 50.0
        prev_atl = first_trimp
        prev_ctl = first_trimp

    metrics = []
    for _, row in df.sort_values('date').iterrows():
        trimp = float(row['trimp'])
        
        # Oblicz nowe metryki
        atl = prev_atl + (trimp - prev_atl) / 7
        ctl = prev_ctl + (trimp - prev_ctl) / 42
        tsb = ctl - atl
        
        # Upewnij się, że wartości nie są NaN
        atl = 50.0 if np.isnan(atl) else atl
        ctl = 50.0 if np.isnan(ctl) else ctl
        tsb = 0.0 if np.isnan(tsb) else tsb
        
        metrics.append({
            'date': row['date'],
            'trimp': trimp,
            'activity': row['activity'],
            'atl': round(float(atl), 1),
            'ctl': round(float(ctl), 1),
            'tsb': round(float(tsb), 1)
        })
        
        prev_atl = atl
        prev_ctl = ctl
    
    return pd.DataFrame(metrics)

def update_chart_data(user_id: str) -> Dict[str, Any]:
    """Aktualizuje dane z gwarancją unikalności dat"""
    try:
        # Pobierz dane uwierzytelniające
        creds = supabase.table('garmin_credentials')\
            .select('*')\
            .eq('user_id', user_id)\
            .single()\
            .execute()
        
        if not creds.data:
            return {
                'success': False,
                'error': 'Nie znaleziono danych uwierzytelniających'
            }
        
        # Pobierz istniejące daty z bazy
        existing_data = supabase.table('garmin_data')\
            .select('date')\
            .eq('user_id', user_id)\
            .execute()
        
        existing_dates = {row['date'] for row in existing_data.data} if existing_data.data else set()
        
        # Inicjalizacja klienta Garmin
        client = Garmin(creds.data['email'], creds.data['password'])
        client.login()

        # Pobierz wszystkie aktywności z ostatniego miesiąca (możemy później rozszerzyć)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)  # Na początek sprawdzamy miesiąc
        
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"), 
            end_date.strftime("%Y-%m-%d")
        )
        
        # Agreguj dane dzienne
        daily_data = {}
        for activity in activities:
            try:
                date_str = datetime.strptime(
                    activity['startTimeLocal'], 
                    "%Y-%m-%d %H:%M:%S"
                ).strftime("%Y-%m-%d")
                
                # Pomijamy daty które już mamy
                if date_str in existing_dates:
                    continue
                
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        'trimp': 0.0,
                        'activities': []
                    }

                # Pobierz TRIMP
                details = client.get_activity(activity['activityId'])
                trimp = next((
                    float(item['value']) 
                    for item in details.get('connectIQMeasurements', []) 
                    if item['developerFieldNumber'] == 4
                ), 0.0)

                # Modyfikator dla treningu siłowego
                if activity.get('activityName') in ['strength_training', 'Strength Training', 'Siła']:
                    trimp *= 2

                daily_data[date_str]['trimp'] += trimp
                daily_data[date_str]['activities'].append(activity.get('activityName', 'Unknown'))

            except Exception as e:
                print(f"Błąd przetwarzania aktywności: {e}")
                continue

        if not daily_data:
            return {
                'success': True,
                'updated': 0,
                'message': 'Brak nowych aktywności'
            }

        # Przygotuj DataFrame
        df = pd.DataFrame([{
            'date': date,
            'trimp': data['trimp'],
            'activity': ', '.join(data['activities'])
        } for date, data in daily_data.items()])

        # Oblicz metryki
        last_metrics = get_last_metrics(user_id, start_date)
        df_metrics = calculate_metrics(df, last_metrics)

        # Zapisz dane z użyciem UPSERT
        updated_count = 0
        for _, record in df_metrics.iterrows():
            try:
                supabase.table('garmin_data').upsert({
                    'user_id': user_id,
                    'date': record['date'],
                    'trimp': float(record['trimp']),
                    'activity': record['activity'],
                    'atl': float(record['atl']),
                    'ctl': float(record['ctl']),
                    'tsb': float(record['tsb'])
                }, on_conflict='user_id,date').execute()
                updated_count += 1
            except Exception as e:
                print(f"Błąd zapisywania danych dla {record['date']}: {e}")
                continue

        return {
            'success': True,
            'updated': updated_count,
            'dates': df_metrics['date'].tolist()
        }

    except Exception as e:
        print(f"Błąd aktualizacji danych: {e}")
        return {
            'success': False,
            'error': str(e)
        }