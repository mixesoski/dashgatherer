from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_sync import sync_garmin_data
from sync_metrics_calculator import calculate_sync_metrics
from chart_updater import update_chart_data
from supabase import create_client
import os
import traceback
import sys
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Configure CORS
if os.environ.get('FLASK_ENV') == 'development':
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
else:
    # In production, accept requests from specific domains without port numbers
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "https://b517f268-2dee-41b5-963d-5ba7555908cb.lovableproject.com",
                "https://id-preview--b517f268-2dee-41b5-963d-5ba7555908cb.lovable.app",
                "https://eeaebxnbcxhzafzpzqsu.supabase.co"
            ],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

def log_error(error_message, exception=None):
    """Funkcja do szczegółowego logowania błędów w terminalu"""
    print("\n" + "="*50)
    print(f"ERROR: {error_message}")
    if exception:
        print(f"EXCEPTION TYPE: {type(exception).__name__}")
        print(f"EXCEPTION MESSAGE: {str(exception)}")
        print("\nTRACEBACK:")
        traceback.print_exc(file=sys.stdout)
    print("="*50 + "\n")

@app.route('/api/sync-garmin', methods=['POST'])
def sync_garmin():
    try:
        data = request.json
        user_id = data.get('user_id')
        days = data.get('days', 15)
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'})
        
        start_date = datetime.now() - timedelta(days=days)
        is_first_sync = data.get('is_first_sync', False)
        
        print(f"Starting sync for user {user_id}, days={days}, is_first_sync={is_first_sync}")
        
        # Sync Garmin data - now this function calculates metrics directly
        sync_result = sync_garmin_data(user_id, start_date, is_first_sync)
        
        if not sync_result.get('success', False):
            return jsonify(sync_result)
            
        return jsonify({
            'success': True,
            'newActivities': sync_result.get('newActivities', 0),
            'message': sync_result.get('message', 'Sync complete')
        })
    except Exception as e:
        print(f"Error in sync-garmin: {e}")
        traceback_str = traceback.format_exc()
        print(traceback_str)
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/update-chart', methods=['POST'])
def update_chart():
    try:
        data = request.json
        user_id = data.get('userId')
        
        print(f"\nReceived chart update request for user: {user_id}")
        
        if not user_id:
            log_error("Missing userId in request")
            return jsonify({
                'success': False,
                'error': 'userId is required'
            }), 400

        result = update_chart_data(user_id)
        print(f"Chart update completed with result: {result}")
        
        return jsonify(result)
        
    except Exception as e:
        log_error("Error in update chart endpoint", e)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n{'='*50}")
    print(f"Starting Flask server on port {port}")
    print(f"Debug mode: {os.environ.get('FLASK_ENV') == 'development'}")
    print(f"{'='*50}\n")
    app.run(host='0.0.0.0', port=port, debug=True)