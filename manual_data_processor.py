#!/usr/bin/env python3
import os
import sys
import traceback
from datetime import datetime, timedelta
import pandas as pd
from supabase_client import supabase

def add_manual_entry(user_id, date_str, trimp_value, activity_name):
    """
    Add a manual training entry and recalculate metrics.
    
    Args:
        user_id (str): The user's ID
        date_str (str): Date in YYYY-MM-DD format
        trimp_value (float): TRIMP value for the activity
        activity_name (str): Name of the activity
        
    Returns:
        dict: Result of the operation
    """
    try:
        print(f"\n{'='*50}")
        print(f"ADDING MANUAL TRAINING ENTRY")
        print(f"User: {user_id}, Date: {date_str}, TRIMP: {trimp_value}, Activity: {activity_name}")
        
        # 1. Get existing data for this date
        existing_data = get_existing_data(user_id, date_str)
        
        # 2. Get all manual entries for this date
        manual_entries = get_manual_entries(user_id, date_str)
        
        # 3. Get previous day's metrics for calculation
        previous_metrics = get_previous_day_metrics(user_id, date_str)
        print(f"Previous day metrics: {previous_metrics}")
        
        # 4. Calculate combined TRIMP and activities
        existing_trimp = existing_data.get('trimp', 0) if existing_data else 0
        existing_activity = existing_data.get('activity', 'Rest day') if existing_data else 'Rest day'
        
        # Calculate total TRIMP from all manual entries
        existing_manual_trimp = sum(float(entry.get('trimp', 0)) for entry in manual_entries)
        existing_manual_activities = [entry.get('activity_name') for entry in manual_entries if entry.get('activity_name')]
        
        # Add new entry values
        combined_trimp = float(existing_trimp) + float(trimp_value)
        
        # Combine activities
        combined_activities = []
        if existing_activity != 'Rest day':
            combined_activities.extend(existing_activity.split(', '))
        combined_activities.append(activity_name)
        combined_activities.extend(existing_manual_activities)
        
        # Remove duplicates and filter out empty strings
        combined_activities = list(set(filter(None, combined_activities)))
        activity_str = ', '.join(combined_activities) if combined_activities else 'Rest day'
        
        # 5. Calculate new metrics
        new_metrics = calculate_new_metrics(combined_trimp, previous_metrics)
        print(f"New metrics: {new_metrics}")
        
        # 6. Update the database with new metrics
        update_garmin_data(user_id, date_str, combined_trimp, activity_str, new_metrics)
        
        # 7. Insert the manual entry
        insert_manual_entry(user_id, date_str, trimp_value, activity_name)
        
        # 8. Recalculate metrics for all subsequent dates
        recalculate_metrics_from_date_onwards(user_id, date_str, new_metrics)
        
        print(f"Manual entry added successfully")
        print(f"{'='*50}\n")
        
        return {
            'success': True,
            'message': 'Manual entry added successfully'
        }
        
    except Exception as e:
        print(f"Error adding manual entry: {str(e)}")
        print(traceback.format_exc())
        return {
            'success': False,
            'error': str(e)
        }

