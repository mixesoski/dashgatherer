from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_sync import sync_garmin_data
from garmin_metrics import update_chart_data
from supabase_client import supabase
import traceback
import numpy as np
import os

app = Flask(__name__)

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

def convert_to_serializable(obj):
    if isinstance(obj, np.int64):
        return int(obj)
    return obj

@app.route('/api/sync-garmin', methods=['POST'])
def sync_garmin():
    try:
        data = request.json
        user_id = data.get('userId')
        start_date = data.get('startDate')

        if not user_id:
            return jsonify({
                'success': False,
                'error': 'userId is required'
            }), 400

        # Check if this is first sync for user
        existing_data = supabase.table('garmin_data')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
        
        is_first_sync = len(existing_data.data) == 0

        # Always use garmin_sync for consistent handling of all days
        result = sync_garmin_data(user_id, start_date, is_first_sync)

        return jsonify(result)

    except Exception as e:
        print(f"Error in sync endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/update-chart', methods=['POST', 'OPTIONS'])
def update_chart():
    # Handle preflight requests
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response

    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
            
        user_id = data.get('userId')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'No user ID provided'
            }), 400
            
        start_date = data.get('startDate')
        
        # Get Garmin credentials from environment variables
        email = os.environ.get('EMAIL')
        password = os.environ.get('PASSWORD')
        
        if not email or not password:
            return jsonify({
                'success': False,
                'error': 'Garmin credentials not configured'
            }), 500
        
        # Calculate metrics for chart update
        result = update_chart_data(user_id, email, password)
        
        if isinstance(result, dict):
            result = {k: convert_to_serializable(v) for k, v in result.items()}
        
        return jsonify(result)
        
    except Exception as e:
        print(f"API Error: {str(e)}")
        print(f"Full error details: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': 'An unexpected error occurred.'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)