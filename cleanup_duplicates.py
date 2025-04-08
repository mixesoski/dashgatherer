from datetime import datetime
from supabase_client import supabase
import pandas as pd
import sys

def merge_duplicate_entries(user_id=None):
    """
    Merge duplicate date entries for a user or all users.
    Combines activity and TRIMP data with metrics (ATL, CTL, TSB) into a single row.
    """
    print(f"\n{'='*50}")
    print(f"Starting duplicate cleanup process at {datetime.now().isoformat()}")
    
    try:
        # Get all data if no user_id specified, otherwise filter by user_id
        query = supabase.table('garmin_data').select('*')
        if user_id:
            print(f"Running cleanup for user: {user_id}")
            query = query.eq('user_id', user_id)
        
        response = query.execute()
        
        if not response.data:
            print("No data found to clean up")
            return
            
        # Load data into DataFrame
        df = pd.DataFrame(response.data)
        print(f"Retrieved {len(df)} total rows")
        
        # Count unique dates
        unique_dates = df.groupby(['user_id', 'date']).size().reset_index(name='count')
        duplicate_dates = unique_dates[unique_dates['count'] > 1]
        print(f"Found {len(duplicate_dates)} duplicate date entries")
        
        if len(duplicate_dates) == 0:
            print("No duplicate dates found, nothing to clean up")
            return
            
        # Process each duplicate
        success_count = 0
        for _, row in duplicate_dates.iterrows():
            user_id = row['user_id']
            date = row['date']
            
            # Get all entries for this date
            date_entries = df[(df['user_id'] == user_id) & (df['date'] == date)]
            print(f"\nProcessing {len(date_entries)} entries for {user_id} on {date}")
            
            # Find which entry has activity/TRIMP and which has metrics
            has_trimp = date_entries['trimp'].notnull() & (date_entries['trimp'] > 0)
            has_metrics = date_entries['atl'].notnull()
            
            # Extract data from each entry
            activity_entry = None
            metrics_entry = None
            
            for _, entry in date_entries.iterrows():
                if pd.notna(entry['trimp']) and entry['trimp'] > 0:
                    if activity_entry is None or entry['trimp'] > activity_entry['trimp']:
                        activity_entry = entry
                        
                if pd.notna(entry['atl']):
                    metrics_entry = entry
            
            # If we have both activity and metrics entries, merge them
            if activity_entry is not None and metrics_entry is not None:
                # Create merged entry
                merged_entry = {
                    'user_id': user_id,
                    'date': date,
                    'trimp': float(activity_entry['trimp']),
                    'activity': activity_entry['activity'],
                    'atl': float(metrics_entry['atl']),
                    'ctl': float(metrics_entry['ctl']),
                    'tsb': float(metrics_entry['tsb'])
                }
                
                print(f"Merging entries:")
                print(f"TRIMP: {merged_entry['trimp']}, Activity: {merged_entry['activity']}")
                print(f"ATL: {merged_entry['atl']}, CTL: {merged_entry['ctl']}, TSB: {merged_entry['tsb']}")
                
                # Delete all entries for this date
                delete_response = supabase.table('garmin_data')\
                    .delete()\
                    .eq('user_id', user_id)\
                    .eq('date', date)\
                    .execute()
                
                # Insert merged entry
                insert_response = supabase.table('garmin_data')\
                    .insert(merged_entry)\
                    .execute()
                
                if insert_response.data:
                    success_count += 1
                    print(f"Successfully merged entries for {date}")
                else:
                    print(f"Failed to insert merged entry for {date}")
            else:
                print(f"Couldn't find both activity and metrics entries for {date}")
        
        print(f"\nCleanup complete! Successfully merged {success_count} duplicate entries.")
    
    except Exception as e:
        print(f"Error in cleanup process: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # If user_id is passed as an argument, clean up only that user
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
        merge_duplicate_entries(user_id)
    else:
        merge_duplicate_entries()
        print("To clean up a specific user, run: python cleanup_duplicates.py USER_ID") 