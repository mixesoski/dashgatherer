from flask import Flask, request, jsonify
from flask_cors import CORS
from garmin_trimp import main as garmin_main

app = Flask(__name__)
CORS(app)

@app.route('/api/sync-garmin', methods=['POST'])
def sync_garmin():
    data = request.json
    user_id = data.get('userId')
    
    if not user_id:
        return jsonify({'error': 'No user ID provided'}), 400
    
    result = garmin_main(user_id)
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5001) 