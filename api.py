
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
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

# Define allowed origins from environment variable or use default values
cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'https://dashgatherer.lovable.app,https://trimpbara.space,http://localhost:5173')
ALLOWED_ORIGINS = cors_origins.split(',')
logger.info(f"Configured CORS allowed origins: {ALLOWED_ORIGINS}")

# Initialize CORS with all necessary headers
CORS(app, 
     resources={r"/*": {  # Allow CORS for all routes
         "origins": ALLOWED_ORIGINS,
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Cache-Control"],
         "supports_credentials": True,
         "expose_headers": ["Content-Type", "Authorization"]
     }},
     intercept_exceptions=True)

# Initialize Supabase client
try:
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_KEY", "")
    )
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    raise

@app.before_request
def log_request_info():
    """Log request information for debugging"""
    logger.info(f"\n{'='*50}")
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Origin: {request.headers.get('Origin', 'No Origin')}")
    logger.info(f"Headers: {dict(request.headers)}")
    logger.info(f"{'='*50}\n")

@app.after_request
def after_request(response):
    """Add CORS headers and log response"""
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cache-Control'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    logger.info(f"\n{'='*50}")
    logger.info(f"Response: {response.status}")
    logger.info(f"Headers: {dict(response.headers)}")
    logger.info(f"{'='*50}\n")
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
        return redirect('https://trimpbara.space')
    
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

@app.route('/api/sync-garmin', methods=['POST', 'OPTIONS'])
def sync_garmin():
    if request.method == 'OPTIONS':
        return '', 204  # Return empty response for preflight requests
        
    try:
        logger.info("=== Starting /api/sync-garmin request ===")
        
        # Verify authentication
        auth_header = request.headers.get('Authorization')
        logger.info(f"Auth header present: {bool(auth_header)}")
        
        user = verify_auth_token(auth_header)
        if not user:
            logger.error("Authentication failed - invalid or missing token")
            return jsonify({'success': False, 'error': 'Invalid or missing authentication token'}), 401

        # ... keep existing code (JSON data parsing and processing)

        user_id = data.get('user_id')
        days = data.get('days', 15)
        
        # Access user ID correctly from UserResponse object
        if not user_id or user_id != user.user.id:
            logger.error(f"User ID mismatch. Expected: {user.user.id}, Got: {user_id}")
            return jsonify({'success': False, 'error': 'Invalid user ID'}), 403
        
        logger.info(f"Starting sync for user {user_id}, days={days}")
        
        # Calculate start date from days
        start_date = datetime.now() - timedelta(days=days)
        is_first_sync = data.get('is_first_sync', False)
        
        # Use the original garmin_sync module for sync
        from garmin_sync import sync_garmin_data
        
        # Sync Garmin data using the original implementation that works
        logger.info("Starting Garmin sync...")
        sync_result = sync_garmin_data(user_id, start_date, is_first_sync)
        logger.info(f"Sync result: {sync_result}")
        
        if not sync_result.get('success', False):
            logger.error(f"Sync failed: {sync_result}")
            return jsonify(sync_result)
        
        logger.info("Sync completed successfully")
        return jsonify({
            'success': True,
            'newActivities': sync_result.get('newActivities', 0),
            'message': sync_result.get('message', 'Sync complete')
        })
    except Exception as e:
        logger.error("Error in sync-garmin endpoint:")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error("Traceback:", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }), 500

@app.route('/api/update-chart', methods=['POST', 'OPTIONS'])
def update_chart():
    if request.method == 'OPTIONS':
        return '', 204  # Return empty response for preflight requests
        
    try:
        # ... keep existing code (update-chart endpoint implementation)
        
    except Exception as e:
        logger.error("Error in update-chart endpoint:")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error("Traceback:", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
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
