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

        # Get the last known metrics before start_date
        start_of_day = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        last_known = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .lt('date', start_of_day.isoformat())\
            .order('date', desc=True)\
            .limit(1)\
            .execute()

        print("\nLooking for last known metrics before:", start_of_day.isoformat())
        
        if last_known.data:
            record = last_known.data[0]
            prev_atl = float(record['atl'] if record['atl'] is not None else 0)
            prev_ctl = float(record['ctl'] if record['ctl'] is not None else 0)
            last_known_date = datetime.fromisoformat(record['date']).date()
            # Adjust start_date to day after last_known
            start_date = (last_known_date + timedelta(days=1))
            print(f"Found last known metrics from {record['date']}")
            print(f"ATL: {prev_atl:.1f}, CTL: {prev_ctl:.1f}")
            print(f"Adjusting start date to: {start_date}")
        else:
            # Only use defaults for new users
            any_data = supabase.table('garmin_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .limit(1)\
                .execute()
            
            if any_data.data:
                prev_atl = 0
                prev_ctl = 0
                print("No previous data found, but user exists - using zeros")
            else:
                prev_atl = 50
                prev_ctl = 50
                print("New user - using default values")

        # Get all days in range (including rest days)
        all_days = []
        current = start_date
        while current <= end_date:
            all_days.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)

        print(f"\nProcessing {len(all_days)} days from {all_days[0]} to {all_days[-1]}")

        # Get existing data for these days
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.isoformat())\
            .lte('date', end_date.isoformat())\
            .execute()

        print(f"Found {len(existing_data.data)} existing records in date range")

        # Create a map of existing data
        existing_map = {
            datetime.fromisoformat(record['date']).strftime("%Y-%m-%d"): record
            for record in existing_data.data
        }

        # Calculate metrics for all days
        updates = []
        for day in all_days:
            current_date = datetime.strptime(day, "%Y-%m-%d")
            
            print(f"Processing {day}")
            
            # Get or create record for this day
            record = existing_map.get(day, {
                'user_id': user_id,
                'date': current_date.isoformat(),
                'trimp': 0,
                'activity': 'Rest day'
            })
            
            # Calculate new values
            trimp = float(record.get('trimp', 0) if record.get('trimp') is not None else 0)
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = prev_ctl - prev_atl
            
            updates.append({
                'user_id': user_id,
                'date': record['date'],
                'trimp': trimp,
                'activity': record.get('activity', 'Rest day'),
                'atl': round(float(atl), 1),
                'ctl': round(float(ctl), 1),
                'tsb': round(float(tsb), 1)
            })
            
            prev_atl = atl
            prev_ctl = ctl

        # Update all records
        updated_count = 0
        try:
            for update in updates:
                response = supabase.table('garmin_data')\
                    .upsert(update, on_conflict='user_id,date')\
                    .execute()
                updated_count += 1
                print(f"Updated metrics for {update['date']} - ATL: {update['atl']:.1f}, CTL: {update['ctl']:.1f}, TSB: {update['tsb']:.1f}")
        except Exception as e:
            print(f"Error updating metrics: {e}")
            return {
                'success': False,
                'error': str(e)
            }

        return {
            'success': True,
            'message': f'Updated metrics for {updated_count} days'
        }

    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {
            'success': False,
            'error': str(e)
        } 