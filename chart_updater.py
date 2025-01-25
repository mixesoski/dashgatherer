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
    
    def get_last_metrics(self):
        try:
            response = self.client.table('garmin_data') \
                .select('date, atl, ctl') \
                .eq('user_id', self.user_id) \
                .order('date', desc=True) \
                .limit(1) \
                .execute()
            
            if not response.data:
                return None
            
            data = response.data[0]
            
            # Debugging: Print the values before conversion
            print(f"Retrieved ATL: {data['atl']}, CTL: {data['ctl']}")
            
            # Validation: Ensure the values are valid numbers
            try:
                data['atl'] = float(data['atl'])
                data['ctl'] = float(data['ctl'])
            except ValueError as e:
                print(f"Error converting metrics to float: {e}")
                return None
            
            return data
        except Exception as e:
            print(f"Error fetching last metrics: {e}")
            return None
    
    def calculate_new_metrics(self, current_trimp, previous_metrics):
        # Ensure current_trimp is a float
        current_trimp = float(current_trimp)
        
        if not previous_metrics:
            return {'atl': current_trimp, 'ctl': current_trimp, 'tsb': 0}
        
        # Ensure previous_metrics values are floats
        previous_atl = float(previous_metrics['atl'])
        previous_ctl = float(previous_metrics['ctl'])
        
        new_atl = previous_atl + (current_trimp - previous_atl) / 7
        new_ctl = previous_ctl + (current_trimp - previous_ctl) / 42
        new_tsb = new_ctl - new_atl
        return {
            'atl': round(new_atl, 2),
            'ctl': round(new_ctl, 2),
            'tsb': round(new_tsb, 2)
        }
    
    def update_chart_data(self):
        try:
            # Initialize Garmin client with user credentials
            self.initialize_garmin()
            
            # Get data for the last 9 days
            end_date = datetime.date.today()
            start_date = end_date - datetime.timedelta(days=9)
            
            # Create a list of all dates in the range
            date_range = [start_date + datetime.timedelta(days=i) for i in range((end_date - start_date).days + 1)]
            
            activities = self.garmin.get_activities_by_date(
                start_date.isoformat(), 
                end_date.isoformat()
            )
            
            # Log activities found
            print("Activities found in Garmin Connect:")
            for activity in activities:
                # Print the entire activity object for debugging
                print(f"Activity Data: {activity}")
                
                # Correctly retrieve the date
                activity_date = activity.get('startTimeLocal', 'Unknown')
                print(f"Activity ID: {activity['activityId']}, Date: {activity_date}")
            
            # Create a dictionary to map dates to activities
            activities_by_date = {}
            for activity in activities:
                date_str = datetime.datetime.fromisoformat(activity.get('startTimeLocal', '')).date().isoformat()
                if date_str not in activities_by_date:
                    activities_by_date[date_str] = []
                activities_by_date[date_str].append(activity)
            
            updated_count = 0
            previous_metrics = self.get_last_metrics()  # Start with the last known metrics
            for date in date_range:
                date_str = date.isoformat()
                
                trimp_total = 0
                if date_str in activities_by_date:
                    for activity in activities_by_date[date_str]:
                        activity_id = activity['activityId']
                        details = self.garmin.get_activity(activity_id)
                        
                        trimp = 0
                        if 'connectIQMeasurements' in details:
                            for item in details['connectIQMeasurements']:
                                if item['developerFieldNumber'] == 4:
                                    trimp = round(float(item['value']), 1)
                        
                        # Apply multiplier for Strength Training
                        if details.get('activityTypeDTO', {}).get('typeKey') in ['strength_training', 'Siła']:
                            print(f"Applying 2x multiplier for strength training: {trimp} -> {trimp * 2}")
                            trimp *= 2
                        
                        # Debugging: Print the TRIMP value
                        print(f"Retrieved TRIMP: {trimp}")
                        
                        trimp_total += trimp
                
                # Ensure TRIMP is a float
                try:
                    trimp_total = float(trimp_total)
                except ValueError as e:
                    print(f"Error converting TRIMP to float: {e}")
                    continue
                
                # Calculate new metrics using the previous day's metrics
                new_metrics = self.calculate_new_metrics(trimp_total, previous_metrics)
                previous_metrics = new_metrics  # Update previous metrics for the next iteration
                
                try:
                    # Check if entry with this date already exists
                    existing_entry = self.client.table('garmin_data') \
                        .select('id, trimp') \
                        .eq('user_id', self.user_id) \
                        .eq('date', date_str) \
                        .execute()
                    
                    if existing_entry.data:
                        # If existing TRIMP is different, update it; otherwise skip
                        if len(existing_entry.data) == 1 and existing_entry.data[0]['trimp'] != trimp_total:
                            self.client.table('garmin_data').update({
                                'trimp': trimp_total,
                                'activity': ', '.join([details.get('activityName', 'No Activity') for details in activities_by_date[date_str]]),
                                **new_metrics
                            }).eq('id', existing_entry.data[0]['id']).execute()
                            updated_count += 1
                        else:
                            # Skip if same TRIMP already stored or multiple rows found
                            continue
                    else:
                        # Log activities to be added
                        print(f"Adding new activity for date: {date_str}, TRIMP: {trimp_total}")
                        
                        # Insert a new record if none exists for this date
                        self.client.table('garmin_data').insert({
                            'date': date_str,
                            'trimp': trimp_total,
                            'activity': ', '.join([details.get('activityName', 'No Activity') for details in activities_by_date[date_str]]),
                            'user_id': self.user_id,
                            **new_metrics
                        }).execute()
                        updated_count += 1
                except Exception as e:
                    print(f"Error updating metrics for {date_str}: {e}")
                    continue
            
            return {
                'success': True,
                'updated': updated_count
            }
            
        except Exception as e:
            print(f"Error in update_chart_data: {e}")
            return {
                'success': False,
                'error': str(e)
            }

def update_chart_data(user_id):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data() 