def update_manual_entry(entry_id, date_str, trimp_value, activity_name):
    """
    Update an existing manual training entry and recalculate metrics.
    
    Args:
        entry_id (int): The ID of the manual entry to update
        date_str (str): Date in YYYY-MM-DD format
        trimp_value (float): Updated TRIMP value
        activity_name (str): Updated activity name
        
    Returns:
        dict: Result of the operation
    """
    try:
        print(f"\n{'='*50}")
        print(f"UPDATING MANUAL TRAINING ENTRY")
        print(f"Entry ID: {entry_id}, Date: {date_str}, TRIMP: {trimp_value}, Activity: {activity_name}")
        
        # 1. Get the existing entry to determine the user_id
        existing_entry = get_manual_entry_by_id(entry_id)
        if not existing_entry:
            return {
                'success': False,
                'error': 'Manual entry not found'
            }
        
        user_id = existing_entry.get('user_id')
        old_date = existing_entry.get('date')
        old_trimp = existing_entry.get('trimp', 0)
        
        # 2. Update the manual entry
        update_result = update_manual_entry_in_db(entry_id, date_str, trimp_value, activity_name)
        if not update_result:
            return {
                'success': False,
                'error': 'Failed to update manual entry'
            }
        
        # 3. Recalculate metrics for both the old date and new date if they're different
        dates_to_recalculate = [date_str]
        if old_date and old_date != date_str:
            dates_to_recalculate.append(old_date)
        
        for date in dates_to_recalculate:
            # Get all data for this date
            existing_data = get_existing_data(user_id, date)
            manual_entries = get_manual_entries(user_id, date)
            previous_metrics = get_previous_day_metrics(user_id, date)
            
            # Calculate combined TRIMP and activities
            garmin_trimp = existing_data.get('trimp', 0) if existing_data else 0
            garmin_activity = existing_data.get('activity', 'Rest day') if existing_data else 'Rest day'
            
            # Calculate total TRIMP from all manual entries
            manual_trimp = sum(float(entry.get('trimp', 0)) for entry in manual_entries)
            manual_activities = [entry.get('activity_name') for entry in manual_entries if entry.get('activity_name')]
            
            # Combine values
            combined_trimp = float(garmin_trimp) + float(manual_trimp)
            
            # Combine activities
            combined_activities = []
            if garmin_activity != 'Rest day':
                combined_activities.extend(garmin_activity.split(', '))
            combined_activities.extend(manual_activities)
            
            # Remove duplicates and filter out empty strings
            combined_activities = list(set(filter(None, combined_activities)))
            activity_str = ', '.join(combined_activities) if combined_activities else 'Rest day'
            
            # Calculate new metrics
            new_metrics = calculate_new_metrics(combined_trimp, previous_metrics)
            
            # Update the database
            update_garmin_data(user_id, date, combined_trimp, activity_str, new_metrics)
            
            # Recalculate metrics for all subsequent dates
            recalculate_metrics_from_date_onwards(user_id, date, new_metrics)
        
        print(f"Manual entry updated successfully")
        print(f"{'='*50}\n")
        
        return {
            'success': True,
            'message': 'Manual entry updated successfully'
        }
        
    except Exception as e:
        print(f"Error updating manual entry: {str(e)}")
        print(traceback.format_exc())
        return {
            'success': False,
            'error': str(e)
        }

def delete_manual_entry(entry_id):
    """
    Delete a manual training entry and recalculate metrics.
    
    Args:
        entry_id (int): The ID of the manual entry to delete
        
    Returns:
        dict: Result of the operation
    """
    try:
        print(f"\n{'='*50}")
        print(f"DELETING MANUAL TRAINING ENTRY")
        print(f"Entry ID: {entry_id}")
        
        # 1. Get the existing entry to determine the user_id and date
        existing_entry = get_manual_entry_by_id(entry_id)
        if not existing_entry:
            return {
                'success': False,
                'error': 'Manual entry not found'
            }
        
        user_id = existing_entry.get('user_id')
        date_str = existing_entry.get('date')
        trimp_to_remove = existing_entry.get('trimp', 0)
        
        # 2. Delete the manual entry
        delete_result = delete_manual_entry_from_db(entry_id)
        if not delete_result:
            return {
                'success': False,
                'error': 'Failed to delete manual entry'
            }
        
        # 3. Recalculate metrics for the date
        # Get all data for this date
        existing_data = get_existing_data(user_id, date_str)
        manual_entries = get_manual_entries(user_id, date_str)
        previous_metrics = get_previous_day_metrics(user_id, date_str)
        
        # Calculate combined TRIMP and activities
        garmin_trimp = existing_data.get('trimp', 0) if existing_data else 0
        garmin_activity = existing_data.get('activity', 'Rest day') if existing_data else 'Rest day'
        
        # Calculate total TRIMP from all manual entries
        manual_trimp = sum(float(entry.get('trimp', 0)) for entry in manual_entries)
        manual_activities = [entry.get('activity_name') for entry in manual_entries if entry.get('activity_name')]
        
        # Combine values
        combined_trimp = float(garmin_trimp) + float(manual_trimp)
        
        # Combine activities
        combined_activities = []
        if garmin_activity != 'Rest day':
            combined_activities.extend(garmin_activity.split(', '))
        combined_activities.extend(manual_activities)
        
        # Remove duplicates and filter out empty strings
        combined_activities = list(set(filter(None, combined_activities)))
        activity_str = ', '.join(combined_activities) if combined_activities else 'Rest day'
        
        # Calculate new metrics
        new_metrics = calculate_new_metrics(combined_trimp, previous_metrics)
        
        # Update the database
        update_garmin_data(user_id, date_str, combined_trimp, activity_str, new_metrics)
        
        # Recalculate metrics for all subsequent dates
        recalculate_metrics_from_date_onwards(user_id, date_str, new_metrics)
        
        print(f"Manual entry deleted successfully")
        print(f"{'='*50}\n")
        
        return {
            'success': True,
            'message': 'Manual entry deleted successfully'
        }
        
    except Exception as e:
        print(f"Error deleting manual entry: {str(e)}")
        print(traceback.format_exc())
        return {
            'success': False,
            'error': str(e)
        }

