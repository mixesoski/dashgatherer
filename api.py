from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_sync import sync_garmin_data
from metrics_calculator import calculate_metrics
import traceback
import numpy as np
import os

app = Flask(__name__)

# Configure CORS to accept all origins in development
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

def convert_to_serializable(obj):
    if isinstance(obj, np.int64):
        return int(obj)
    return obj

@app.route('/api/sync-garmin', methods=['POST', 'OPTIONS'])
def sync_garmin():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        print("\n=== Starting API request ===")
        print(f"Request headers: {dict(request.headers)}")
        print(f"Request body: {request.get_data(as_text=True)}")
        
        data = request.get_json()
        user_id = data.get('userId')
        start_date = data.get('startDate')
        update_only = data.get('updateOnly', False)
        recalculate_only = data.get('recalculateOnly', False)
        
        print(f"Extracted user_id: {user_id}")
        
        if not user_id:
            print("No user_id provided")
            return jsonify({'success': False, 'error': 'No user ID provided'})
        
        if recalculate_only:
            result = calculate_metrics(user_id, start_date)
        else:
            # First sync new data
            sync_result = sync_garmin_data(user_id, start_date)
            if not sync_result['success']:
                return jsonify(sync_result)
            
            # Then calculate metrics
            result = calculate_metrics(user_id, start_date)
            result['newActivities'] = sync_result['newActivities']
        
        # Convert any int64 values to regular Python integers
        if isinstance(result, dict):
            result = {k: convert_to_serializable(v) for k, v in result.items()}
        
        print(f"Processing result: {result}")
        
        return jsonify(result)
    except Exception as e:
        print(f"API Error: {str(e)}")
        print(f"Full error details: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)