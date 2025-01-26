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

    # ... (pozostałe metody pozostają bez zmian do metody update_chart_data)

    def update_chart_data(self):
        try:
            self.initialize_garmin()
            
            end_date = datetime.date.today()
            start_date = end_date - datetime.timedelta(days=10)
            
            date_range = [start_date + datetime.timedelta(days=i) for i in range((end_date - start_date).days + 1)]
            
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
            previous_metrics = self.get_last_metrics()
            
            # Logowanie początkowych wartości
            print(f"\n=== Initial metrics from {start_date} ===")
            print(f"ATL: {previous_metrics['atl']}, CTL: {previous_metrics['ctl']}, TSB: {previous_metrics['tsb']}\n")
            
            for date in date_range[1:]:
                date_str = date.isoformat()
                date_obj = datetime.datetime.combine(date, datetime.time.min).replace(tzinfo=datetime.timezone.utc)
                date_iso = date_obj.isoformat()
                
                trimp_total = 0.0
                activities_for_date = activities_by_date.get(date_str, [])
                
                # Obliczanie TRIMP
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
                
                # Formatowanie aktywności
                if trimp_total == 0:
                    activity_str = "Rest Day"
                else:
                    activity_names = [activity.get('activityName', 'Unknown Activity') 
                                    for activity in activities_for_date]
                    activity_str = ', '.join(activity_names) if activity_names else "Unknown Activity"
                
                new_metrics = self.calculate_new_metrics(trimp_total, previous_metrics)
                
                # Logowanie zmian
                print(f"\n=== Processing {date_str} ===")
                print(f"TRIMP: {trimp_total}")
                print(f"Activity: {activity_str}")
                print(f"Metrics update:")
                print(f"ATL: {previous_metrics['atl']} -> {new_metrics['atl']}")
                print(f"CTL: {previous_metrics['ctl']} -> {new_metrics['ctl']}")
                print(f"TSB: {previous_metrics['tsb']} -> {new_metrics['tsb']}")
                
                previous_metrics = new_metrics
                
                try:
                    existing_entry = self.client.table('garmin_data') \
                        .select('id, atl, ctl, tsb') \
                        .eq('user_id', self.user_id) \
                        .eq('date', date_iso) \
                        .execute()
                    
                    if existing_entry.data:
                        # Logowanie różnic w istniejących wpisach
                        old_data = existing_entry.data[0]
                        update_log = [
                            f"Updating entry for {date_str}:",
                            f"TRIMP: {old_data.get('trimp', 'N/A')} -> {trimp_total}",
                            f"ATL: {old_data.get('atl', 'N/A')} -> {new_metrics['atl']}",
                            f"CTL: {old_data.get('ctl', 'N/A')} -> {new_metrics['ctl']}",
                            f"TSB: {old_data.get('tsb', 'N/A')} -> {new_metrics['tsb']}"
                        ]
                        print("\n".join(update_log))
                        
                        self.client.table('garmin_data').update({
                            'trimp': trimp_total,
                            'activity': activity_str,
                            **new_metrics
                        }).eq('id', old_data['id']).execute()
                        updated_count += 1
                    else:
                        print(f"Inserting new entry for {date_str}:")
                        print(f"TRIMP: {trimp_total} | ATL: {new_metrics['atl']} | "
                            f"CTL: {new_metrics['ctl']} | TSB: {new_metrics['tsb']}")
                        
                        self.client.table('garmin_data').insert({
                            'date': date_iso,
                            'trimp': trimp_total,
                            'activity': activity_str,
                            'user_id': self.user_id,
                            **new_metrics
                        }).execute()
                        updated_count += 1
                except Exception as e:
                    print(f"Error updating/inserting metrics for {date_iso}: {e}")
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