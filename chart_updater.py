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

def update_chart_data(self):
    """
    Update a single chart entry with associated metrics and prevent duplicate date issues.
    
    Args:
        self: an instance of the class (likely a `SmartChart` or similar)
        
    Returns:
        A dictionary containing updated data including count of updates and dates array
    """
    df = pd.DataFrame()
    max_date = None
    
    # Get last metrics without triggering update to avoid duplicating existing entries
    last_metrics = self.get_last_metrics(max_date or None)
    
    # Calculate metrics based on aggregated data from last known date to current maximum
    start_date = max_date if max_date is not None else pd.Timestamp.now().date() - timedelta(days=30)
    daily_data = {}
    
    for _, record in df_metrics.iterrows():
        try:
            supabase.table('garmin_data').upsert({
                'user_id': self.user_id,
                'date': record['date'],
                'trimp': float(record['trimp']),
                'activity': ', '.join(list(record['activities'])),
                'atl': float(record['atl']),
                'ctl': float(record['ctl']),
                'tsb': float(record['tsb'])
            }, on_conflict='user_id,date').execute()
            updated_count += 1
        except Exception as e:
            print(f"Błąd zapisywania danych dla {record['date']}: {e}")
            continue
    
    if not daily_data:
        return {
            'success': True,
            'updated': 0,
            'message': 'Brak nowych aktywności'
        }

    max_date = pd.Timestamp.now().date()
    
    # Check for any duplicate dates and adjust to the last known date
    duplicates_dates = df['date'].unique()
    if len(duplicates_dates) > 1:
        # Find the last occurrence of the maximum date
        adjusted_date = max(date for date in duplicates_dates if date == max_date)
        print(f"Adjusted date: {adjusted_date}")
        
        df = df.sort_values('date').tail(1)
        daily_data = {}
        
    daily_data_dates = sorted(df['date'])
    
    df = pd.DataFrame([{
        'date': day,
        'trimp': float(record['trimp']),
        'activity': ', '.join(record['activities']), 
        'atl': float(record['atl']),
        'ctl': float(record['ctl']),
        'tsb': float(record['tsb'])
    } for day, record in zip(daily_data_dates, daily_data.items()) if day != max_date]
    
    last_metrics = self.get_last_metrics(max_date or None)
    df_metrics = self.calculate_metrics(df, last_metrics)
    
    # Prepare updated data
    updated = {}
    for _, record in df_metrics.iterrows():
        try:
            supabase.table('garmin_data').upsert({
                'user_id': self.user_id,
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
    
    if not daily_data:
        return {
            'success': True,
            'updated': updated_count,
            'message': f'Braknow nowych aktywności'
        }
    
    return {
        'success': True,
        'data': [{'date': str(date), 'trimp': float(record['trimp']), 
                   'activity': record['activity'], 'atl': float(record['atl']),
                   'ctl': float(record['ctl']), 'tsb': float(record['tsb'])}
                  for date, record in zip(daily_data_dates, daily_data.items()) if date != max_date],
        'count': updated_count,
        'message': f' updates: {updated_count}, dates array: {list(daily_data_dates)}'
    }
