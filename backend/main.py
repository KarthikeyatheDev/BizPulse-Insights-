from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from mongo_utils import get_all_sales, store_feedback, store_ai_log
from ai_utils import generate_insight
from data_loader import get_dashboard_data, detect_trends, get_insight_cards, get_recommendations

app = Flask(__name__)
CORS(app, 
     origins=["http://localhost:3000", "http://127.0.0.1:3000"],
     supports_credentials=True,
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"])
socketio = SocketIO(app, 
                   cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   async_mode='threading')

print("***** BIZPULSE BACKEND STARTED WITH CORS CONFIGURATION *****") # New unique print

@app.route("/data", methods=["GET"])
def get_data():
    # Support optional time-based query (e.g., ?hours=24)
    from datetime import datetime, timedelta, timezone
    from mongo_utils import get_sales_by_time
    hours = request.args.get("hours", default=None, type=int)
    if hours:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        data = get_sales_by_time("sales_data", since)
    else:
        data = get_all_sales("sales_data")
    # Notify clients of new data fetch (optional, for demo)
    socketio.emit('data_update', {'count': len(data)})
    return jsonify(data)

@app.route("/generate", methods=["POST"])
def generate():
    try:
        if not request.json:
            return jsonify({"error": "No JSON data provided"}), 400
        
        prompt = request.json.get("prompt", "")
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400

        print(f"Generating insight for prompt: {prompt}")  # Debug log
        response = generate_insight(prompt)
        print(f"Generated response: {response}")  # Debug log
        
        return jsonify({"response": response})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in generate endpoint: {str(e)}\n{error_trace}")  # Debug log
        return jsonify({"error": str(e)}), 500

@app.route("/dashboard-data", methods=["GET"])
def dashboard_data():
    return jsonify({ "data": get_dashboard_data() })

@app.route("/trends", methods=["GET"])
def trends():
    return jsonify({ "data": detect_trends() })

@app.route("/insight-cards", methods=["GET"])
def insight_cards():
    return jsonify({ "data": get_insight_cards() })

@app.route("/recommendations", methods=["GET"])
def recommendations():
    return jsonify({ "data": get_recommendations() })


# Feedback Loop
feedback_store = []

@app.route("/feedback", methods=["POST"])
def feedback():
    data = request.json
    feedback_store.append(data)
    # Store feedback in MongoDB
    store_feedback(data)
    return jsonify({"status": "received"})

@app.route("/ai-log", methods=["POST"])
def ai_log():
    data = request.json
    store_ai_log(data)
    return jsonify({"status": "logged"})

# WebSocket event for client connection
@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'WebSocket connection established'})

@app.route("/notify-new-sale", methods=["POST"])
def notify_new_sale_api():
    sale_record = request.json
    # Emit new_sale event to all WebSocket clients
    notify_new_sale(sale_record)
    return jsonify({"status": "notified"})

def notify_new_sale(sale_record):
    socketio.emit('new_sale', sale_record)

@app.route("/generate-insight", methods=["POST"])
def generate_insight_endpoint():
    # Extract prompt from the request
    data = request.json
    prompt = data.get("prompt")

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Fetch relevant data from the database
    from mongo_utils import fetch_relevant_data
    relevant_data = fetch_relevant_data(prompt)

    # Combine the prompt with relevant data
    combined_prompt = f"{prompt}\n\nRelevant Data:\n{relevant_data}"

    # Generate insight using the AI model
    try:
        insight = generate_insight(combined_prompt)
        return jsonify({"insight": insight})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    socketio.run(app, debug=True)