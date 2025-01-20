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

        print(f"\n=== CALCULATING METRICS ===")
        print(f"Date range: {start_date.date()} to {end_date.date()}")

        # Get initial metrics from previous day
        nine_days_ago = start_date - timedelta(days=1)
        print(f"\nGetting initial metrics from {nine_days_ago.date()}")
        
        initial_metrics = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('date', nine_days_ago.isoformat())\
            .execute()

        if initial_metrics.data:
            initial_atl = float(initial_metrics.data[0]['atl'] or 0)
            initial_ctl = float(initial_metrics.data[0]['ctl'] or 0)
            print(f"Found initial metrics - ATL: {initial_atl:.1f}, CTL: {initial_ctl:.1f}")
        else:
            # Only use defaults if no previous data exists at all
            any_data = supabase.table('garmin_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .limit(1)\
                .execute()
            
            if any_data.data:
                initial_atl = 0
                initial_ctl = 0
                print("No previous day data, but user has history - using zeros")
            else:
                initial_atl = 50
                initial_ctl = 50
                print("New user - using default values")

        # Get existing data
        existing_response = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.isoformat())\
            .lte('date', end_date.isoformat())\
            .order('date')\
            .execute()

        if not existing_response.data:
            print("No data found in date range")
            return {
                'success': False,
                'error': 'No data found in date range'
            }

        print(f"\nFound {len(existing_response.data)} records to update")

        # Calculate metrics
        prev_atl = initial_atl
        prev_ctl = initial_ctl
        updates = []
        
        for record in existing_response.data:
            trimp = float(record['trimp'] or 0)
            date = record['date']
            
            # Calculate new values
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            updates.append({
                'user_id': user_id,
                'date': date,
                'atl': round(float(atl), 1),
                'ctl': round(float(ctl), 1),
                'tsb': round(float(tsb), 1)
            })
            
            prev_atl = atl
            prev_ctl = ctl

        # Batch update all records
        try:
            for update in updates:
                response = supabase.table('garmin_data')\
                    .update({
                        'atl': update['atl'],
                        'ctl': update['ctl'],
                        'tsb': update['tsb']
                    })\
                    .eq('user_id', update['user_id'])\
                    .eq('date', update['date'])\
                    .execute()
                print(f"Updated metrics for {update['date']}")
        except Exception as e:
            print(f"Error updating metrics: {e}")
            return {
                'success': False,
                'error': str(e)
            }

        return {
            'success': True,
            'message': f'Updated metrics for {len(updates)} records'
        }

    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            'success': False,
            'error': str(e)
        } 