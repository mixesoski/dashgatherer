from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_sync import sync_garmin_data
from chart_updater import update_chart_data
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Configure CORS to allow requests from your frontend domain
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://*.lovable.app",
            "*-preview--*-lovable.app"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

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

@app.route('/api/update-chart', methods=['POST'])
def update_chart():
    try:
        data = request.json
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'userId is required'
            }), 400

        result = update_chart_data(user_id)
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in update chart endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)