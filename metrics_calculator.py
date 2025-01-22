from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase

def calculate_metrics(user_id, start_date=None):
    try:
        # Get dates range
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            if isinstance(start_date, str):
                # Remove any timezone info and milliseconds
                start_date = start_date.split('.')[0].split('+')[0].replace('Z', '')
                start_date = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%S")
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
            # Clean and convert dates
            df['date'] = df['date'].apply(lambda x: x.split('.')[0].split('+')[0].replace('Z', ''))
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')

            # Get the earliest date with data
            earliest_date = df['date'].min()
            if earliest_date:
                start_date = min(start_date, earliest_date)

        # Create all days in range
        all_days = []
        current = start_date
        while current <= end_date:
            all_days.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)

        if not all_days:
            print("No days to process")
            return {
                'success': True,
                'message': 'No days to update'
            }

        print(f"\nProcessing {len(all_days)} days from {all_days[0]} to {all_days[-1]}")

        # Create a map of existing data
        existing_map = {}
        if not df.empty:
            for _, row in df.iterrows():
                day_str = row['date'].strftime("%Y-%m-%d")
                existing_map[day_str] = {
                    'user_id': row['user_id'],
                    'date': row['date'].strftime("%Y-%m-%dT%H:%M:%S"),
                    'trimp': row['trimp'],
                    'activity': row['activity']
                }

        # Calculate metrics for all days
        updates = []
        prev_atl = 50.0  # Initial values
        prev_ctl = 50.0

        for day in all_days:
            current_date = datetime.strptime(day, "%Y-%m-%d")
            print(f"Processing {day}")

            # Get or create record for this day
            record = existing_map.get(day, {
                'user_id': user_id,
                'date': current_date.strftime("%Y-%m-%dT%H:%M:%S"),
                'trimp': 0,
                'activity': 'Rest day'
            })

            # Calculate new values
            trimp = float(record['trimp'] if record['trimp'] is not None else 0)
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl

            updates.append({
                'user_id': user_id,
                'date': record['date'],
                'trimp': trimp,
                'activity': record['activity'],
                'atl': round(atl, 1),
                'ctl': round(ctl, 1),
                'tsb': round(tsb, 1)
            })

            prev_atl = atl
            prev_ctl = ctl

        # Update all records
        updated_count = 0
        for update in updates:
            try:
                supabase.table('garmin_data')\
                    .upsert(update, on_conflict='user_id,date')\
                    .execute()
                updated_count += 1
                print(f"Updated metrics for {update['date']} - ATL: {update['atl']:.1f}, CTL: {update['ctl']:.1f}, TSB: {update['tsb']:.1f}")
            except Exception as e:
                print(f"Error updating metrics for {update['date']}: {e}")

        # Prepare chart data
        chart_data = {
            'dates': all_days,
            'trimps': [u['trimp'] for u in updates],
            'atl': [u['atl'] for u in updates],
            'ctl': [u['ctl'] for u in updates],
            'tsb': [u['tsb'] for u in updates]
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