from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase

def calculate_metrics(user_id, start_date=None):
    try:
        print("\n=== Starting calculate_metrics ===")
        print(f"Calculating metrics for user_id: {user_id}")
        print(f"Input start_date: {start_date} (type: {type(start_date)})")
        
        # Get dates range
        end_date = datetime.now().replace(tzinfo=None)
        if start_date:
            if isinstance(start_date, str):
                print(f"Original start_date string: {start_date}")
                # Remove any timezone info and milliseconds
                start_date = start_date.split('.')[0].split('+')[0].replace('Z', '')
                print(f"Cleaned start_date string: {start_date}")
                start_date = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%S")
                print(f"Parsed start_date: {start_date}")
            start_date = start_date.replace(tzinfo=None)
        else:
            start_date = end_date - timedelta(days=9)
            print("No start_date provided, using default")

        print(f"Final start_date: {start_date} (type: {type(start_date)})")
        print(f"End date: {end_date} (type: {type(end_date)})")

        # Get existing data from database
        print("\n=== Fetching data from database ===")
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
        print(f"Found {len(existing_data.data)} records in database")
        
        # Check for duplicates in raw data
        date_counts = {}
        for record in existing_data.data:
            date_str = record['date'].split('T')[0]  # Get just the date part
            if date_str in date_counts:
                print(f"WARNING: Duplicate date found in database: {date_str}")
                print(f"  First record: {date_counts[date_str]}")
                print(f"  Duplicate record: {record}")
            date_counts[date_str] = record

        print(f"Unique dates in database: {len(date_counts)}")
        if len(date_counts) != len(existing_data.data):
            print(f"WARNING: Found {len(existing_data.data) - len(date_counts)} duplicate dates!")

        # Convert to DataFrame
        df = pd.DataFrame(existing_data.data)
        if not df.empty:
            print("\n=== Processing dates in DataFrame ===")
            # Check for duplicates in DataFrame
            duplicates = df.groupby('date').size()
            if (duplicates > 1).any():
                print("WARNING: Duplicate dates found in DataFrame:")
                for date, count in duplicates[duplicates > 1].items():
                    print(f"  Date {date}: {count} occurrences")
                    print("  Records:")
                    for _, row in df[df['date'] == date].iterrows():
                        print(f"    {dict(row)}")
            print("Sample of raw dates:", df['date'].head().tolist())
            # Clean and convert dates
            df['date'] = df['date'].apply(lambda x: x.split('.')[0].split('+')[0].replace('Z', ''))
            print("Sample of cleaned dates:", df['date'].head().tolist())
            df['date'] = pd.to_datetime(df['date'])
            print("Sample of parsed dates:", df['date'].head().tolist())
            df = df.sort_values('date')

            # Get the earliest date with data
            earliest_date = df['date'].min()
            if earliest_date:
                print(f"\nEarliest date in data: {earliest_date}")
                old_start_date = start_date
                start_date = min(start_date, earliest_date)
                if old_start_date != start_date:
                    print(f"Adjusted start_date from {old_start_date} to {start_date}")

        # Create all days in range
        print("\n=== Creating date range ===")
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

        print(f"Created {len(all_days)} days from {all_days[0]} to {all_days[-1]}")

        # Create a map of existing data
        print("\n=== Creating data map ===")
        existing_map = {}
        if not df.empty:
            for _, row in df.iterrows():
                day_str = row['date'].strftime("%Y-%m-%d")
                existing_map[day_str] = {
                    'user_id': row['user_id'],
                    'date': row['date'].strftime("%Y-%m-%dT%H:%M:%S"),
                    'trimp': row['trimp'],
                    'activity': row['activity'],
                    'atl': row.get('atl'),
                    'ctl': row.get('ctl'),
                    'tsb': row.get('tsb')
                }
            print(f"Created map with {len(existing_map)} entries")
            print("Sample entries:")
            for day in list(existing_map.keys())[:3]:
                print(f"  - {day}: {existing_map[day]}")

        # Calculate metrics for all days
        print("\n=== Calculating metrics ===")
        updates = []
        prev_atl = 50.0  # Initial values
        prev_ctl = 50.0
        print(f"Starting with ATL={prev_atl}, CTL={prev_ctl}")

        for day in all_days:
            current_date = datetime.strptime(day, "%Y-%m-%d")
            print(f"\nProcessing {day}")

            # Get or create record for this day
            record = existing_map.get(day, {
                'user_id': user_id,
                'date': current_date.strftime("%Y-%m-%dT%H:%M:%S"),
                'trimp': 0,
                'activity': 'Rest day',
                'atl': None,
                'ctl': None,
                'tsb': None
            })
            print(f"Found existing record: {day in existing_map}")
            print(f"Current values: TRIMP={record['trimp']}, ATL={record['atl']}, CTL={record['ctl']}, TSB={record['tsb']}")

            # Calculate new values
            trimp = float(record['trimp'] if record['trimp'] is not None else 0)
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl

            print(f"New values: TRIMP={trimp}, ATL={atl:.1f}, CTL={ctl:.1f}, TSB={tsb:.1f}")
            if record['atl'] is not None:
                print(f"Changes: ATL: {record['atl']:.1f}->{atl:.1f}, CTL: {record['ctl']:.1f}->{ctl:.1f}, TSB: {record['tsb']:.1f}->{tsb:.1f}")

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
        print("\n=== Updating database ===")
        updated_count = 0
        for update in updates:
            try:
                print(f"\nTrying to update {update['date']}")
                print(f"Update data: {update}")
                response = supabase.table('garmin_data')\
                    .upsert(update, on_conflict='user_id,date')\
                    .execute()
                print(f"Response from database: {response.data}")
                updated_count += 1
                print(f"Successfully updated {update['date']} - ATL: {update['atl']:.1f}, CTL: {update['ctl']:.1f}, TSB: {update['tsb']:.1f}")
            except Exception as e:
                print(f"Error updating {update['date']}: {e}")
                print(f"Failed update data: {update}")
                print(f"Error details: {str(e)}")
                import traceback
                traceback.print_exc()

        print(f"\nSuccessfully updated {updated_count} records")

        # Prepare chart data
        print("\n=== Preparing chart data ===")
        chart_data = {
            'dates': all_days,
            'trimps': [u['trimp'] for u in updates],
            'atl': [u['atl'] for u in updates],
            'ctl': [u['ctl'] for u in updates],
            'tsb': [u['tsb'] for u in updates]
        }
        print("Chart data prepared with:")
        print(f"  - {len(chart_data['dates'])} days")
        print(f"  - First day: {chart_data['dates'][0]}, Last day: {chart_data['dates'][-1]}")
        print(f"  - TRIMP range: {min(chart_data['trimps'])} to {max(chart_data['trimps'])}")
        print(f"  - ATL range: {min(chart_data['atl'])} to {max(chart_data['atl'])}")
        print(f"  - CTL range: {min(chart_data['ctl'])} to {max(chart_data['ctl'])}")

        return {
            'success': True,
            'data': chart_data
        }

    except Exception as e:
        print(f"\n!!! Error calculating metrics !!!")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        print(f"Error details: {e}")
        import traceback
        print("Traceback:")
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        } 