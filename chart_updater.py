#!/usr/bin/env python3
import os
import datetime
from garminconnect import Garmin
from supabase import create_client, Client
from dotenv import load_dotenv
import traceback
import logging
import time
import math

load_dotenv()

class ChartUpdater:
    def __init__(self, user_id):
        self.client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        self.user_id = user_id
        self.garmin = None
        self.processed_activity_ids = set()

    def get_garmin_credentials(self):
        try:
            print(f"Fetching Garmin credentials for user {self.user_id}")
            response = self.client.table('garmin_credentials')\
                .select('email, password')\
                .eq('user_id', self.user_id)\
                .execute()
            if response.data:
                credentials = response.data[0] if isinstance(response.data, list) else response.data
                print(f"Found credentials with email: {credentials['email']}")
                return credentials
            else:
                print("No Garmin credentials found for user")
                return None
        except Exception as e:
            print(f"Error fetching Garmin credentials: {e}")
            print(f"Full error: {traceback.format_exc()}")
            return None

    def initialize_garmin(self):
        credentials = self.get_garmin_credentials()
        if not credentials:
            raise Exception("No Garmin credentials found for user")
        
        email = credentials.get('email')
        password = credentials.get('password')
        
        print(f"Initializing Garmin client for {email}")
        print(f"Password length: {len(password) if password else 0} characters")
        
        try:
            # Import here at function scope level
            import garminconnect
            
            print("Initializing Garmin client...")
            self.garmin = garminconnect.Garmin(email, password)
            
            print("Logging in to Garmin...")
            self.garmin.login()
            print("Login successful!")
            
            # Test the connection by getting user summary
            try:
                today = datetime.date.today().strftime("%Y-%m-%d")
                summary = self.garmin.get_user_summary(cdate=today)
                user_id = summary.get('userId', 'Unknown')
                print(f"Successfully connected to Garmin account for user ID: {user_id}")
            except Exception as test_err:
                print(f"Warning: Connected to Garmin but couldn't get user summary: {str(test_err)}")
                print("Will continue anyway as we might still be able to access activities")
            
            print("Garmin client initialized and logged in successfully")
            return True
        except Exception as e:
            print(f"Error initializing Garmin client: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            raise Exception(f"Failed to initialize Garmin client: {str(e)}")

    def find_last_existing_date(self):
        """Find the most recent date with data in the database."""
        try:
            result = self.client.table('garmin_data') \
                .select('date') \
                .eq('user_id', self.user_id) \
                .order('date', desc=True) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]['date'].split('T')[0]  # Get just the date part
            else:
                print("No existing data found in the database")
                return None
                
        except Exception as e:
            print(f"Error finding last existing date: {e}")
            return None

    def get_previous_metrics(self, date):
        """Get metrics from the previous day for ATL/CTL/TSB calculations."""
        try:
            # Convert date string to datetime
            date_obj = datetime.datetime.strptime(date, '%Y-%m-%d')
            # Get previous day
            prev_date = (date_obj - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
            
            result = self.client.table('garmin_data') \
                .select('*') \
                .eq('user_id', self.user_id) \
                .eq('date', prev_date) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                # If no previous data exists, return default initial values
                return {
                    'atl': 0,
                    'ctl': 0,
                    'tsb': 0,
                    'trimp': 0
                }
                
        except Exception as e:
            print(f"Error getting previous metrics: {e}")
            # Return default initial values on error
            return {
                'atl': 0,
                'ctl': 0,
                'tsb': 0,
                'trimp': 0
            }

    def calculate_metrics(self, date, trimp, previous_metrics=None):
        """Calculate ATL, CTL, and TSB for a given date."""
        if previous_metrics is None:
            previous_metrics = {
                'atl': 0,
                'ctl': 0,
                'tsb': 0,
                'trimp': 0
            }
        
        try:
            # Constants for ATL and CTL calculations
            ATL_DAYS = 7  # Acute Training Load window
            CTL_DAYS = 42  # Chronic Training Load window
            
            # Calculate new ATL
            prev_atl = float(previous_metrics['atl'])
            new_atl = prev_atl + (trimp - prev_atl) / ATL_DAYS
            
            # Calculate new CTL
            prev_ctl = float(previous_metrics['ctl'])
            new_ctl = prev_ctl + (trimp - prev_ctl) / CTL_DAYS
            
            # Calculate TSB (Training Stress Balance)
            new_tsb = new_ctl - new_atl
            
            return {
                'atl': round(new_atl, 1),
                'ctl': round(new_ctl, 1),
                'tsb': round(new_tsb, 1)
            }
            
        except Exception as e:
            print(f"Error calculating metrics: {e}")
            return {
                'atl': 0,
                'ctl': 0,
                'tsb': 0
            }

    def update_chart_data(self, start_date=None, end_date=None, force_refresh=False):
        """Update the chart data for a given date range."""
        try:
            print(f"\nStarting chart update for user {self.user_id}")
            print(f"Force refresh: {force_refresh}")
            
            # Initialize Garmin connection
            print("Initializing Garmin connection...")
            try:
                self.initialize_garmin()
                print("Garmin connection initialized successfully")
            except Exception as e:
                print(f"Failed to initialize Garmin connection: {e}")
                raise

            print("Finding last existing date...")
            try:
                last_date = self.find_last_existing_date()
                print(f"Last date: {last_date}")
            except Exception as e:
                print(f"Failed to find last existing date: {e}")
                last_date = None

            # If no end_date provided, use today
            if not end_date:
                end_date = datetime.datetime.now().date()
            elif isinstance(end_date, str):
                end_date = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()

            # If no start_date provided, use appropriate default
            if not start_date:
                if last_date and not force_refresh:
                    # Start from the day after the last date
                    start_date = datetime.datetime.strptime(last_date, '%Y-%m-%d').date() + datetime.timedelta(days=1)
                    print(f"Starting from day after last date: {start_date}")
                else:
                    # If force refresh or no last date, start from 180 days ago
                    start_date = end_date - datetime.timedelta(days=180)
                    print(f"Starting from {start_date} (180 days before end date)")
            elif isinstance(start_date, str):
                start_date = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()

            # If force refresh is enabled, extend start date
            if force_refresh and last_date:
                force_start = datetime.datetime.strptime(last_date, '%Y-%m-%d').date()
                start_date = min(start_date, force_start)
                print(f"Force refresh enabled, extended start date to: {start_date}")

            # Ensure start_date is not after end_date
            if start_date > end_date:
                print("Start date is after end date, nothing to update")
                return {'success': True, 'updated_count': 0}

            print(f"\nProcessing dates from {start_date} to {end_date}")
            
            updated_count = 0
            current_date = start_date

            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                
                # Get activities for this date
                activities = self.get_activities_for_date(date_str)
                
                # Get existing data for this date
                existing_data = self.client.table('garmin_data').select('*').eq('user_id', self.user_id).eq('date', date_str).execute()
                
                if activities:
                    trimp_total = sum(activity.get('trimp', 0) for activity in activities)
                    activity_names = [activity.get('name', 'Unknown Activity') for activity in activities]
                    activity_str = ','.join(activity_names) if activity_names else 'Rest Day'
                elif existing_data.data and len(existing_data.data) > 0:
                    # Preserve existing data if no new activities found
                    print(f"Preserving existing data for {date_str}")
                    trimp_total = existing_data.data[0].get('trimp', 0)
                    activity_str = existing_data.data[0].get('activity', 'Rest Day')
                else:
                    trimp_total = 0
                    activity_str = 'Rest Day'
                
                # Update the database
                self.update_database_entry(self.user_id, date_str, trimp_total, activity_str.split(',') if activity_str != 'Rest Day' else [])
                
                updated_count += 1
                current_date += datetime.timedelta(days=1)
            
            print(f"\nUpdated {updated_count} days of data")
            return {'success': True, 'updated_count': updated_count}
            
        except Exception as e:
            error_message = f"Error in update_chart_data:\nError type: {type(e).__name__}\nError message: {str(e)}\nTraceback:\n{traceback.format_exc()}"
            print(error_message)
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

    def get_activities_for_date(self, date):
        """Get activities for a specific date."""
        try:
            # Ensure date is in the correct string format
            if isinstance(date, datetime.date):
                date_str = date.strftime('%Y-%m-%d')
            else:
                # Validate the string format
                try:
                    datetime.datetime.strptime(date, '%Y-%m-%d')
                    date_str = date
                except ValueError as e:
                    print(f"Invalid date format: {e}")
                    return []

            # Get activities from Garmin
            activities = self.garmin.get_activities_for_date(date_str)
            if activities:
                print(f"Found {len(activities)} activities for {date_str}")
                for activity in activities:
                    activity_id = activity.get('activityId')
                    trimp = activity.get('trimp', 0)
                    activity_name = activity.get('activityName', 'Unknown Activity')
                    print(f"Activity {activity_name} (ID: {activity_id}): TRIMP = {trimp}")
                    self.processed_activity_ids.add(activity_id)
            else:
                print(f"No activities found for {date_str}")
            
            return activities
            
        except Exception as e:
            print(f"Error fetching activities for {date}: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return []

    def update_database_entry(self, user_id, date, garmin_trimp, garmin_activities):
        """Update or insert a new entry in the database for a specific date."""
        try:
            # Ensure date is in the correct string format
            if isinstance(date, datetime.date):
                date_str = date.strftime('%Y-%m-%d')
            else:
                # Validate the string format
                try:
                    datetime.datetime.strptime(date, '%Y-%m-%d')
                    date_str = date
                except ValueError as e:
                    print(f"Invalid date format: {e}")
                    return

            # First check if we already have data for this date
            existing_data = self.client.table('garmin_data').select('*').eq('user_id', user_id).eq('date', date_str).execute()
            
            # Fetch manual data for this date
            manual_data = self.client.table('manual_data').select('*').eq('user_id', user_id).eq('date', date_str).execute()
            
            # Initialize variables
            manual_trimp = 0
            manual_activities = []
            
            # Process manual data if it exists
            if manual_data.data:
                for entry in manual_data.data:
                    manual_trimp += entry.get('trimp', 0)
                    if entry.get('activity_name'):
                        manual_activities.append(entry['activity_name'])
            
            # Calculate total TRIMP
            total_trimp = garmin_trimp + manual_trimp
            
            # Get previous day's metrics for calculations
            previous_metrics = self.get_previous_metrics(date_str)
            
            # Calculate new metrics
            new_metrics = self.calculate_metrics(date_str, total_trimp, previous_metrics)
            
            # Combine activities, ensuring no duplicates
            all_activities = []
            if existing_data.data:
                existing_activities = existing_data.data[0].get('activity', '').split(',')
                existing_activities = [a.strip() for a in existing_activities if a.strip() and a.strip() != 'Rest Day']
                all_activities.extend(existing_activities)
            
            if garmin_activities:
                all_activities.extend([a.strip() for a in garmin_activities if a.strip()])
            if manual_activities:
                all_activities.extend([a.strip() for a in manual_activities if a.strip()])
            
            # Remove duplicates while preserving order
            seen = set()
            unique_activities = []
            for activity in all_activities:
                activity = activity.strip()
                if activity and activity != 'Rest Day' and activity not in seen:
                    seen.add(activity)
                    unique_activities.append(activity)
            
            # Convert activities list to string - no spaces after commas
            activities_str = ','.join(unique_activities) if unique_activities else 'Rest Day'
            
            print(f"Updating database for {date_str}:")
            print(f"  Garmin TRIMP: {garmin_trimp}")
            print(f"  Manual TRIMP: {manual_trimp}")
            print(f"  Total TRIMP: {total_trimp}")
            print(f"  Activities: {activities_str}")
            print(f"  New Metrics - ATL: {new_metrics['atl']}, CTL: {new_metrics['ctl']}, TSB: {new_metrics['tsb']}")
            
            # Convert date to ISO format with timezone
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            date_iso = date_obj.replace(tzinfo=datetime.timezone.utc).isoformat()
            
            # Upsert the data
            data = {
                'user_id': user_id,
                'date': date_iso,
                'trimp': total_trimp,
                'activity': activities_str,
                'atl': new_metrics['atl'],
                'ctl': new_metrics['ctl'],
                'tsb': new_metrics['tsb']
            }
            
            result = self.client.table('garmin_data').upsert(data, on_conflict='user_id,date').execute()
            print(f"Database update result: {result}")
            
        except Exception as e:
            print(f"Error updating database entry: {e}")
            raise

    def process_activity(self, activity, date_str):
        """Process a single activity and extract TRIMP data"""
        try:
            activity_id = activity.get('activityId')
            activity_name = activity.get('activityName', 'Unknown')
            activity_type = activity.get('activityType', {}).get('typeKey', 'unknown')
            
            print(f"Processing activity: {activity_name} (ID: {activity_id}, Type: {activity_type})")
            
            # For strength training, we'll use a different approach
            if activity_type == 'strength_training':
                return self.process_strength_training(activity, date_str)
            
            # Try to get detailed activity data to extract TRIMP
            try:
                activity_details = self.garmin.get_activity_details(activity_id)
                
                # Look for connectIQMeasurements which contains TRIMP data
                if 'connectIQMeasurements' in activity_details:
                    measurements = activity_details['connectIQMeasurements']
                    print(f"Found connectIQMeasurements with {len(measurements)} items")
                    
                    # The TRIMP value is typically in the measurement with developerFieldNumber 4
                    for measurement in measurements:
                        if measurement.get('developerFieldNumber') == 4:
                            trimp_value = float(measurement.get('value', 0))
                            print(f"FOUND TRIMP: {trimp_value}")
                            
                            # Update the current date's data
                            if date_str in self.data:
                                self.data[date_str]['trimp'] += trimp_value
                                self.data[date_str]['activity_count'] += 1
                            else:
                                self.data[date_str] = {
                                    'trimp': trimp_value,
                                    'activity_count': 1
                                }
                            
                            return True
                
                # Fallback to calculated TRIMP if no connectIQ measurements found
                return self.calculate_trimp_from_activity(activity, date_str)
                
            except Exception as e:
                print(f"Error getting activity details: {e}")
                # Fallback to calculated TRIMP
                return self.calculate_trimp_from_activity(activity, date_str)
            
        except Exception as e:
            print(f"Error processing activity: {e}")
            return False

    def calculate_trimp_from_activity(self, activity, date_str):
        """Calculate TRIMP from activity data as a fallback method"""
        try:
            # Extract relevant data
            duration_minutes = activity.get('duration', 0) / 60  # Convert to minutes
            avg_hr = activity.get('averageHR', 0)
            
            if duration_minutes <= 0 or avg_hr <= 0:
                print("Activity missing duration or heart rate data, can't calculate TRIMP")
                return False
            
            # Get user profile to determine max HR
            try:
                today = datetime.date.today().strftime("%Y-%m-%d")
                user_profile = self.garmin.get_user_summary(cdate=today)
                max_hr = user_profile.get('userMetrics', {}).get('maxHeartRate', 220)
                if not max_hr or max_hr <= 0:
                    max_hr = 220  # Default max HR if not available
            except:
                # Use a default calculation if profile not available
                max_hr = 220
            
            # Calculate heart rate reserve
            hr_reserve_percent = (avg_hr - 60) / (max_hr - 60)
            
            # Calculate TRIMP using Banister's formula
            gender_factor = 1.92  # For males, use 1.67 for females
            trimp = duration_minutes * hr_reserve_percent * 0.64 * math.exp(gender_factor * hr_reserve_percent)
            
            print(f"Calculated TRIMP: {trimp:.2f} for activity {activity.get('activityName')}")
            
            # Update the current date's data
            if date_str in self.data:
                self.data[date_str]['trimp'] += trimp
                self.data[date_str]['activity_count'] += 1
            else:
                self.data[date_str] = {
                    'trimp': trimp,
                    'activity_count': 1
                }
            
            return True
            
        except Exception as e:
            print(f"Error calculating TRIMP: {e}")
            return False

    def process_strength_training(self, activity, date_str):
        """Process strength training activity and estimate TRIMP"""
        try:
            activity_id = activity.get('activityId')
            
            # First try to get TRIMP from connectIQMeasurements
            try:
                activity_details = self.garmin.get_activity_details(activity_id)
                
                # Look for connectIQMeasurements which contains TRIMP data
                if 'connectIQMeasurements' in activity_details:
                    measurements = activity_details['connectIQMeasurements']
                    
                    # The TRIMP value is typically in the measurement with developerFieldNumber 4
                    for measurement in measurements:
                        if measurement.get('developerFieldNumber') == 4:
                            trimp_value = float(measurement.get('value', 0))
                            print(f"FOUND TRIMP for strength training: {trimp_value}")
                            
                            # Update the current date's data
                            if date_str in self.data:
                                self.data[date_str]['trimp'] += trimp_value
                                self.data[date_str]['activity_count'] += 1
                            else:
                                self.data[date_str] = {
                                    'trimp': trimp_value,
                                    'activity_count': 1
                                }
                            
                            return True
            except Exception as e:
                print(f"Error getting strength training details: {e}")
            
            # Fallback to estimation based on duration and HR
            duration_minutes = activity.get('duration', 0) / 60
            avg_hr = activity.get('averageHR', 0)
            
            if duration_minutes <= 0:
                print("Strength training missing duration data")
                return False
            
            # Apply a simplified formula for strength training
            # Strength training typically has lower continuous cardiovascular load
            if avg_hr > 0:
                # If we have HR data, use a simplified TRIMP calculation
                estimated_trimp = duration_minutes * (avg_hr / 180) * 1.2
            else:
                # Without HR data, estimate based on duration only
                estimated_trimp = duration_minutes * 0.8  # Conservative estimate
            
            print(f"Estimated TRIMP for strength training: {estimated_trimp:.2f}")
            
            # Update the current date's data
            if date_str in self.data:
                self.data[date_str]['trimp'] += estimated_trimp
                self.data[date_str]['activity_count'] += 1
            else:
                self.data[date_str] = {
                    'trimp': estimated_trimp,
                    'activity_count': 1
                }
            
            return True
            
        except Exception as e:
            print(f"Error processing strength training: {e}")
            return False

def update_chart_data(user_id, force_refresh=False):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data(force_refresh=force_refresh)
