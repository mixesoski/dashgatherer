from datetime import datetime, timedelta
from supabase_client import supabase

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

        print(f"\n=== CALCULATING SYNC METRICS ===")
        print(f"Date range: {start_date.date()} to {end_date.date()}")

        # Get all days in range (including rest days)
        all_days = []
        current = start_date
        while current <= end_date:
            all_days.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)

        if not all_days:
            return {
                'success': True,
                'message': 'No days to update'
            }

        print(f"\nProcessing {len(all_days)} days from {all_days[0]} to {all_days[-1]}")

        try:
            # Test Supabase connection
            test_response = supabase.table('garmin_data')\
                .select('count')\
                .eq('user_id', user_id)\
                .execute()
            print("Supabase connection test successful")
        except Exception as e:
            print(f"Supabase connection error: {str(e)}")
            return {
                'success': False,
                'error': f'Database connection error: {str(e)}'
            }

        # Get existing data for these days
        try:
            existing_data = supabase.table('garmin_data')\
                .select('*')\
                .eq('user_id', user_id)\
                .gte('date', start_date.isoformat())\
                .lte('date', end_date.isoformat())\
                .execute()
            print(f"Found {len(existing_data.data)} existing records in date range")
        except Exception as e:
            print(f"Error fetching existing data: {str(e)}")
            return {
                'success': False,
                'error': f'Error fetching data: {str(e)}'
            }

        # Create a map of existing data
        existing_map = {
            datetime.fromisoformat(record['date']).strftime("%Y-%m-%d"): record
            for record in existing_data.data
        }

        # Calculate metrics for all days
        updates = []
        
        # Start with ATL=50 and CTL=50 for the selected start date
        prev_atl = 50
        prev_ctl = 50
        print(f"Starting with ATL: 50.0, CTL: 50.0 for date: {start_date.date()}")
        
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
            
            # Calculate based on previous values
            atl = prev_atl + (trimp - prev_atl) / 7
            ctl = prev_ctl + (trimp - prev_ctl) / 42
            tsb = ctl - atl
            
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

        # Update database
        print("\n=== UPDATING DATABASE ===")
        updated_count = 0
        for update in updates:
            try:
                response = supabase.table('garmin_data')\
                    .upsert(update, on_conflict='user_id,date')\
                    .execute()
                updated_count += 1
                print(f"Updated {update['date']} - ATL: {update['atl']:.1f}, CTL: {update['ctl']:.1f}, TSB: {update['tsb']:.1f}")
            except Exception as e:
                print(f"Error updating record: {str(e)}")
                return {
                    'success': False,
                    'error': f'Error updating database: {str(e)}'
                }

        return {
            'success': True,
            'message': f'Updated metrics for {updated_count} days'
        }

    except Exception as e:
        print(f"Error calculating metrics: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        } 