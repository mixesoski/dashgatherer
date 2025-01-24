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
        first_trimp = float(df['trimp'].iloc[0]) if not df.empty else 50.0
        prev_atl = first_trimp
        prev_ctl = first_trimp

    metrics = []
    for _, row in df.sort_values('date').iterrows():
        trimp = float(row['trimp'])
        
        atl = prev_atl + (trimp - prev_atl) / 7
        ctl = prev_ctl + (trimp - prev_ctl) / 42
        tsb = ctl - atl
        
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
        # Get credentials
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
        
        # Define date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=10)
        
        # Get existing data for the date range
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.date().isoformat())\
            .lte('date', end_date.date().isoformat())\
            .execute()

        # Create a dictionary of existing dates with their data
        existing_dates = {
            record['date'].split('T')[0]: record 
            for record in existing_data.data
        }
        
        # If we have all dates in range, return early
        all_dates = pd.date_range(start=start_date.date(), end=end_date.date(), freq='D')
        all_dates_str = [date.strftime('%Y-%m-%d') for date in all_dates]
        
        if all(date in existing_dates for date in all_dates_str):
            return {
                'success': True,
                'updated': 0,
                'message': 'All dates already exist in database'
            }

        # Connect to Garmin
        client = Garmin(creds.data['email'], creds.data['password'])
        client.login()

        # Get activities from Garmin
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"), 
            end_date.strftime("%Y-%m-%d")
        )
        
        if not activities:
            return {
                'success': True,
                'updated': 0,
                'message': 'No new activities found'
            }

        # Process activities only for dates that don't exist
        daily_data = {}
        for activity in activities:
            try:
                activity_date = datetime.strptime(
                    activity['startTimeLocal'], 
                    "%Y-%m-%d %H:%M:%S"
                ).date()
                date_str = activity_date.isoformat()
                
                # Skip if we already have data for this date
                if date_str in existing_dates:
                    continue
                
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        'trimp': 0.0,
                        'activities': []
                    }

                details = client.get_activity(activity['activityId'])
                trimp = next((
                    float(item['value']) 
                    for item in details.get('connectIQMeasurements', []) 
                    if item['developerFieldNumber'] == 4
                ), 0.0)

                if activity.get('activityName') in ['strength_training', 'Strength Training', 'Siła']:
                    trimp *= 2

                daily_data[date_str]['trimp'] += trimp
                daily_data[date_str]['activities'].append(activity.get('activityName', 'Unknown'))

            except Exception as e:
                print(f"Error processing activity: {e}")
                continue

        if not daily_data:
            return {
                'success': True,
                'updated': 0,
                'message': 'No new activities to process'
            }

        # Calculate metrics only for new dates
        df = pd.DataFrame([{
            'date': date,
            'trimp': data['trimp'],
            'activity': ', '.join(data['activities'])
        } for date, data in daily_data.items()])

        metrics_df = calculate_metrics(df, get_last_metrics(user_id, start_date))
        
        # Update daily_data with calculated metrics
        for _, record in metrics_df.iterrows():
            date_str = record['date']
            daily_data[date_str].update({
                'atl': record['atl'],
                'ctl': record['ctl'],
                'tsb': record['tsb']
            })

        # Save only new data
        updated_count = 0
        for date_str, data in daily_data.items():
            try:
                record = {
                    'user_id': user_id,
                    'date': date_str,
                    'trimp': float(data['trimp']),
                    'activity': ', '.join(data['activities']),
                    'atl': float(data['atl']),
                    'ctl': float(data['ctl']),
                    'tsb': float(data['tsb'])
                }

                supabase.table('garmin_data')\
                    .upsert(record, on_conflict='user_id,date')\
                    .execute()
                updated_count += 1
            except Exception as e:
                print(f"Error saving data for {date_str}: {e}")
                continue

        return {
            'success': True,
            'updated': updated_count,
            'message': f'Successfully updated {updated_count} new dates'
        }

    except Exception as e:
        print(f"Error updating data: {e}")
        return {
            'success': False,
            'error': str(e)
        }