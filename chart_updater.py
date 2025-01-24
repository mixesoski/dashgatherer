from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase
from garminconnect import Garmin
from typing import Dict, Any, Optional

def get_last_metrics(user_id: str, before_date: datetime) -> Optional[Dict[str, float]]:
    """Get the last ATL/CTL values before a given date"""
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

def calculate_metrics(df: pd.DataFrame, last_metrics: Optional[Dict[str, float]] = None) -> pd.DataFrame:
    """Calculate ATL, CTL and TSB metrics"""
    if last_metrics:
        prev_atl = last_metrics['atl']
        prev_ctl = last_metrics['ctl']
    else:
        prev_atl = 50.0  # Default starting values
        prev_ctl = 50.0

    metrics = []
    for _, row in df.iterrows():
        trimp = float(row['trimp'])
        
        # Calculate new metrics
        atl = prev_atl + (trimp - prev_atl) / 7  # 7-day decay
        ctl = prev_ctl + (trimp - prev_ctl) / 42  # 42-day decay
        tsb = ctl - atl  # Training Stress Balance
        
        metrics.append({
            'date': row['date'],
            'trimp': trimp,
            'activity': row['activity'],
            'atl': round(atl, 1),
            'ctl': round(ctl, 1),
            'tsb': round(tsb, 1)
        })
        
        prev_atl = atl
        prev_ctl = ctl
    
    return pd.DataFrame(metrics)

def update_chart_data(user_id: str) -> Dict[str, Any]:
    """Main function to update chart data"""
    try:
        # Get Garmin credentials
        creds = supabase.table('garmin_credentials')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
        
        if not creds.data:
            return {
                'success': False,
                'error': 'No Garmin credentials found'
            }

        # Initialize dates
        end_date = datetime.now()
        start_date = end_date - timedelta(days=10)

        # Get existing data from Supabase
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.isoformat())\
            .lte('date', end_date.isoformat())\
            .execute()

        existing_dates = {row['date'] for row in existing_data.data} if existing_data.data else set()

        # Initialize Garmin client
        client = Garmin(creds.data[0]['email'], creds.data[0]['password'])
        client.login()

        # Get activities from Garmin
        activities = client.get_activities_by_date(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )

        # Process activities
        daily_data = {}
        for activity in activities:
            try:
                activity_date = datetime.strptime(activity['startTimeLocal'], "%Y-%m-%d %H:%M:%S")
                date_str = activity_date.strftime("%Y-%m-%d")
                
                if date_str not in daily_data:
                    daily_data[date_str] = {
                        'date': date_str,
                        'trimp': 0,
                        'activities': []
                    }

                activity_id = activity['activityId']
                activity_name = activity.get('activityName', 'Unknown')
                
                # Get TRIMP from activity details
                details = client.get_activity(activity_id)
                trimp = 0
                if 'connectIQMeasurements' in details:
                    for item in details['connectIQMeasurements']:
                        if item['developerFieldNumber'] == 4:
                            trimp = round(float(item['value']), 1)
                
                # Double TRIMP for strength training
                if activity_name in ['Strength Training', 'Siła']:
                    trimp *= 2

                daily_data[date_str]['trimp'] += trimp
                daily_data[date_str]['activities'].append(activity_name)

            except Exception as e:
                print(f"Error processing activity: {e}")
                continue

        # Convert to DataFrame
        if daily_data:
            df = pd.DataFrame(daily_data.values())
            df['activity'] = df['activities'].apply(lambda x: ', '.join(x))
            df = df.drop('activities', axis=1)
            
            # Get last metrics for calculation
            last_metrics = get_last_metrics(user_id, start_date)
            
            # Calculate metrics
            df_with_metrics = calculate_metrics(df, last_metrics)
            
            # Update database
            new_activities = 0
            for _, row in df_with_metrics.iterrows():
                if row['date'] not in existing_dates:
                    metrics_data = {
                        'user_id': user_id,
                        'date': row['date'],
                        'trimp': float(row['trimp']),
                        'activity': row['activity'],
                        'atl': float(row['atl']),
                        'ctl': float(row['ctl']),
                        'tsb': float(row['tsb'])
                    }
                    
                    supabase.table('garmin_data')\
                        .upsert(metrics_data, on_conflict='user_id,date')\
                        .execute()
                    new_activities += 1

            return {
                'success': True,
                'newActivities': new_activities
            }
        
        return {
            'success': True,
            'newActivities': 0
        }

    except Exception as e:
        print(f"Error updating chart data: {e}")
        return {
            'success': False,
            'error': str(e)
        } 