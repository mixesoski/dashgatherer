from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from direct_garmin_sync import sync_garmin_data
from sync_metrics_calculator import calculate_sync_metrics
from chart_updater import update_chart_data
from manual_data_processor import add_manual_entry, update_manual_entry, delete_manual_entry
from supabase import create_client, Client
import os
import traceback
import sys
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)

# Configure CORS - Added localhost:8080 to allowed origins
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://dashgatherer.lovable.app",
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8080"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Cache-Control"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
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
    origin = request.headers.get('Origin')
    # Added localhost:8080 to allowed origins
    if origin in ["https://dashgatherer.lovable.app", "http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', '3600')
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
    print(f"TIMESTAMP: {datetime.now().isoformat()}")
    if exception:
        print(f"EXCEPTION TYPE: {type(exception).__name__}")
        print(f"EXCEPTION MESSAGE: {str(exception)}")
        print("\nTRACEBACK:")
        traceback.print_exc(file=sys.stdout)
        if hasattr(exception, 'cause'):
            print(f"\nCAUSE: {exception.cause}")
    print("="*50 + "\n")

@app.route('/')
def home():
    # Check if the request is from a browser
    if request.headers.get('Accept', '').find('text/html') != -1:
        return redirect('https://dashgatherer.lovable.app')
    
    # Return API status for non-browser requests
    return jsonify({
        'status': 'ok',
        'message': 'API is running'
    })

@app.route('/api/sync-garmin', methods=['POST'])
def sync_garmin():
    try:
        # Verify authentication
        auth_header = request.headers.get('Authorization')
        user = verify_auth_token(auth_header)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid or missing authentication token'}), 401

        data = request.json
        user_id = data.get('user_id')
        days = data.get('days', 15)
        
        # Access user ID correctly from UserResponse object
        if not user_id or user_id != user.user.id:
            print(f"User ID mismatch. Expected: {user.user.id}, Got: {user_id}")
            return jsonify({'success': False, 'error': 'Invalid user ID'}), 403
        
        print(f"Starting sync for user {user_id}, days={days}")
        
        # Calculate start date from days
        start_date = datetime.now() - timedelta(days=days)
        is_first_sync = data.get('is_first_sync', False)
        
        # Use the original garmin_sync module for sync
        from garmin_sync import sync_garmin_data
        
        # Sync Garmin data using the original implementation that works
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

@app.route('/api/update-chart', methods=['POST', 'OPTIONS'])
def update_chart():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Get user_id from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({
                'success': False,
                'error': 'No Authorization header'
            }), 401

        user_id = auth_header.split(' ')[1] if len(auth_header.split(' ')) > 1 else None
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Invalid Authorization header'
            }), 401

        # Get force_refresh parameter
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        
        # Update chart data
        result = update_chart_data(user_id, force_refresh=force_refresh)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in update_chart: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/manual-entry', methods=['POST'])
def manual_entry():
    try:
        # Verify authentication
        auth_header = request.headers.get('Authorization')
        user = verify_auth_token(auth_header)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid or missing authentication token'}), 401

        data = request.json
        user_id = user.user.id
        date_str = data.get('date')
        trimp_value = data.get('trimp')
        activity_name = data.get('activity_name')
        
        # Validate required fields
        if not date_str or not trimp_value or not activity_name:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
        # Validate TRIMP value
        try:
            trimp_value = float(trimp_value)
            if trimp_value < 0:
                return jsonify({'success': False, 'error': 'TRIMP value must be positive'}), 400
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid TRIMP value'}), 400
        
        # Add manual entry
        result = add_manual_entry(user_id, date_str, trimp_value, activity_name)
        
        if result.get('success', False):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        log_error("Error in manual_entry endpoint", e)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/manual-entry/<int:entry_id>', methods=['PUT'])
def update_manual_entry_endpoint(entry_id):
    try:
        # Verify authentication
        auth_header = request.headers.get('Authorization')
        user = verify_auth_token(auth_header)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid or missing authentication token'}), 401

        data = request.json
        date_str = data.get('date')
        trimp_value = data.get('trimp')
        activity_name = data.get('activity_name')
        
        # Validate required fields
        if not date_str or not trimp_value or not activity_name:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
        # Validate TRIMP value
        try:
            trimp_value = float(trimp_value)
            if trimp_value < 0:
                return jsonify({'success': False, 'error': 'TRIMP value must be positive'}), 400
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid TRIMP value'}), 400
        
        # Verify ownership of the entry
        entry = get_manual_entry_by_id(entry_id)
        if not entry or entry.get('user_id') != user.user.id:
            return jsonify({'success': False, 'error': 'Entry not found or not owned by user'}), 404
        
        # Update manual entry
        result = update_manual_entry(entry_id, date_str, trimp_value, activity_name)
        
        if result.get('success', False):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        log_error("Error in update_manual_entry endpoint", e)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/manual-entry/<int:entry_id>', methods=['DELETE'])
def delete_manual_entry_endpoint(entry_id):
    try:
        # Verify authentication
        auth_header = request.headers.get('Authorization')
        user = verify_auth_token(auth_header)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid or missing authentication token'}), 401
        
        # Verify ownership of the entry
        entry = get_manual_entry_by_id(entry_id)
        if not entry or entry.get('user_id') != user.user.id:
            return jsonify({'success': False, 'error': 'Entry not found or not owned by user'}), 404
        
        # Delete manual entry
        result = delete_manual_entry(entry_id)
        
        if result.get('success', False):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        log_error("Error in delete_manual_entry endpoint", e)
        return jsonify({'success': False, 'error': str(e)}), 500

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

@app.route('/auth/callback')
def auth_callback():
    # Handle the callback from Garmin auth
    code = request.args.get('code')
    if not code:
        return "No code provided", 400
    
    try:
        # Exchange the code for tokens
        tokens = exchange_code_for_tokens(code)
        if not tokens:
            return "Failed to exchange code for tokens", 400
            
        # Store the tokens in the database
        store_tokens_in_db(tokens)
        
        # Redirect to the frontend
        return redirect('https://dashgatherer.lovable.app')
        
    except Exception as e:
        print(f"Error in auth callback: {e}")
        return str(e), 500

def get_manual_entry_by_id(entry_id):
    """Get a manual entry by ID - helper function for API endpoints"""
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n{'='*50}")
    print(f"Starting Flask server on port {port}")
    print(f"Debug mode: {os.environ.get('FLASK_ENV') == 'development'}")
    print(f"{'='*50}\n")
    app.run(host='0.0.0.0', port=port, debug=True)