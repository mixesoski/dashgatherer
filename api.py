from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_sync import sync_garmin_data
from metrics_calculator import calculate_metrics
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
    # In production, accept requests from specific domains
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

@app.route('/api/sync-garmin', methods=['POST', 'OPTIONS'])
def sync_garmin():
    # Handle preflight requests
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response

    try:
        print("\n=== Starting API request ===")
        print(f"Request headers: {dict(request.headers)}")
        
        # Add CORS headers to response
        response = jsonify({'status': 'processing'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        
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
        update_only = data.get('updateOnly', False)
        recalculate_only = data.get('recalculateOnly', False)
        
        print(f"Processing request for user_id: {user_id}")
        print(f"Start date: {start_date}")
        print(f"Update only: {update_only}")
        print(f"Recalculate only: {recalculate_only}")
        
        if recalculate_only:
            result = calculate_metrics(user_id, start_date)
        else:
            # First sync new data
            sync_result = sync_garmin_data(user_id, start_date)
            if not sync_result['success']:
                return jsonify(sync_result), 400
            
            # Then calculate metrics
            result = calculate_metrics(user_id, start_date)
            result['newActivities'] = sync_result['newActivities']
        
        # Convert any int64 values to regular Python integers
        if isinstance(result, dict):
            result = {k: convert_to_serializable(v) for k, v in result.items()}
        
        print(f"Request completed successfully: {result}")
        return jsonify(result)
        
    except Exception as e:
        print(f"API Error: {str(e)}")
        print(f"Full error details: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)