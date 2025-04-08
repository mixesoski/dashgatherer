from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from direct_garmin_sync import sync_garmin_data
from sync_metrics_calculator import calculate_sync_metrics
from chart_updater import update_chart_data
from supabase import create_client, Client
import os
import traceback
import sys
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://dashgatherer.lovable.app", "http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Cache-Control"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_KEY", "")
)

@app.before_request
def log_request_info():
    """Log request information for debugging"""
    print(f"\n{'='*50}")
    print(f"Request: {request.method} {request.url}")
    print(f"Origin: {request.headers.get('Origin', 'No Origin')}")
    print(f"Headers: {dict(request.headers)}")
    print(f"{'='*50}\n")

@app.after_request
def after_request(response):
    """Log response information for debugging"""
    print(f"\n{'='*50}")
    print(f"Response: {response.status}")
    print(f"Headers: {dict(response.headers)}")
    print(f"{'='*50}\n")
    return response

def verify_auth_token(auth_header):
    """Verify the authentication token from the request header"""
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    try:
        # Verify the token with Supabase
        user = supabase.auth.get_user(token)
        print(f"Verified user: {user}")
        return user
    except Exception as e:
        print(f"Auth error: {e}")
        return None

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
            print(f"Missing user_id in request: {data}")
            return jsonify({
                'success': False,
                'error': 'User ID is required'
            }), 400
        
        print(f"Starting sync for user {user_id}, days={days}")
        
        # Calculate start date from days
        start_date = datetime.now() - timedelta(days=days)
        is_first_sync = data.get('is_first_sync', False)
        
        # Sync Garmin data using our new direct implementation
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
        # Verify authentication
        auth_header = request.headers.get('Authorization')
        print(f"\nReceived request to /api/update-chart")
        print(f"Auth header present: {bool(auth_header)}")
        print(f"Request method: {request.method}")
        print(f"Content-Type: {request.headers.get('Content-Type')}")
        print(f"Request data: {request.get_data(as_text=True)}")
        
        user = verify_auth_token(auth_header)
        if not user:
            print("Authentication failed - invalid or missing token")
            print(f"Auth header: {auth_header[:15]}... (truncated)")
            return jsonify({'success': False, 'error': 'Invalid or missing authentication token'}), 401

        try:
            data = request.json
            print(f"Parsed request JSON data: {data}")
        except Exception as json_err:
            print(f"Failed to parse JSON from request: {str(json_err)}")
            print(f"Raw request data: {request.get_data(as_text=True)}")
            return jsonify({'success': False, 'error': 'Invalid JSON format'}), 400
        
        if not data:
            print("No data provided in request body")
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        user_id = data.get('userId')
        if not user_id:
            print("No user ID provided in request")
            return jsonify({'success': False, 'error': 'No user ID provided'}), 400
            
        print(f"User ID from request: {user_id}")
        print(f"User ID from token: {user.user.id}")
        
        if user_id != user.user.id:
            print(f"User ID mismatch. Expected: {user.user.id}, Got: {user_id}")
            return jsonify({'success': False, 'error': 'Invalid user ID'}), 403
        
        # Check if force refresh is requested
        force_refresh = data.get('forceRefresh', False)
        print(f"Force refresh requested: {force_refresh}")
        
        print(f"\nStarting chart update for user: {user_id}")
        
        # Pass the force_refresh parameter to the chart updater
        result = update_chart_data(user_id, force_refresh=force_refresh)
        print(f"Chart update completed with result: {result}")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"\nError in update chart endpoint:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("Traceback:")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for Render"""
    try:
        # Just verify we can connect to Supabase without requiring a specific table
        supabase.auth.get_session()
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"Health check error: {e}")
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