def get_existing_data(user_id, date_str):
    """Get existing garmin_data entry for a specific date"""
    try:
        response = supabase.table('garmin_data') \
            .select('*') \
            .eq('user_id', user_id) \
            .eq('date', date_str) \
            .execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error getting existing data for {date_str}: {e}")
        return None

def get_manual_entries(user_id, date_str):
    """Get all manual entries for a specific date"""
    try:
        response = supabase.table('manual_data') \
            .select('*') \
            .eq('user_id', user_id) \
            .eq('date', date_str) \
            .execute()
        
        return response.data or []
    except Exception as e:
        print(f"Error getting manual entries for {date_str}: {e}")
        return []

def get_manual_entry_by_id(entry_id):
    """Get a specific manual entry by ID"""
    try:
        response = supabase.table('manual_data') \
            .select('*') \
            .eq('id', entry_id) \
            .execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error getting manual entry {entry_id}: {e}")
        return None

def get_previous_day_metrics(user_id, date_str):
    """Get metrics from the day before the specified date"""
    try:
        # Convert date_str to datetime and get previous day
        current_date = datetime.strptime(date_str, '%Y-%m-%d')
        previous_date = current_date - timedelta(days=1)
        previous_date_str = previous_date.strftime('%Y-%m-%d')
        
        # First try to get the previous day's metrics
        response = supabase.table('garmin_data') \
            .select('atl, ctl, tsb') \
            .eq('user_id', user_id) \
            .eq('date', previous_date_str) \
            .execute()
            
        if response.data and len(response.data) > 0:
            data = response.data[0]
            return {
                'atl': float(data['atl']) if data['atl'] is not None else 50.0,
                'ctl': float(data['ctl']) if data['ctl'] is not None else 50.0,
                'tsb': float(data['tsb']) if data['tsb'] is not None else 0.0
            }
        
        # If no previous day data, look for the most recent metrics before this date
        response = supabase.table('garmin_data') \
            .select('atl, ctl, tsb') \
            .eq('user_id', user_id) \
            .lt('date', date_str) \
            .order('date', {'ascending': False}) \
            .limit(1) \
            .execute()
            
        if response.data and len(response.data) > 0:
            data = response.data[0]
            return {
                'atl': float(data['atl']) if data['atl'] is not None else 50.0,
                'ctl': float(data['ctl']) if data['ctl'] is not None else 50.0,
                'tsb': float(data['tsb']) if data['tsb'] is not None else 0.0
            }
        
        # If no data found at all, use default values
        return {'atl': 50.0, 'ctl': 50.0, 'tsb': 0.0}
    except Exception as e:
        print(f"Error getting previous day metrics for {date_str}: {e}")
        return {'atl': 50.0, 'ctl': 50.0, 'tsb': 0.0}

def calculate_new_metrics(trimp_value, previous_metrics):
    """Calculate new ATL, CTL, and TSB based on TRIMP and previous metrics"""
    trimp_value = float(trimp_value)
    
    prev_atl = float(previous_metrics['atl'])
    prev_ctl = float(previous_metrics['ctl'])
    
    # Calculate new ATL and CTL
    new_atl = prev_atl + (trimp_value - prev_atl) / 7
    new_ctl = prev_ctl + (trimp_value - prev_ctl) / 42
    
    # TSB is calculated using previous day's values
    new_tsb = prev_ctl - prev_atl
    
    # Round to 2 decimal places
    return {
        'atl': round(new_atl, 2),
        'ctl': round(new_ctl, 2),
        'tsb': round(new_tsb, 2)
    }

def update_garmin_data(user_id, date_str, trimp, activity, metrics):
    """Update garmin_data table with new values"""
    try:
        data = {
            'user_id': user_id,
            'date': date_str,
            'trimp': trimp,
            'activity': activity,
            'atl': metrics['atl'],
            'ctl': metrics['ctl'],
            'tsb': metrics['tsb']
        }
        
        response = supabase.table('garmin_data') \
            .upsert(data, on_conflict='user_id,date') \
            .execute()
            
        return True
    except Exception as e:
        print(f"Error updating garmin_data for {date_str}: {e}")
        return False

def insert_manual_entry(user_id, date_str, trimp, activity_name):
    """Insert a new manual entry into the manual_data table"""
    try:
        data = {
            'user_id': user_id,
            'date': date_str,
            'trimp': trimp,
            'activity_name': activity_name
        }
        
        response = supabase.table('manual_data') \
            .insert(data) \
            .execute()
            
        return True
    except Exception as e:
        print(f"Error inserting manual entry: {e}")
        return False

