from flask import Flask, request, jsonify, redirect
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

# Configure CORS - allow all origins in both dev and prod for now
CORS(app, resources={
    r"/*": {
        "origins": "*",
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

@app.route('/')
def root():
    """Root endpoint that shows API status or redirects to frontend"""
    # Check if the request is from a browser
    if request.headers.get('Accept', '').find('text/html') != -1:
        return redirect('https://dashgatherer.lovable.app')
    
    # Return API status for non-browser requests
    return jsonify({
        'status': 'online',
        'message': 'DashGatherer API is running',
        'version': '1.0.0',
        'endpoints': {
            'health': '/api/health',
            'sync_garmin': '/api/sync-garmin',
            'update_chart': '/api/update-chart'
        },
        'timestamp': datetime.utcnow().isoformat()
    })

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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for Render"""
    try:
        # Check if we can connect to Supabase
        supabase.table('health_check').select('*').limit(1).execute()
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n{'='*50}")
    print(f"Starting Flask server on port {port}")
    print(f"Debug mode: {os.environ.get('FLASK_ENV') == 'development'}")
    print(f"{'='*50}\n")
    app.run(host='0.0.0.0', port=port, debug=True)