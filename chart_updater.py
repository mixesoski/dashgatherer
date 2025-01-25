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
            
            activities = self.garmin.get_activities_by_date(
                start_date.isoformat(), 
                end_date.isoformat()
            )
            
            updated_count = 0
            for activity in activities:
                activity_id = activity['activityId']
                details = self.garmin.get_activity(activity_id)
                
                trimp = next((item['value'] for item in details.get('connectIQMeasurements', []) 
                            if item['developerFieldNumber'] == 4), 0)
                
                # Debugging: Print the TRIMP value
                print(f"Retrieved TRIMP: {trimp}")
                
                if details['activityTypeDTO']['typeKey'] == 'strength_training':
                    trimp *= 2
                
                # Ensure TRIMP is a float
                try:
                    trimp = float(trimp)
                except ValueError as e:
                    print(f"Error converting TRIMP to float: {e}")
                    continue
                
                date = datetime.datetime.fromisoformat(details['summaryDTO']['startTimeLocal']).date().isoformat()
                
                # Get previous metrics for calculations
                previous_metrics = self.get_last_metrics()
                new_metrics = self.calculate_new_metrics(trimp, previous_metrics)
                
                try:
                    # Check if entry with this date already exists
                    existing_entry = self.client.table('garmin_data') \
                        .select('id, trimp') \
                        .eq('user_id', self.user_id) \
                        .eq('date', date) \
                        .execute()
                    
                    if existing_entry.data:
                        # If existing TRIMP is different, update it; otherwise skip
                        if len(existing_entry.data) == 1 and existing_entry.data[0]['trimp'] != trimp:
                            self.client.table('garmin_data').update({
                                'trimp': trimp,
                                'activity': details['activityName'],
                                **new_metrics
                            }).eq('id', existing_entry.data[0]['id']).execute()
                            updated_count += 1
                        else:
                            # Skip if same TRIMP already stored or multiple rows found
                            continue
                    else:
                        # Insert a new record if none exists for this date
                        self.client.table('garmin_data').insert({
                            'date': date,
                            'trimp': trimp,
                            'activity': details['activityName'],
                            'user_id': self.user_id,
                            **new_metrics
                        }).execute()
                        updated_count += 1
                except Exception as e:
                    print(f"Error updating metrics for {date}: {e}")
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