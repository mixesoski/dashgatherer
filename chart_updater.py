#!/usr/bin/env python3
import os
import datetime
from garminconnect import Garmin
from supabase import create_client, Client
from dotenv import load_dotenv
import traceback

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
                .execute()
            if response.data:
                return response.data[0] if isinstance(response.data, list) else response.data
            else:
                return None
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
            # Get the most recent date with TRIMP > 0 for this user
            response = self.client.table('garmin_data') \
                .select('date, trimp, atl, ctl, tsb') \
                .eq('user_id', self.user_id) \
                .gt('trimp', 0) \
                .order('date', desc=True) \
                .limit(1) \
                .execute()
            
            if response.data:
                data = response.data[0] if isinstance(response.data, list) else response.data
                try:
                    date = datetime.datetime.fromisoformat(data['date']).date()
                    last_metrics = {
                        'atl': float(data['atl']),
                        'ctl': float(data['ctl']),
                        'tsb': float(data['tsb'])
                    }
                    print(f"Found last existing date with TRIMP > 0: {date}")
                    print(f"Last metrics: ATL: {last_metrics['atl']}, CTL: {last_metrics['ctl']}, TSB: {last_metrics['tsb']}")
                    return date, last_metrics
                except ValueError as e:
                    print(f"Error converting metrics to float: {e}")
                    return None, {'atl': 0, 'ctl': 0, 'tsb': 0}
            
            print("No existing data found with TRIMP > 0")
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
            print(f"\nStarting chart update for user {self.user_id}")
            
            # Initialize Garmin connection
            print("Initializing Garmin connection...")
            try:
                self.initialize_garmin()
                print("Garmin connection initialized successfully")
            except Exception as e:
                print(f"Failed to initialize Garmin connection: {e}")
                raise
            
            # Find the last existing date and its metrics
            print("Finding last existing date...")
            try:
                last_date, previous_metrics = self.find_last_existing_date()
                print(f"Last date: {last_date}")
                print(f"Previous metrics: {previous_metrics}")
            except Exception as e:
                print(f"Failed to find last existing date: {e}")
                raise
            
            if not last_date:
                # If no data exists, start from 180 days ago
                start_date = datetime.date.today() - datetime.timedelta(days=180)
                print(f"No existing data found, starting from {start_date}")
            else:
                print(f"Found existing data, checking for new activities on {last_date}")
                # First check if there are new activities for the last existing date
                try:
                    activities = self.garmin.get_activities_by_date(
                        last_date.isoformat(),
                        last_date.isoformat()
                    )
                    print(f"Found {len(activities)} activities for {last_date}")
                    start_date = last_date
                except Exception as e:
                    print(f"Error fetching activities: {e}")
                    raise
            
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
                
                # Get existing data for this date if any
                existing_response = self.client.table('garmin_data') \
                    .select('trimp, activity, atl, ctl, tsb') \
                    .eq('user_id', self.user_id) \
                    .eq('date', date_str) \
                    .execute()
                
                if existing_response.data and ((isinstance(existing_response.data, list) and len(existing_response.data) > 0) or (not isinstance(existing_response.data, list))):
                    existing_data = existing_response.data[0] if isinstance(existing_response.data, list) else existing_response.data
                else:
                    existing_data = {'trimp': 0.0, 'activity': '', 'atl': previous_metrics['atl'], 'ctl': previous_metrics['ctl'], 'tsb': previous_metrics['tsb']}
                
                # If this is today's date and we already have data, skip processing
                if date == end_date and existing_data['trimp'] > 0:
                    print(f"\nSkipping today's date {date_str} - already processed")
                    continue
                
                activities_for_date = activities_by_date.get(date_str, [])
                existing_activities = set(existing_data['activity'].split(', ')) if existing_data['activity'] and existing_data['activity'] != 'Rest Day' else set()
                
                # Track processed activity IDs to prevent duplicates
                processed_activity_ids = set()
                trimp_total = 0.0
                new_activities = set()
                
                for activity in activities_for_date:
                    activity_id = activity['activityId']
                    activity_name = activity.get('activityName', 'Unknown Activity')
                    
                    # Skip if we've already processed this activity
                    if activity_id in processed_activity_ids:
                        continue
                        
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
                            
                        # Only add TRIMP if this is a new activity
                        if activity_name not in existing_activities:
                            trimp_total += trimp
                            new_activities.add(activity_name)
                            processed_activity_ids.add(activity_id)
                    except Exception as e:
                        print(f"Error processing activity {activity_id}: {e}")
                        continue
                
                if trimp_total == 0 and existing_data['trimp'] == 0:
                    activity_str = "Rest Day"
                else:
                    # Combine existing activities with new activities
                    all_activities = existing_activities.union(new_activities)
                    activity_str = ', '.join(sorted(all_activities)) if all_activities else "Unknown Activity"
                
                # Only add new TRIMP to existing TRIMP if we have new activities
                total_trimp = existing_data['trimp']
                if new_activities:
                    total_trimp += trimp_total
                
                # Only recalculate metrics if we have new activities
                if new_activities:
                    new_metrics = self.calculate_new_metrics(total_trimp, previous_metrics)
                    previous_metrics = new_metrics
                else:
                    new_metrics = {
                        'atl': existing_data['atl'],
                        'ctl': existing_data['ctl'],
                        'tsb': existing_data['tsb']
                    }
                
                print(f"\n=== Processing {date_str} ===")
                print(f"Existing TRIMP: {existing_data['trimp']}")
                print(f"New TRIMP: {trimp_total}")
                print(f"Total TRIMP: {total_trimp}")
                print(f"Activity: {activity_str}")
                print(f"Metrics update:")
                print(f"ATL: {existing_data['atl']} -> {new_metrics['atl']}")
                print(f"CTL: {existing_data['ctl']} -> {new_metrics['ctl']}")
                print(f"TSB: {existing_data['tsb']} -> {new_metrics['tsb']}")
                
                try:
                    # Use upsert to handle existing entries
                    print(f"Upserting data for {date_str}:")
                    print(f"TRIMP: {total_trimp} | ATL: {new_metrics['atl']} | "
                          f"CTL: {new_metrics['ctl']} | TSB: {new_metrics['tsb']}")
                    
                    self.client.table('garmin_data').upsert({
                        'date': date_iso,
                        'trimp': total_trimp,
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
            print(f"\nError in update_chart_data:")
            print(f"Error type: {type(e).__name__}")
            print(f"Error message: {str(e)}")
            print("Traceback:")
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

def update_chart_data(user_id):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data()