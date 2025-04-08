#!/usr/bin/env python3
import os
import datetime
from garminconnect import Garmin
from supabase import create_client, Client
from dotenv import load_dotenv
import traceback
import logging
import time

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
            # Create API client with basic initialization
            print("Creating Garmin client...")
            self.garmin = Garmin(email, password)
            
            print("Attempting Garmin login...")
            try:
                # Try to get user info first to verify credentials
                today = datetime.date.today().strftime('%Y-%m-%d')
                print(f"Calling get_user_summary with date: {today}")
                self.garmin.get_user_summary(today)
                print("Successfully logged into Garmin using get_user_summary")
            except Exception as e:
                print(f"Failed to get user info: {str(e)}")
                print(f"Full error from get_user_summary: {traceback.format_exc()}")
                print("Falling back to regular login method...")
                try:
                    self.garmin.login()
                    print("Successfully logged into Garmin with regular login")
                except Exception as login_err:
                    print(f"Regular login also failed: {str(login_err)}")
                    print(f"Full error from login: {traceback.format_exc()}")
                    # Try one more time with direct session validation
                    print("Attempting final authentication check...")
                    try:
                        # Check if we can access the user's profile as a final check
                        user_info = self.garmin.get_user_info()
                        displayName = user_info.get('displayName', 'Unknown')
                        print(f"Successfully verified login with user info: {displayName}")
                    except Exception as profile_err:
                        print(f"Profile check also failed: {str(profile_err)}")
                        raise Exception(f"All Garmin authentication methods failed for {email}")
            
            # Verify we can access activities API
            print("Verifying access to activities API...")
            try:
                # Try to get a single recent activity to verify API access
                activities = self.garmin.get_activities(0, 1)
                if activities:
                    print(f"Successfully verified access to activities API, found {len(activities)} recent activities")
                else:
                    print("Warning: No recent activities found. This might be normal if the user has no activities.")
            except Exception as api_err:
                print(f"Warning: Could not verify activities API access: {str(api_err)}")
                print(f"API access error: {traceback.format_exc()}")
                print("Continuing anyway, will try again when fetching specific dates")
            
            print("Garmin client initialized and logged in successfully")
            return True
        except Exception as e:
            print(f"Error initializing Garmin client: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            raise Exception(f"Failed to initialize Garmin client: {str(e)}")

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
                
                # Get existing data for this date
                existing_data = self.get_existing_data(date_str)
                
                # Get previous day's metrics
                previous_metrics = self.get_previous_day_metrics(date_str)
                
                # Get activities for this date - FIXED: Properly get and process activities
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
                
                # Calculate new metrics
                new_metrics = self.calculate_new_metrics(trimp_total, previous_metrics)
                
                # Determine activity string
                activity_str = ', '.join(activity_names) if activity_names else 'Rest Day'
                
                # Store the metrics we just calculated as they'll be needed for the next day
                previous_metrics = new_metrics
                
                # Update the database
                self.update_database_entry(date_str, trimp_total, new_metrics, activity_str)
                
                print(f"Updated metrics for {date_str}: TRIMP={trimp_total}, Activity={activity_str}")
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
            date_str = date.strftime('%Y-%m-%d')
            print(f"\nFetching activities for {date_str}")
            
            # Make sure we're logged in
            if not self.garmin:
                print("Garmin client not initialized, initializing now...")
                self.initialize_garmin()
            
            # Check what URLs we have access to
            try:
                print("Verifying Garmin access by fetching user info...")
                now_date = datetime.datetime.now().strftime('%Y-%m-%d')
                user_info = self.garmin.get_user_info()
                print(f"User profile accessible: {user_info.get('displayName', 'Unknown')}")
            except Exception as e:
                print(f"Warning: Could not access user profile: {str(e)}")
                
            # Try to get activities for the week to see if we have any activities at all
            try:
                # Get activities for the week
                print(f"Attempting to fetch activities for the week...")
                week_start = date - datetime.timedelta(days=date.weekday())
                week_end = week_start + datetime.timedelta(days=6)
                week_start_str = week_start.strftime('%Y-%m-%d')
                week_end_str = week_end.strftime('%Y-%m-%d')
                week_activities = self.garmin.get_activities_by_date(
                    week_start_str, 
                    week_end_str
                )
                print(f"Found {len(week_activities)} activities for the whole week")
                if week_activities:
                    print(f"Week activities dates: {[a.get('startTimeLocal', '').split()[0] for a in week_activities[:5]]}")
            except Exception as week_err:
                print(f"Failed to get week activities: {str(week_err)}")
            
            # Get activities from Garmin for this specific date
            print(f"Calling get_activities_by_date for {date_str}")
            activities = self.garmin.get_activities_by_date(
                date_str,
                date_str
            )
            
            if not activities:
                print(f"No activities found for {date_str}, trying alternative method...")
                try:
                    # Try an alternative approach by getting all activities and filtering
                    recent_activities = self.garmin.get_activities(0, 20)  # Get most recent 20 activities
                    print(f"Fetched {len(recent_activities)} recent activities")
                    
                    # Filter activities for the desired date
                    filtered_activities = []
                    for activity in recent_activities:
                        activity_date = activity.get('startTimeLocal', '').split()[0]
                        if activity_date == date_str:
                            filtered_activities.append(activity)
                    
                    if filtered_activities:
                        print(f"Found {len(filtered_activities)} activities for {date_str} using alternative method")
                        activities = filtered_activities
                    else:
                        print(f"No activities found for {date_str} using alternative method either")
                except Exception as alt_err:
                    print(f"Alternative method failed: {str(alt_err)}")
                    print(f"Traceback: {traceback.format_exc()}")
            
            if not activities:
                print(f"No activities found for {date_str}")
                return []
                
            print(f"Found {len(activities)} activities from Garmin Connect")
            
            # Fetch TRIMP values for each activity
            activities_with_trimp = []
            for activity in activities:
                activity_id = activity.get('activityId')
                activity_name = activity.get('activityName', 'Unknown Activity')
                start_time = activity.get('startTimeLocal', 'Unknown Time')
                
                print(f"Processing activity: {activity_name} (ID: {activity_id}, Time: {start_time})")
                
                try:
                    # Get detailed activity data to find TRIMP
                    print(f"Fetching details for activity {activity_id}")
                    details = self.garmin.get_activity(activity_id)
                    
                    # Debug the returned details
                    detail_keys = list(details.keys())
                    print(f"Activity details keys: {detail_keys}")
                    
                    trimp = 0.0
                    trimp_method = "not found"
                    
                    # Look for TRIMP in connectIQMeasurements
                    if 'connectIQMeasurements' in details:
                        print(f"Found connectIQMeasurements with {len(details['connectIQMeasurements'])} items")
                        for item in details['connectIQMeasurements']:
                            print(f"Measurement item: {item}")
                            if item.get('developerFieldNumber') == 4:  # TRIMP field
                                trimp = round(float(item.get('value', 0)), 1)
                                trimp_method = "connectIQMeasurements"
                                print(f"Found TRIMP in connectIQMeasurements: {trimp}")
                                break
                    
                    # If no TRIMP found, we keep it at 0 - no estimation
                    if trimp == 0:
                        print("No TRIMP value found in connectIQMeasurements, keeping value at 0")
                    
                    # Double TRIMP for strength training activities
                    activity_type = activity.get('activityType', {}).get('typeKey', '')
                    if trimp > 0 and ('strength' in activity_type.lower() or activity_name.lower() in ['strength training', 'siła']):
                        old_trimp = trimp
                        trimp *= 2
                        print(f"Applied 2x multiplier for strength training: {old_trimp} -> {trimp}")
                    
                    activity['trimp'] = trimp
                    activities_with_trimp.append(activity)
                    print(f"Added activity {activity_name} with TRIMP = {trimp} (method: {trimp_method})")
                    
                    # Add a small delay to avoid rate limiting
                    time.sleep(0.5)
                    
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

    def update_database_entry(self, date_str, trimp_total, new_metrics, activity_str):
        try:
            # Convert date_str to datetime object
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            date_iso = date_obj.replace(tzinfo=datetime.timezone.utc).isoformat()
            
            print(f"Upserting data for {date_str}:")
            print(f"TRIMP: {trimp_total} | ATL: {new_metrics['atl']} | CTL: {new_metrics['ctl']} | TSB: {new_metrics['tsb']}")
            
            self.client.table('garmin_data').upsert({
                'date': date_iso,
                'trimp': trimp_total,
                'activity': activity_str,
                'user_id': self.user_id,
                **new_metrics
            }, on_conflict='user_id,date').execute()
        except Exception as e:
            print(f"Error upserting metrics for {date_str}: {e}")

def update_chart_data(user_id, force_refresh=False):
    updater = ChartUpdater(user_id)
    return updater.update_chart_data(force_refresh=force_refresh)
