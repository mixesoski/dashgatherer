#!/usr/bin/env python3
import os
import datetime
from garminconnect import Garmin
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class ChartUpdater:
    def __init__(self, user_id):
        self.client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        self.user_id = user_id
        self.garmin = None

    def get_garmin_credentials(self):
        try:
            response = self.client.table('garmin_credentials')\
                .select('email, password')\
                .eq('user_id', self.user_id)\
                .single()\
                .execute()
            return response.data
        except Exception as e:
            print(f"Error fetching Garmin credentials: {e}")
            return None

    def initialize_garmin(self):
        credentials = self.get_garmin_credentials()
        if not credentials:
            raise Exception("No Garmin credentials found for user")
        
        self.garmin = Garmin(credentials['email'], credentials['password'])
        self.garmin.login()

    def find_last_existing_date(self):
        try:
            # Get the most recent date for this user
            response = self.client.table('garmin_data') \
                .select('date, trimp, atl, ctl, tsb') \
                .eq('user_id', self.user_id) \
                .order('date', desc=True) \
                .limit(1) \
                .single() \
                .execute()
            
            if response.data:
                data = response.data
                try:
                    date = datetime.datetime.fromisoformat(data['date']).date()
                    last_metrics = {
                        'atl': float(data['atl']),
                        'ctl': float(data['ctl']),
                        'tsb': float(data['tsb'])
                    }
                    print(f"Found last existing date: {date}")
                    print(f"Last metrics: ATL: {last_metrics['atl']}, CTL: {last_metrics['ctl']}, TSB: {last_metrics['tsb']}")
                    return date, last_metrics
                except ValueError as e:
                    print(f"Error converting metrics to float: {e}")
                    return None, {'atl': 0, 'ctl': 0, 'tsb': 0}
            
            print("No existing data found")
            return None, {'atl': 0, 'ctl': 0, 'tsb': 0}
            
        except Exception as e:
            print(f"Error finding last existing date: {e}")
            return None, {'atl': 0, 'ctl': 0, 'tsb': 0}

    def calculate_new_metrics(self, current_trimp, previous_metrics):
        current_trimp = float(current_trimp)
        
        if not previous_metrics:
            return {'atl': current_trimp, 'ctl': current_trimp, 'tsb': 0}
        
        previous_atl = float(previous_metrics['atl'])
        previous_ctl = float(previous_metrics['ctl'])
        
        new_atl = previous_atl + (current_trimp - previous_atl) / 7
        new_ctl = previous_ctl + (current_trimp - previous_ctl) / 42
        new_tsb = previous_ctl - previous_atl  # TSB calculation uses previous values
        
        return {
            'atl': round(new_atl, 2),
            'ctl': round(new_ctl, 2),
            'tsb': round(new_tsb, 2)
        }

    def update_chart_data(self):
        try:
            self.initialize_garmin()
            
            # Find the last existing date and its metrics
            last_date, previous_metrics = self.find_last_existing_date()
            if not last_date:
                # If no data exists, start from 180 days ago
                start_date = datetime.date.today() - datetime.timedelta(days=180)
            else:
                # Start from the day after the last existing date
                start_date = last_date + datetime.timedelta(days=1)
            
            end_date = datetime.date.today()
            
            # If start_date is after end_date, there's nothing to update
            if start_date > end_date:
                print("No new dates to process - data is up to date")
                return {'success': True, 'updated': 0}
            
            # Create date range from start_date to today
            date_range = [start_date + datetime.timedelta(days=i) 
                         for i in range((end_date - start_date).days + 1)]
            
            if not date_range:
                print("No new dates to process")
                return {'success': True, 'updated': 0}
            
            print(f"\nProcessing dates from {start_date} to {end_date}")
            print(f"\n=== Initial metrics from {start_date} ===")
            print(f"ATL: {previous_metrics['atl']}, CTL: {previous_metrics['ctl']}, TSB: {previous_metrics['tsb']}\n")
            
            # Get activities for the entire date range
            activities = self.garmin.get_activities_by_date(
                start_date.isoformat(), 
                end_date.isoformat()
            )
            
            activities_by_date = {}
            for activity in activities:
                start_time = activity.get('startTimeLocal')
                if not start_time:
                    continue
                try:
                    activity_date = datetime.datetime.fromisoformat(start_time).date()
                    date_str = activity_date.isoformat()
                    activities_by_date.setdefault(date_str, []).append(activity)
                except ValueError as e:
                    print(f"Error parsing activity date: {e}")
                    continue
            
            updated_count = 0
            
            for date in date_range:
                date_str = date.isoformat()
                date_obj = datetime.datetime.combine(date, datetime.time.min).replace(tzinfo=datetime.timezone.utc)
                date_iso = date_obj.isoformat()
                
                trimp_total = 0.0
                activities_for_date = activities_by_date.get(date_str, [])
                
                for activity in activities_for_date:
                    activity_id = activity['activityId']
                    try:
                        details = self.garmin.get_activity(activity_id)
                        trimp = 0.0
                        if 'connectIQMeasurements' in details:
                            for item in details['connectIQMeasurements']:
                                if item['developerFieldNumber'] == 4:
                                    trimp = round(float(item['value']), 1)
                                    break
                        activity_type = details.get('activityTypeDTO', {}).get('typeKey', '')
                        if activity_type in ['strength_training', 'Siła']:
                            trimp *= 2
                        trimp_total += trimp
                    except Exception as e:
                        print(f"Error processing activity {activity_id}: {e}")
                        continue
                
                if trimp_total == 0:
                    activity_str = "Rest Day"
                else:
                    activity_names = [activity.get('activityName', 'Unknown Activity') 
                                    for activity in activities_for_date]
                    activity_str = ', '.join(activity_names) or "Unknown Activity"
                
                new_metrics = self.calculate_new_metrics(trimp_total, previous_metrics)
                
                print(f"\n=== Processing {date_str} ===")
                print(f"TRIMP: {trimp_total}")
                print(f"Activity: {activity_str}")
                print(f"Metrics update:")
                print(f"ATL: {previous_metrics['atl']} -> {new_metrics['atl']}")
                print(f"CTL: {previous_metrics['ctl']} -> {new_metrics['ctl']}")
                print(f"TSB: {previous_metrics['tsb']} -> {new_metrics['tsb']}")
                
                previous_metrics = new_metrics
                
                try:
                    # Use upsert to handle existing entries
                    print(f"Upserting data for {date_str}:")
                    print(f"TRIMP: {trimp_total} | ATL: {new_metrics['atl']} | "
                          f"CTL: {new_metrics['ctl']} | TSB: {new_metrics['tsb']}")
                    
                    self.client.table('garmin_data').upsert({
                        'date': date_iso,
                        'trimp': trimp_total,
                        'activity': activity_str,
                        'user_id': self.user_id,
                        **new_metrics
                    }, on_conflict='user_id,date').execute()
                    updated_count += 1
                except Exception as e:
                    print(f"Error upserting metrics for {date_iso}: {e}")
                    continue
            
            print(f"\n=== Update completed ===")
            print(f"Total records processed: {updated_count}")
            return {'success': True, 'updated': updated_count}
            
        except Exception as e:
            print(f"\n=== Error occurred ===")
            print(f"Error in update_chart_data: {e}")
            return {'success': False, 'error': str(e)}

def update_chart_data(user_id):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data()