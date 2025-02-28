import os
import datetime
from flask import Flask, request, jsonify

# Import the ChartUpdater from the existing Python script
from chart_updater import ChartUpdater

app = Flask(__name__)

@app.route('/api/recalculate', methods=['POST'])
def recalculate():
    data = request.get_json()
    user_id = data.get('user_id')
    start_date_str = data.get('start_date')
    
    if not user_id or not start_date_str:
        return jsonify({'error': 'Missing parameters'}), 400
    
    try:
        start_date = datetime.datetime.fromisoformat(start_date_str).date()
    except Exception as e:
        return jsonify({'error': 'Invalid start_date format'}), 400
    
    updater = ChartUpdater(user_id)
    result = updater.update_chart_data(start_date_override=start_date)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000))) 