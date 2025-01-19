from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_trimp import main as garmin_main
import traceback

app = Flask(__name__)
CORS(app)

@app.route('/api/sync-garmin', methods=['POST'])
def sync_garmin():
    try:
        data = request.json
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'error': 'No user ID provided'}), 400
        
        print(f"Processing request for user_id: {user_id}")  # Debug print
        
        result = garmin_main(user_id)
        print(f"Processing result: {result}")  # Debug print
        
        return jsonify(result)
    except Exception as e:
        print(f"API Error: {str(e)}")
        print(f"Full error details: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)  # Enable debug mode 