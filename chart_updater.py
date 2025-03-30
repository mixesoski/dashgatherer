#!/usr/bin/env python3
import os
import datetime
from garminconnect import Garmin
from supabase import create_client, Client
from dotenv import load_dotenv
import traceback
import logging

load_dotenv()

class ChartUpdater:
    def __init__(self, user_id):
        self.client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        self.user_id = user_id
        self.garmin = None
        self.processed_activity_ids = set()

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
        current_trimp = float(current_trimp)  # This might be 0 for rest days
        
        if not previous_metrics:
            return {'atl': current_trimp, 'ctl': current_trimp, 'tsb': 0}
        
        previous_atl = float(previous_metrics['atl'])
        previous_ctl = float(previous_metrics['ctl'])
        
        # Calculate new ATL and CTL
        new_atl = previous_atl + (current_trimp - previous_atl) / 7
        new_ctl = previous_ctl + (current_trimp - previous_ctl) / 42
        
        # TSB is ALWAYS calculated using previous day's values
        # TSB = previous day's CTL - previous day's ATL
        new_tsb = previous_ctl - previous_atl
        
        # Round to 2 decimal places
        metrics = {
            'atl': round(new_atl, 2),
            'ctl': round(new_ctl, 2),
            'tsb': round(new_tsb, 2)
        }
        
        print(f"\nMetrics calculation for TRIMP {current_trimp}:")
        print(f"Previous day's metrics - ATL: {previous_atl}, CTL: {previous_ctl}")
        print(f"New ATL: {metrics['atl']}")
        print(f"New CTL: {metrics['ctl']}")
        print(f"TSB: {metrics['tsb']} (previous CTL {previous_ctl} - previous ATL {previous_atl})")
        
        return metrics

    def update_chart_data(self, start_date=None, end_date=None):
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
                start_date = last_date
                print(f"Found existing data, checking for new activities on {last_date}")
            
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
            
            # Store initial metrics to use for the first day
            self.initial_metrics = previous_metrics
            
            updated_count = 0
            
            for date in date_range:
                date_str = date.strftime('%Y-%m-%d')
                logging.info(f"Processing date: {date_str}")
                
                # Get existing data for this date
                existing_data = self.get_existing_data(date_str)
                
                # Initialize metrics from previous day or initial metrics for first day
                if date == start_date:
                    previous_metrics = self.initial_metrics
                else:
                    previous_metrics = self.get_previous_day_metrics(date_str)
                
                # Get activities for this date
                activities = self.get_activities_for_date(date)
                
                # Calculate total TRIMP for new activities
                trimp_total = 0
                activity_names = []
                new_activities = set()
                
                if activities:
                    for activity in activities:
                        activity_id = activity.get('activityId')
                        if activity_id not in self.processed_activity_ids:
                            trimp = float(activity.get('trimp', 0))
                            trimp_total += trimp
                            activity_name = activity.get('activityName', 'Unknown Activity')
                            activity_names.append(activity_name)
                            new_activities.add(activity_id)
                            self.processed_activity_ids.add(activity_id)
                
                # If we have existing data and no new activities, preserve the existing metrics
                if existing_data and not new_activities:
                    print(f"No new activities for {date_str}, preserving existing metrics")
                    new_metrics = {
                        'atl': existing_data['atl'],
                        'ctl': existing_data['ctl'],
                        'tsb': existing_data['tsb']
                    }
                    activity_str = existing_data['activity']
                    trimp_total = existing_data['trimp']
                else:
                    # Calculate new metrics
                    new_metrics = self.calculate_new_metrics(trimp_total, previous_metrics)
                    activity_str = ', '.join(activity_names) if activity_names else 'Rest Day'
                
                # Store the metrics we just calculated as they'll be needed for the next day
                previous_metrics = new_metrics
                
                # Update the database
                self.update_database_entry(date_str, trimp_total, new_metrics, activity_str)
                
                logging.info(f"Updated metrics for {date_str}: TRIMP={trimp_total}, ATL={new_metrics['atl']}, CTL={new_metrics['ctl']}, TSB={new_metrics['tsb']}")
                
                updated_count += 1
            
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

    def get_existing_data(self, date_str):
        response = self.client.table('garmin_data') \
            .select('trimp, activity, atl, ctl, tsb') \
            .eq('user_id', self.user_id) \
            .eq('date', date_str) \
            .execute()
        if response.data and ((isinstance(response.data, list) and len(response.data) > 0) or (not isinstance(response.data, list))):
            return response.data[0] if isinstance(response.data, list) else response.data
        else:
            return None

    def get_previous_day_metrics(self, date_str):
        # Convert date_str to datetime and get previous day
        current_date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
        previous_date = current_date - datetime.timedelta(days=1)
        previous_date_str = previous_date.strftime('%Y-%m-%d')
        
        response = self.client.table('garmin_data') \
            .select('trimp, atl, ctl, tsb') \
            .eq('user_id', self.user_id) \
            .eq('date', previous_date_str) \
            .execute()
            
        if response.data and ((isinstance(response.data, list) and len(response.data) > 0) or (not isinstance(response.data, list))):
            data = response.data[0] if isinstance(response.data, list) else response.data
            return {
                'atl': float(data['atl']),
                'ctl': float(data['ctl']),
                'tsb': float(data['tsb'])
            }
        else:
            # If no previous day data, use the initial metrics from find_last_existing_date
            _, initial_metrics = self.find_last_existing_date()
            return initial_metrics

    def get_activities_for_date(self, date):
        try:
            activities = self.garmin.get_activities_by_date(
                date.isoformat(),
                date.isoformat()
            )
            
            # Fetch TRIMP values for each activity
            activities_with_trimp = []
            for activity in activities:
                activity_id = activity['activityId']
                try:
                    details = self.garmin.get_activity(activity_id)
                    trimp = 0.0
                    if 'connectIQMeasurements' in details:
                        for item in details['connectIQMeasurements']:
                            if item['developerFieldNumber'] == 4:
                                trimp = round(float(item['value']), 1)
                                break
                    
                    # Double TRIMP for strength training activities
                    activity_type = details.get('activityTypeDTO', {}).get('typeKey', '')
                    if activity_type in ['strength_training', 'Siła']:
                        trimp *= 2
                    
                    activity['trimp'] = trimp
                    activities_with_trimp.append(activity)
                    print(f"Activity {activity.get('activityName', 'Unknown')}: TRIMP = {trimp}")
                except Exception as e:
                    print(f"Error getting details for activity {activity_id}: {e}")
                    continue
            
            return activities_with_trimp
        except Exception as e:
            print(f"Error fetching activities for {date}: {e}")
            return []

    def update_database_entry(self, date_str, trimp_total, new_metrics, activity_str):
        try:
            # Convert date_str to datetime object
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            date_iso = date_obj.replace(tzinfo=datetime.timezone.utc).isoformat()
            
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
        except Exception as e:
            print(f"Error upserting metrics for {date_str}: {e}")

def update_chart_data(user_id):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data()