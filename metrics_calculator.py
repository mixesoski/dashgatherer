from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase

def calculate_metrics(user_id, start_date=None):
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

        # Get existing data from database
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()

        # Convert to DataFrame
        df = pd.DataFrame(existing_data.data)
        if not df.empty:
            # Handle ISO8601 dates with milliseconds
            df['date'] = pd.to_datetime(df['date'], format='ISO8601').dt.tz_localize(None)
            df = df.sort_values('date')

            # Get the earliest date with data
            earliest_date = df['date'].min()
            if earliest_date:
                # Use the earliest date as the start date for calculations
                start_date = min(start_date, earliest_date)

        # Create complete date range
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Find new dates that need to be added
        if not df.empty:
            # Convert dates to date-only strings for comparison (ignore time)
            existing_dates = set(df['date'].dt.date.astype(str))
            new_dates = [d for d in date_range if d.date().isoformat() not in existing_dates]
            
            if new_dates:
                print(f"Found {len(new_dates)} new dates to add")
                # Add new dates with zero TRIMP
                for date in new_dates:
                    new_data = {
                        'user_id': user_id,
                        'date': date.isoformat(),
                        'trimp': 0,
                        'activity': 'Rest day'
                    }
                    supabase.table('garmin_data')\
                        .insert(new_data)\
                        .execute()
                
                # Refresh data after adding new dates
                existing_data = supabase.table('garmin_data')\
                    .select('*')\
                    .eq('user_id', user_id)\
                    .execute()
                df = pd.DataFrame(existing_data.data)
                df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)
        else:
            # If no data exists, create initial dataset
            print("No existing data found, creating initial dataset")
            for date in date_range:
                new_data = {
                    'user_id': user_id,
                    'date': date.isoformat(),
                    'trimp': 0,
                    'activity': 'Rest day'
                }
                supabase.table('garmin_data')\
                    .insert(new_data)\
                    .execute()
            
            # Get the newly created data
            existing_data = supabase.table('garmin_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .execute()
            df = pd.DataFrame(existing_data.data)
            df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)

        # Sort and calculate metrics
        df = df.sort_values('date')
        
        # Initialize first row
        df.iloc[0, df.columns.get_loc('atl')] = 50.0
        df.iloc[0, df.columns.get_loc('ctl')] = 50.0
        df.iloc[0, df.columns.get_loc('tsb')] = 0.0

        # Calculate metrics for each subsequent row
        for i in range(1, len(df)):
            prev_row = df.iloc[i-1]
            curr_row = df.iloc[i]
            
            trimp = float(curr_row['trimp']) if curr_row['trimp'] is not None else 0.0
            prev_atl = float(prev_row['atl']) if prev_row['atl'] is not None else 50.0
            prev_ctl = float(prev_row['ctl']) if prev_row['ctl'] is not None else 50.0
            
            # Calculate new metrics
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            df.iloc[i, df.columns.get_loc('atl')] = round(atl, 1)
            df.iloc[i, df.columns.get_loc('ctl')] = round(ctl, 1)
            df.iloc[i, df.columns.get_loc('tsb')] = round(tsb, 1)

        # Update database with new metrics
        for _, row in df.iterrows():
            metrics_data = {
                'user_id': user_id,
                'date': row['date'].isoformat(),
                'trimp': float(row['trimp']) if pd.notnull(row['trimp']) else 0.0,
                'activity': row.get('activity', 'Rest day'),
                'atl': round(float(row['atl']), 1),
                'ctl': round(float(row['ctl']), 1),
                'tsb': round(float(row['tsb']), 1)
            }
            
            supabase.table('garmin_data')\
                .upsert(metrics_data, on_conflict='user_id,date')\
                .execute()

        # Prepare chart data for the requested date range
        chart_df = df[df['date'].between(start_date, end_date)]
        chart_data = {
            'dates': chart_df['date'].dt.strftime('%Y-%m-%d').tolist(),
            'trimps': chart_df['trimp'].tolist(),
            'atl': chart_df['atl'].tolist(),
            'ctl': chart_df['ctl'].tolist(),
            'tsb': chart_df['tsb'].tolist()
        }

        return {
            'success': True,
            'data': chart_data
        }

    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            'success': False,
            'error': str(e)
        } 