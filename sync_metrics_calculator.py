from datetime import datetime, timedelta
from supabase_client import supabase
import pandas as pd

def calculate_sync_metrics(user_id, start_date=None, is_first_sync=False):
    try:
        # Get dates range
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', ''))
            start_date = start_date.replace(tzinfo=None)
        else:
            start_date = end_date - timedelta(days=9)

        print(f"\n=== CALCULATING METRICS ===")
        print(f"Date range: {start_date.date()} to {end_date.date()}")

        # Get ALL historical data for this user
        all_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('date')\
            .execute()

        if not all_data.data:
            print("No data found for user")
            return {
                'success': False,
                'message': 'No data found'
            }

        # Convert to DataFrame and sort by date
        df = pd.DataFrame(all_data.data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')

        # Initialize first row with default values if it's first sync
        if is_first_sync:
            print("First sync detected - setting initial values ATL=50, CTL=50")
            df.at[df.index[0], 'atl'] = 50.0
            df.at[df.index[0], 'ctl'] = 50.0
            df.at[df.index[0], 'tsb'] = 0.0

        # Calculate metrics for each subsequent row
        for i in range(1, len(df)):
            prev_row = df.iloc[i-1]
            curr_row = df.iloc[i]
            
            trimp = float(curr_row['trimp'])
            prev_atl = float(prev_row['atl']) if prev_row['atl'] is not None else 0.0
            prev_ctl = float(prev_row['ctl']) if prev_row['ctl'] is not None else 0.0
            
            # Calculate new metrics
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            df.at[df.index[i], 'atl'] = round(atl, 1)
            df.at[df.index[i], 'ctl'] = round(ctl, 1)
            df.at[df.index[i], 'tsb'] = round(tsb, 1)

        # Update database
        for _, row in df.iterrows():
            metrics_data = {
                'user_id': user_id,
                'date': row['date'].isoformat(),
                'trimp': float(row['trimp']),
                'activity': row.get('activity', 'Rest day'),
                'atl': round(float(row['atl']), 1),
                'ctl': round(float(row['ctl']), 1),
                'tsb': round(float(row['tsb']), 1)
            }
            
            try:
                supabase.table('garmin_data')\
                    .upsert(metrics_data, on_conflict='user_id,date')\
                    .execute()
                print(f"Updated {row['date']} - ATL: {metrics_data['atl']}, CTL: {metrics_data['ctl']}, TSB: {metrics_data['tsb']}")
            except Exception as e:
                print(f"Error updating metrics for {row['date']}: {e}")

        return {
            'success': True,
            'message': f'Updated metrics for {len(df)} days'
        }

    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            'success': False,
            'error': str(e)
        } 