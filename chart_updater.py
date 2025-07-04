#!/usr/bin/env python3
import os
import datetime
import json
import base64
from garminconnect import Garmin
from supabase import create_client, Client
from dotenv import load_dotenv
import traceback
import logging
import time
import math
from datetime import timedelta
from manual_data_processor import batch_fetch_garmin_data, batch_fetch_manual_data

load_dotenv()

class ChartUpdater:
    def __init__(self, user_id):
        self.client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        # Extract user ID from JWT token if it's a token
        if user_id.startswith('eyJ'):
            try:
                # Split the JWT token and decode the payload
                parts = user_id.split('.')
                if len(parts) == 3:
                    payload = parts[1]
                    # Add padding if needed
                    padding = '=' * (4 - len(payload) % 4)
                    payload += padding
                    # Decode the payload
                    decoded = base64.b64decode(payload)
                    user_data = json.loads(decoded)
                    self.user_id = user_data.get('sub')
                    print(f"Extracted user ID from JWT: {self.user_id}")
                else:
                    self.user_id = user_id
            except Exception as e:
                print(f"Error extracting user ID from JWT: {e}")
                self.user_id = user_id
        else:
            self.user_id = user_id
        self.garmin = None
        self.processed_activity_ids = set()
        # Cache for data to reduce database calls
        self.data_cache = {
            'garmin_data': {},
            'manual_data': {}
        }

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
        """Find the last date with any data in the database, looking back at least 7 days."""
        print("Finding last existing date...")
        try:
            # Get the most recent date with any data and its metrics
            result = self.client.table('garmin_data') \
                .select('date, atl, ctl, tsb, trimp') \
                .eq('user_id', self.user_id) \
                .order('date', desc=True) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                # Parse the date string, handling timezone information
                data = result.data[0]
                date_str = data['date']
                try:
                    # First try parsing with timezone
                    last_date = datetime.datetime.fromisoformat(date_str).date()
                except ValueError:
                    # If that fails, try parsing just the date part
                    last_date = datetime.datetime.strptime(date_str.split('T')[0], '%Y-%m-%d').date()
                
                print(f"Found last date with data: {last_date}")
                
                # Get the date 7 days before today
                seven_days_ago = datetime.datetime.now().date() - datetime.timedelta(days=7)
                
                # If the last date is more than 7 days ago, use 7 days ago instead
                if last_date < seven_days_ago:
                    print(f"Last date is more than 7 days old, using {seven_days_ago} instead")
                    last_date = seven_days_ago
                    return last_date, {'atl': 0, 'ctl': 0, 'tsb': 0}
                
                # Return the metrics from the last date
                metrics = {
                    'atl': float(data['atl']),
                    'ctl': float(data['ctl']),
                    'tsb': float(data['tsb'])
                }
                print(f"Last metrics: ATL: {metrics['atl']}, CTL: {metrics['ctl']}, TSB: {metrics['tsb']}")
                print(f"Last date: {last_date}")
                return last_date, metrics
            else:
                print("No existing data found")
                # If no data found, return 7 days ago
                seven_days_ago = datetime.datetime.now().date() - datetime.timedelta(days=7)
                print(f"Using {seven_days_ago} as start date")
                return seven_days_ago, {'atl': 0, 'ctl': 0, 'tsb': 0}
        except Exception as e:
            print(f"Error finding last existing date: {e}")
            # If error occurs, return 7 days ago
            seven_days_ago = datetime.datetime.now().date() - datetime.timedelta(days=7)
            print(f"Error occurred, using {seven_days_ago} as start date")
            return seven_days_ago, {'atl': 0, 'ctl': 0, 'tsb': 0}

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

    def update_chart_data(self, start_date=None, end_date=None, force_refresh=False):
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

            # If force refresh is enabled, we'll reprocess recent days regardless
            if force_refresh:
                if not end_date:
                    end_date = datetime.date.today()
                if not start_date:
                    # When force refreshing, just process the last 3 days by default
                    start_date = end_date - datetime.timedelta(days=3)
                print(f"Force refresh enabled, processing dates from {start_date} to {end_date}")
            else:
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
                    # Start from the day AFTER the last date
                    start_date = last_date + datetime.timedelta(days=1)
                    print(f"Found existing data for {last_date}, starting from {start_date}")
                
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
            
            # Batch fetch all garmin_data and manual_data for the date range to reduce database calls
            # This is a key optimization to reduce API usage
            start_date_str = start_date.strftime('%Y-%m-%d')
            end_date_str = end_date.strftime('%Y-%m-%d')
            
            # Get all garmin_data for the date range
            garmin_data_list = batch_fetch_garmin_data(self.user_id, start_date_str, end_date_str)
            
            # Get all manual_data for the date range
            manual_data_list = batch_fetch_manual_data(self.user_id, start_date_str, end_date_str)
            
            # Organize data by date for faster lookup
            for item in garmin_data_list:
                date_str = item['date'].split('T')[0] if 'T' in item['date'] else item['date']
                self.data_cache['garmin_data'][date_str] = item
                
            # Group manual data by date
            for item in manual_data_list:
                date_str = item['date'].split('T')[0] if 'T' in item['date'] else item['date']
                if date_str not in self.data_cache['manual_data']:
                    self.data_cache['manual_data'][date_str] = []
                self.data_cache['manual_data'][date_str].append(item)
            
            # If we're not force refreshing, we need the previous metrics
            if not force_refresh and last_date:
                print(f"\n=== Initial metrics from {last_date} ===")
                print(f"ATL: {previous_metrics['atl']}, CTL: {previous_metrics['ctl']}, TSB: {previous_metrics['tsb']}\n")
            else:
                # If force refreshing, get the metrics from the day before start_date
                day_before = start_date - datetime.timedelta(days=1)
                day_before_str = day_before.strftime('%Y-%m-%d')
                previous_metrics = self.get_previous_day_metrics(start_date.strftime('%Y-%m-%d'))
                print(f"\n=== Using metrics from {day_before} for calculation ===")
                print(f"ATL: {previous_metrics['atl']}, CTL: {previous_metrics['ctl']}, TSB: {previous_metrics['tsb']}\n")
            
            updated_count = 0
            
            for date in date_range:
                date_str = date.strftime('%Y-%m-%d')
                logging.info(f"Processing date: {date_str}")
                
                # Get existing data for this date from cache
                existing_data = self.data_cache['garmin_data'].get(date_str)
                
                # Skip if data already exists and we're not force refreshing
                if existing_data and not force_refresh:
                    print(f"Data already exists for {date_str}, skipping...")
                    continue
                
                # Get previous day's metrics
                previous_metrics = self.get_previous_day_metrics(date_str)
                
                # Get activities for this date
                activities = self.get_activities_for_date(date)
                
                # Calculate total TRIMP for all activities on this date
                trimp_total = 0
                activity_names = []
                
                if activities:
                    print(f"Found {len(activities)} activities for {date_str}")
                    for activity in activities:
                        activity_id = activity.get('activityId')
                        trimp = activity.get('trimp', 0)
                        trimp_total += float(trimp)
                        activity_name = activity.get('activityName', 'Unknown Activity')
                        activity_names.append(activity_name)
                        print(f"Activity {activity_name} (ID: {activity_id}): TRIMP = {trimp}")
                        self.processed_activity_ids.add(activity_id)
                else:
                    print(f"No activities found for {date_str}")
                
                # If no new activities but we have existing data with TRIMP > 0, preserve it
                if trimp_total == 0 and existing_data and existing_data.get('trimp', 0) > 0:
                    print(f"Preserving existing data for {date_str} with TRIMP {existing_data.get('trimp')}")
                    trimp_total = existing_data.get('trimp')
                    if existing_data.get('activity') and existing_data.get('activity') != 'Rest Day':
                        activity_names = existing_data.get('activity').split(', ')
                
                # Get manual data for this date from cache
                manual_data = self.data_cache['manual_data'].get(date_str, [])
                
                # Add manual TRIMP and activities
                manual_trimp = sum(float(entry.get('trimp', 0)) for entry in manual_data)
                manual_activities = [entry.get('activity_name') for entry in manual_data if entry.get('activity_name')]
                
                # Combine Garmin and manual data
                combined_trimp = trimp_total + manual_trimp
                combined_activities = activity_names + manual_activities
                
                # Remove duplicates and filter out empty strings
                combined_activities = list(set(filter(None, combined_activities)))
                activity_str = ', '.join(combined_activities) if combined_activities else 'Rest Day'
                
                # Calculate new metrics
                new_metrics = self.calculate_new_metrics(combined_trimp, previous_metrics)
                
                # Store the metrics we just calculated as they'll be needed for the next day
                previous_metrics = new_metrics
                
                # Update the database
                self.update_database_entry(date_str, combined_trimp, new_metrics, activity_str, force_refresh)
                
                print(f"Updated metrics for {date_str}: TRIMP={combined_trimp}, Activity={activity_str}")
                print(f"Metrics: ATL={new_metrics['atl']}, CTL={new_metrics['ctl']}, TSB={new_metrics['tsb']}")
                
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
        # First check the cache
        if date_str in self.data_cache['garmin_data']:
            return self.data_cache['garmin_data'][date_str]
            
        try:
            # Always use 'YYYY-MM-DD' format for date
            response = self.client.table('garmin_data') \
                .select('trimp, activity, atl, ctl, tsb') \
                .eq('user_id', self.user_id) \
                .eq('date', date_str) \
                .execute()
            if response.data and len(response.data) > 0:
                # Update cache
                self.data_cache['garmin_data'][date_str] = response.data[0]
                return response.data[0]
            return None
        except Exception as e:
            print(f"Error getting existing data for {date_str}: {e}")
            return None

    def get_previous_day_metrics(self, date_str):
        # Convert date_str to datetime and get previous day
        current_date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
        previous_date = current_date - datetime.timedelta(days=1)
        previous_date_str = previous_date.strftime('%Y-%m-%d')
        
        # First check the cache for the previous day
        if previous_date_str in self.data_cache['garmin_data']:
            data = self.data_cache['garmin_data'][previous_date_str]
            if data.get('atl') is not None:
                return {
                    'atl': float(data['atl']),
                    'ctl': float(data['ctl']),
                    'tsb': float(data['tsb'])
                }
        
        # If not in cache, query the database
        response = self.client.table('garmin_data') \
            .select('trimp, atl, ctl, tsb') \
            .eq('user_id', self.user_id) \
            .eq('date', previous_date_str) \
            .execute()
            
        if response.data and ((isinstance(response.data, list) and len(response.data) > 0) or (not isinstance(response.data, list))):
            data = response.data[0] if isinstance(response.data, list) else response.data
            # Update cache
            self.data_cache['garmin_data'][previous_date_str] = data
            return {
                'atl': float(data['atl']),
                'ctl': float(data['ctl']),
                'tsb': float(data['tsb'])
            }
        else:
            # If no previous day data, look for the most recent metrics before this date
            response = self.client.table('garmin_data') \
                .select('trimp, atl, ctl, tsb') \
                .eq('user_id', self.user_id) \
                .lt('date', date_str) \
                .order('date', desc=True) \
                .limit(1) \
                .execute()
                
            if response.data and len(response.data) > 0:
                data = response.data[0]
                print(f"Found metrics from {data.get('date')} to use for {date_str}")
                return {
                    'atl': float(data['atl']),
                    'ctl': float(data['ctl']),
                    'tsb': float(data['tsb'])
                }
            else:
                # If no data found at all, use zeros
                print(f"No previous metrics found for {date_str}, using zeros")
                return {'atl': 0, 'ctl': 0, 'tsb': 0}

    def get_activities_for_date(self, date):
        try:
            date_str = date.strftime('%Y-%m-%d')
            print(f"\nFetching activities for {date_str}")
            
            # Make sure we're logged in
            if not self.garmin:
                print("Garmin client not initialized, initializing now...")
                self.initialize_garmin()
            
            # Try to get activities with multiple methods
            activities = []
            
            # Method 1: Direct date query
            print(f"Method 1: Calling get_activities_by_date for {date_str}")
            try:
                # Updated API call for garminconnect 0.2.25 - without activityType parameter
                day_activities = self.garmin.get_activities_by_date(
                    date_str,
                    date_str
                )
                if day_activities:
                    print(f"Method 1 found {len(day_activities)} activities")
                    activities = day_activities
                else:
                    print("Method 1 found no activities")
            except Exception as e:
                print(f"Method 1 error: {e}")
            
            # Method 2: Get recent activities and filter
            if not activities:
                print(f"Method 2: Getting recent activities and filtering for {date_str}")
                try:
                    # Updated API call for garminconnect 0.2.25
                    recent_activities = self.garmin.get_activities(0, 30)  # Get 30 most recent activities
                    print(f"Method 2 found {len(recent_activities)} recent activities total")
                    
                    # Filter for the target date - fix date format check
                    date_activities = []
                    for activity in recent_activities:
                        # Check for different date formats based on 0.2.25 API
                        activity_date = None
                        if 'startTimeLocal' in activity:
                            activity_date = activity['startTimeLocal'].split()[0]
                        elif 'startTimeGMT' in activity:
                            activity_date = activity['startTimeGMT'].split()[0]
                        elif 'startTime' in activity:
                            activity_date = activity['startTime'].split('T')[0]
                        
                        if activity_date == date_str:
                            date_activities.append(activity)
                    
                    if date_activities:
                        print(f"Method 2 found {len(date_activities)} activities for {date_str}")
                        activities = date_activities
                    else:
                        print(f"Method 2 found no activities for {date_str}")
                except Exception as e:
                    print(f"Method 2 error: {e}")
                    print(f"Method 2 error traceback: {traceback.format_exc()}")
            
            # Method 3: Try a week-based approach
            if not activities:
                print(f"Method 3: Getting a week of activities including {date_str}")
                try:
                    # Start from 3 days before the target date
                    week_start = date - datetime.timedelta(days=3)
                    # End 3 days after the target date
                    week_end = date + datetime.timedelta(days=3)
                    
                    # Updated API call without activityType parameter
                    week_activities = self.garmin.get_activities_by_date(
                        week_start.strftime("%Y-%m-%d"),
                        week_end.strftime("%Y-%m-%d")
                    )
                    
                    print(f"Method 3 found {len(week_activities)} activities for the week")
                    
                    # Filter for the target date
                    date_activities = []
                    for activity in week_activities:
                        # Check for different date formats based on 0.2.25 API
                        activity_date = None
                        if 'startTimeLocal' in activity:
                            activity_date = activity['startTimeLocal'].split()[0]
                        elif 'startTimeGMT' in activity:
                            activity_date = activity['startTimeGMT'].split()[0]
                        elif 'startTime' in activity:
                            activity_date = activity['startTime'].split('T')[0]
                        
                        if activity_date == date_str:
                            date_activities.append(activity)
                    
                    if date_activities:
                        print(f"Method 3 found {len(date_activities)} activities for {date_str}")
                        activities = date_activities
                    else:
                        print(f"Method 3 found no activities for {date_str}")
                except Exception as e:
                    print(f"Method 3 error: {e}")
                    print(f"Method 3 error traceback: {traceback.format_exc()}")
            
            # Method 4: Try a different API endpoint as a last resort
            if not activities:
                print(f"Method 4: Using get_last_activity and checking date {date_str}")
                try:
                    # Try to get the last activity and check its date
                    last_activity = self.garmin.get_last_activity()
                    if last_activity:
                        # Check for different date formats based on 0.2.25 API
                        activity_date = None
                        if 'startTimeLocal' in last_activity:
                            activity_date = last_activity['startTimeLocal'].split()[0]
                        elif 'startTimeGMT' in last_activity:
                            activity_date = last_activity['startTimeGMT'].split()[0]
                        elif 'startTime' in last_activity:
                            activity_date = last_activity['startTime'].split('T')[0]
                        
                        print(f"Last activity date: {activity_date}")
                        
                        if activity_date == date_str:
                            print(f"Method 4 found activity for {date_str}")
                            activities = [last_activity]
                        else:
                            print(f"Method 4 found activity but not for {date_str}")
                except Exception as e:
                    print(f"Method 4 error: {e}")
                    print(f"Method 4 error traceback: {traceback.format_exc()}")
            
            if not activities:
                print(f"No activities found for {date_str} with any method")
                return []
                
            print(f"Found {len(activities)} total activities for {date_str}")
            
            # Fetch TRIMP values for each activity
            activities_with_trimp = []
            for activity in activities:
                activity_id = activity.get('activityId')
                activity_name = activity.get('activityName', 'Unknown Activity')
                
                # Get activity date based on various possible fields
                activity_date = None
                if 'startTimeLocal' in activity:
                    activity_date = activity['startTimeLocal'].split()[0]
                elif 'startTimeGMT' in activity:
                    activity_date = activity['startTimeGMT'].split()[0]
                elif 'startTime' in activity:
                    activity_date = activity['startTime'].split('T')[0]
                
                print(f"Processing activity: {activity_name} (ID: {activity_id}, Date: {activity_date})")
                
                try:
                    # Get detailed activity data to find TRIMP
                    print(f"Fetching details for activity {activity_id}")
                    try:
                        # Try get_activity to get details
                        details = self.garmin.get_activity(activity_id)
                        print("Successfully retrieved activity data with get_activity")
                    except Exception as details_err:
                        print(f"Error with get_activity: {details_err}")
                        raise
                    
                    # Debug the returned keys
                    detail_keys = list(details.keys())
                    print(f"Activity details keys: {detail_keys}")
                    
                    trimp = 0.0
                    trimp_method = "not found"
                    
                    # ONLY check connectIQMeasurements for TRIMP - no calculations
                    if 'connectIQMeasurements' in details and details['connectIQMeasurements']:
                        print(f"Found connectIQMeasurements with {len(details['connectIQMeasurements'])} items")
                        
                        # Print each measurement to inspect
                        for i, item in enumerate(details['connectIQMeasurements']):
                            print(f"Measurement {i+1}: {item}")
                            
                            # Look for TRIMP specifically in developer field 4
                            if 'value' in item and item.get('developerFieldNumber') == 4:
                                try:
                                    trimp = round(float(item.get('value', 0)), 1)
                                    trimp_method = "connectIQMeasurements"
                                    print(f"FOUND TRIMP in measurements: {trimp}")
                                    break
                                except (ValueError, TypeError):
                                    print(f"Failed to convert TRIMP value: {item.get('value')}")
                    else:
                        print("No connectIQMeasurements found, TRIMP remains 0")
                    
                    # Double TRIMP for strength training activities if TRIMP > 0
                    activity_type = activity.get('activityType', {})
                    if isinstance(activity_type, dict):
                        activity_type = activity_type.get('typeKey', '')
                    
                    if trimp > 0 and ('strength' in str(activity_type).lower() or 
                                      'siła' in activity_name.lower()):
                        old_trimp = trimp
                        trimp *= 2
                        print(f"Applied 2x multiplier for strength training: {old_trimp} -> {trimp}")
                    
                    activity['trimp'] = trimp
                    activities_with_trimp.append(activity)
                    print(f"Added activity {activity_name} with TRIMP = {trimp} (method: {trimp_method})")
                    
                    # Add a small delay to avoid rate limiting
                    time.sleep(1)
                    
                except Exception as e:
                    print(f"Error getting details for activity {activity_id}: {str(e)}")
                    print(f"Traceback: {traceback.format_exc()}")
                    # Still include the activity but with 0 TRIMP
                    activity['trimp'] = 0
                    activities_with_trimp.append(activity)
            
            return activities_with_trimp
        except Exception as e:
            print(f"Error fetching activities for {date}: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return []

    def update_database_entry(self, date_str, trimp_total, new_metrics, activity_str, force_refresh=False):
        try:
            date_key = date_str  # Always 'YYYY-MM-DD'

            # Get manual data from cache
            manual_data = self.data_cache['manual_data'].get(date_key, [])
            manual_trimp = sum(float(entry['trimp']) for entry in manual_data if entry.get('trimp'))
            manual_activities = [entry['activity_name'] for entry in manual_data if entry.get('activity_name')]

            # Get existing Garmin data from cache
            existing_data = self.data_cache['garmin_data'].get(date_key)
            existing_trimp = 0
            existing_activities = []
            if existing_data:
                existing_trimp = float(existing_data.get('trimp', 0))
                if existing_data.get('activity') and existing_data.get('activity') != 'Rest Day':
                    existing_activities = existing_data.get('activity').split(', ')

            # Combine all TRIMP and activities (Garmin, manual, existing)
            total_trimp = trimp_total + manual_trimp
            all_activities = []
            if activity_str != 'Rest Day':
                all_activities.extend(activity_str.split(', '))
            all_activities.extend(manual_activities)
            all_activities.extend([a for a in existing_activities if a not in all_activities])
            combined_activity_str = ', '.join(all_activities) if all_activities else 'Rest Day'

            print(f"Preparing to update/insert data for {date_key}:")
            print(f"Garmin TRIMP: {trimp_total} | Manual TRIMP: {manual_trimp} | Total TRIMP: {total_trimp}")
            print(f"ATL: {new_metrics['atl']} | CTL: {new_metrics['ctl']} | TSB: {new_metrics['tsb']}")

            # Use upsert to ensure only one row per user/date
            upsert_data = {
                'date': date_key,
                'trimp': total_trimp,
                'activity': combined_activity_str,
                'user_id': self.user_id,
                'atl': new_metrics['atl'],
                'ctl': new_metrics['ctl'],
                'tsb': new_metrics['tsb']
            }
            
            # Update the database
            self.client.table('garmin_data').upsert(upsert_data, on_conflict=['user_id', 'date']).execute()
            
            # Update the cache
            self.data_cache['garmin_data'][date_key] = upsert_data
            
            print(f"Upserted row for {date_key}")

        except Exception as e:
            print(f"Error updating/inserting metrics for {date_str}: {e}")
            print(f"Traceback: {traceback.format_exc()}")

def update_chart_data(user_id, force_refresh=False):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data(force_refresh=force_refresh)