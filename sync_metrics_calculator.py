from datetime import datetime, timedelta
from supabase_client import supabase
import pandas as pd

def calculate_sync_metrics(user_id, start_date=None, is_first_sync=False, processed_dates=None):
    try:
        # Get dates range
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            if isinstance(start_date, str):
                # Użyj pandas z format='ISO8601' do obsługi różnych formatów ISO
                start_date = pd.to_datetime(start_date, format='ISO8601').to_pydatetime()
            start_date = start_date.replace(tzinfo=None)
        else:
            start_date = end_date - timedelta(days=9)

        # Always add the day before the start date to initialize values
        day_before_start = start_date - timedelta(days=1)
        
        print(f"\n=== CALCULATING METRICS ===")
        print(f"Actual date range: {day_before_start.date()} to {end_date.date()}")
        print(f"User-selected date range: {start_date.date()} to {end_date.date()}")

        # Convert processed_dates to a set for faster lookup
        if processed_dates is None:
            processed_dates = []
        processed_dates_set = set(processed_dates)

        # Get ALL historical data for this user
        all_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('date')\
            .execute()

        if not all_data.data:
            print("No data found for user")
            # Even with no data, we'll create our own dataset with initial values
            empty_df = pd.DataFrame({
                'date': pd.date_range(start=day_before_start.date(), end=end_date.date(), freq='D'),
                'user_id': user_id,
                'trimp': 0,
                'activity': 'Rest day',
                'atl': None,
                'ctl': None,
                'tsb': None
            })
            # Set initial values for the day before start
            empty_df.loc[empty_df['date'] == pd.Timestamp(day_before_start.date()), 'atl'] = 50.0
            empty_df.loc[empty_df['date'] == pd.Timestamp(day_before_start.date()), 'ctl'] = 50.0
            empty_df.loc[empty_df['date'] == pd.Timestamp(day_before_start.date()), 'tsb'] = 0.0
            df = empty_df
        else:
            # Convert to DataFrame and handle dates with ISO8601 format
            df = pd.DataFrame(all_data.data)
            df['date'] = pd.to_datetime(df['date'], format='ISO8601').dt.tz_localize(None)
            
            # Remove duplicate date entries - keep the entry with highest TRIMP
            # This ensures we don't have both "Rest day" and active entries for the same day
            df = df.sort_values(['date', 'trimp'], ascending=[True, False])
            df = df.drop_duplicates(subset=['date'], keep='first')
            
            # Create a complete date range including the day before start
            date_range = pd.date_range(start=day_before_start.date(), end=end_date.date(), freq='D')
            complete_df = pd.DataFrame(date_range, columns=['date'])
            
            # Merge with existing data, filling missing days with zero TRIMP
            df = pd.merge(complete_df, df, on='date', how='left')
            df['trimp'] = df['trimp'].fillna(0)
            df['activity'] = df['activity'].fillna('Rest day')
            df['user_id'] = user_id
            df = df.sort_values('date')

            # Check if we have the day before start date
            day_before_in_df = df[df['date'] == pd.Timestamp(day_before_start.date())]
            if len(day_before_in_df) > 0:
                # If the day before exists but has no metrics, set them to 50/50
                if day_before_in_df.iloc[0]['atl'] is None or pd.isna(day_before_in_df.iloc[0]['atl']):
                    idx = df[df['date'] == pd.Timestamp(day_before_start.date())].index[0]
                    df.at[idx, 'atl'] = 50.0
                    df.at[idx, 'ctl'] = 50.0
                    df.at[idx, 'tsb'] = 0.0
                    print(f"Setting initial values for existing day before start: {day_before_start.date()}")
            else:
                # This should not happen with our merge logic above, but just in case
                print(f"Warning: Day before start date {day_before_start.date()} not found in DataFrame")

        # Always ensure the day before has ATL=50, CTL=50 metrics if it's a first sync
        # or if we don't have previous metrics
        if is_first_sync or df.loc[df['date'] == pd.Timestamp(day_before_start.date()), 'atl'].iloc[0] is None:
            print(f"Setting initial metrics for day before start: {day_before_start.date()}")
            day_before_idx = df[df['date'] == pd.Timestamp(day_before_start.date())].index[0]
            df.at[day_before_idx, 'atl'] = 50.0
            df.at[day_before_idx, 'ctl'] = 50.0 
            df.at[day_before_idx, 'tsb'] = 0.0

        # Calculate metrics for each day, starting after the day before start
        first_idx = df[df['date'] == pd.Timestamp(day_before_start.date())].index[0]
        
        print(f"Starting metric calculations with initial values: ATL={df.iloc[first_idx]['atl']}, CTL={df.iloc[first_idx]['ctl']}")
        
        for i in range(first_idx + 1, len(df)):
            prev_row = df.iloc[i-1]
            curr_row = df.iloc[i]
            
            # Ensure we have numeric values for calculations
            prev_atl = float(prev_row['atl']) if prev_row['atl'] is not None and not pd.isna(prev_row['atl']) else 50.0
            prev_ctl = float(prev_row['ctl']) if prev_row['ctl'] is not None and not pd.isna(prev_row['ctl']) else 50.0
            trimp = float(curr_row['trimp']) if curr_row['trimp'] is not None and not pd.isna(curr_row['trimp']) else 0.0
            
            # Calculate new metrics
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            df.at[df.index[i], 'atl'] = round(atl, 1)
            df.at[df.index[i], 'ctl'] = round(ctl, 1)
            df.at[df.index[i], 'tsb'] = round(tsb, 1)

        # Get only the rows from the original requested start date onward for updating
        update_df = df[df['date'] >= pd.Timestamp(start_date.date())]
        
        print(f"Calculated metrics for {len(update_df)} days")
        print(f"First day: {update_df.iloc[0]['date'].date()} - ATL: {update_df.iloc[0]['atl']}, CTL: {update_df.iloc[0]['ctl']}, TSB: {update_df.iloc[0]['tsb']}")
        
        # Update database - but skip dates that were already processed by garmin_sync.py
        metrics_updates = []
        for _, row in update_df.iterrows():
            date_str = row['date'].strftime("%Y-%m-%d")
            date_iso = row['date'].isoformat()
            
            # Skip if this date was already processed in garmin_sync.py
            if date_iso in processed_dates_set:
                print(f"Skipping already processed date: {date_str}")
                continue
                
            metrics_data = {
                'user_id': user_id,
                'date': date_str,
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
                print(f"Updated {date_str} - ATL: {metrics_data['atl']}, CTL: {metrics_data['ctl']}, TSB: {metrics_data['tsb']}")
                metrics_updates.append(date_str)
            except Exception as e:
                print(f"Error updating metrics for {date_str}: {e}")

        return {
            'success': True,
            'message': f'Updated metrics for {len(metrics_updates)} days'
        }

    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            'success': False,
            'error': str(e)
        } 