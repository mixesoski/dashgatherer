from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase

def calculate_metrics(user_id, start_date=None):
    try:
        # Get dates range
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            start_date = start_date.replace(tzinfo=None)
        else:
            start_date = end_date - timedelta(days=9)

        # Get initial metrics
        nine_days_ago = start_date - timedelta(days=1)
        initial_metrics = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('date', nine_days_ago.isoformat())\
            .execute()

        if initial_metrics.data:
            initial_atl = initial_metrics.data[0]['atl']
            initial_ctl = initial_metrics.data[0]['ctl']
        else:
            initial_atl = 50
            initial_ctl = 50

        # Get existing data
        existing_response = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.isoformat())\
            .lte('date', end_date.isoformat())\
            .order('date')\
            .execute()

        # Calculate metrics
        prev_atl = initial_atl
        prev_ctl = initial_ctl
        
        for record in existing_response.data:
            trimp = record['trimp']
            
            # Calculate new values
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            # Update database
            try:
                response = supabase.table('garmin_data')\
                    .update({
                        'atl': round(float(atl), 1),
                        'ctl': round(float(ctl), 1),
                        'tsb': round(float(tsb), 1)
                    })\
                    .eq('user_id', user_id)\
                    .eq('date', record['date'])\
                    .execute()
                print(f"Updated metrics for {record['date']}")
            except Exception as e:
                print(f"Error updating metrics: {e}")
            
            prev_atl = atl
            prev_ctl = ctl

        return {
            'success': True,
            'message': 'Metrics updated successfully'
        }

    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            'success': False,
            'error': str(e)
        } 