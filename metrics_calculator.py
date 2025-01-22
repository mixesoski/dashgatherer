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

        # Get data from database
        data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .gte('date', start_date.isoformat())\
            .lte('date', end_date.isoformat())\
            .execute()

        if not data.data:
            return {
                'success': False,
                'message': 'No data found'
            }

        # Convert to DataFrame
        df = pd.DataFrame(data.data)
        df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)
        df = df.sort_values('date')

        # Create date range and merge
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        date_df = pd.DataFrame({'date': date_range})
        df = pd.merge(date_df, df, on='date', how='left')
        df['trimp'] = df['trimp'].fillna(0)

        # Format data for chart
        chart_data = {
            'dates': df['date'].dt.strftime('%Y-%m-%d').tolist(),
            'trimps': df['trimp'].tolist(),
            'atl': df['atl'].tolist(),
            'ctl': df['ctl'].tolist(),
            'tsb': df['tsb'].tolist()
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