def update_manual_entry_in_db(entry_id, date_str, trimp, activity_name):
    """Update an existing manual entry in the manual_data table"""
    try:
        data = {
            'date': date_str,
            'trimp': trimp,
            'activity_name': activity_name
        }
        
        response = supabase.table('manual_data') \
            .update(data) \
            .eq('id', entry_id) \
            .execute()
            
        return True
    except Exception as e:
        print(f"Error updating manual entry: {e}")
        return False

def delete_manual_entry_from_db(entry_id):
    """Delete a manual entry from the manual_data table"""
    try:
        response = supabase.table('manual_data') \
            .delete() \
            .eq('id', entry_id) \
            .execute()
            
        return True
    except Exception as e:
        print(f"Error deleting manual entry: {e}")
        return False

def recalculate_metrics_from_date_onwards(user_id, start_date_str, initial_metrics):
    """
    Recalculate metrics for all dates after start_date based on initial_metrics
    
    Args:
        user_id (str): The user's ID
        start_date_str (str): Starting date in YYYY-MM-DD format
        initial_metrics (dict): Initial metrics to use for calculation
        
    Returns:
        bool: Success or failure
    """
    try:
        print(f"Recalculating metrics from {start_date_str} onwards")
        
        # Get all dates after start_date
        response = supabase.table('garmin_data') \
            .select('date, trimp') \
            .eq('user_id', user_id) \
            .gt('date', start_date_str) \
            .order('date', {'ascending': True}) \
            .execute()
            
        if not response.data or len(response.data) == 0:
            print("No subsequent dates to recalculate")
            return True
            
        subsequent_dates = response.data
        print(f"Found {len(subsequent_dates)} subsequent dates to recalculate")
        
        # Start with the initial metrics
        prev_metrics = {
            'atl': float(initial_metrics['atl']),
            'ctl': float(initial_metrics['ctl']),
            'tsb': float(initial_metrics['tsb'])
        }
        
        # Process each date
        for date_item in subsequent_dates:
            date_str = date_item['date']
            trimp = float(date_item['trimp']) if date_item['trimp'] is not None else 0
            
            # Calculate new metrics
            new_atl = prev_metrics['atl'] + (trimp - prev_metrics['atl']) / 7
            new_ctl = prev_metrics['ctl'] + (trimp - prev_metrics['ctl']) / 42
            new_tsb = prev_metrics['ctl'] - prev_metrics['atl']  # TSB is based on previous day's values
            
            # Update the database
            metrics = {
                'atl': round(new_atl, 2),
                'ctl': round(new_ctl, 2),
                'tsb': round(new_tsb, 2)
            }
            
            update_result = supabase.table('garmin_data') \
                .update(metrics) \
                .eq('user_id', user_id) \
                .eq('date', date_str) \
                .execute()
                
            # Update prev_metrics for next iteration
            prev_metrics = metrics
            
        print(f"Successfully recalculated metrics for {len(subsequent_dates)} dates")
        return True
        
    except Exception as e:
        print(f"Error recalculating metrics: {str(e)}")
        print(traceback.format_exc())
        return False

def batch_fetch_garmin_data(user_id, start_date_str=None, end_date_str=None):
    """
    Fetch all garmin_data entries for a user within a date range in a single query
    
    Args:
        user_id (str): The user's ID
        start_date_str (str, optional): Start date in YYYY-MM-DD format
        end_date_str (str, optional): End date in YYYY-MM-DD format
        
    Returns:
        list: List of garmin_data entries
    """
    try:
        query = supabase.table('garmin_data').select('*').eq('user_id', user_id)
        
        if start_date_str:
            query = query.gte('date', start_date_str)
        if end_date_str:
            query = query.lte('date', end_date_str)
            
        response = query.order('date').execute()
        
        return response.data or []
    except Exception as e:
        print(f"Error batch fetching garmin data: {e}")
        return []

def batch_fetch_manual_data(user_id, start_date_str=None, end_date_str=None):
    """
    Fetch all manual_data entries for a user within a date range in a single query
    
    Args:
        user_id (str): The user's ID
        start_date_str (str, optional): Start date in YYYY-MM-DD format
        end_date_str (str, optional): End date in YYYY-MM-DD format
        
    Returns:
        list: List of manual_data entries
    """
    try:
        query = supabase.table('manual_data').select('*').eq('user_id', user_id)
        
        if start_date_str:
            query = query.gte('date', start_date_str)
        if end_date_str:
            query = query.lte('date', end_date_str)
            
        response = query.order('date').execute()
        
        return response.data or []
    except Exception as e:
        print(f"Error batch fetching manual data: {e}")
        return []