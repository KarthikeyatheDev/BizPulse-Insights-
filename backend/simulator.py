import random
import time
from datetime import datetime, timezone
from pymongo import MongoClient
import os
import requests
from dotenv import load_dotenv
import sys

# Add the current directory to Python path to find .env file
current_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(current_dir)

# Load environment variables from .env file
print("Loading environment variables...")
load_dotenv(os.path.join(current_dir, '.env'))

# MongoDB Atlas connection string
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("Error: MONGO_URI not found in environment variables!")
    print("Current working directory:", os.getcwd())
    print("Looking for .env file in:", current_dir)
    sys.exit(1)

print(f"Found MongoDB URI: {MONGO_URI[:20]}...") # Print first 20 chars for verification

DB_NAME = "bizpulse"  # Set explicit database name
data_collection = "sales_data"

# SocketIO notification endpoint
SOCKETIO_NOTIFY_URL = "http://127.0.0.1:5000/notify-new-sale"

# Sample data
REGIONS = ["North", "South", "East", "West"]
PRODUCTS = ["Widget-A", "Gadget-B", "Device-C", "Tool-D"]

def connect_to_mongodb():
    try:
        print(f"\nConnecting to MongoDB database: {DB_NAME}")
        client = MongoClient(MONGO_URI)
        
        # Test the connection
        print("Testing connection...")
        client.server_info()
        print("Successfully connected to MongoDB!")
        
        db = client[DB_NAME]
        collection = db[data_collection]
        
        # Test collection access
        print(f"Testing collection access to {data_collection}...")
        collection.find_one()  # Test if we can query the collection
        print("Successfully accessed collection!")
        
        return client, collection
    except Exception as e:
        print(f"\n❌ Failed to connect to MongoDB: {str(e)}")
        print("\nPlease verify:")
        print("1. Your MongoDB Atlas cluster is running")
        print("2. Your IP address is whitelisted in MongoDB Atlas")
        print("3. Your username and password are correct")
        print("4. The connection string in .env is correct")
        sys.exit(1)

# Connect to MongoDB
client, collection = connect_to_mongodb()

def generate_record():
    current_time = datetime.now(timezone.utc)
    hour = current_time.hour
    minute = current_time.minute
    # Generate a more realistic sales amount: base amount (100-1000) plus time-based component
    base_amount = random.uniform(100, 1000)
    time_component = float(f"{hour}.{minute}")
    sales_amount = round(base_amount + time_component, 2)
    
    return {
        "timestamp": current_time.isoformat(),
        "region": random.choice(REGIONS),
        "product": random.choice(PRODUCTS),
        "sales_amount": sales_amount,
        "quantity_sold": random.randint(1, 5)
    }

def notify_backend_new_sale(record):
    try:
        # Create a clean version of the record without MongoDB-specific fields
        clean_record = {
            "timestamp": record["timestamp"],
            "region": record["region"],
            "product": record["product"],
            "sales_amount": record["sales_amount"],
            "quantity_sold": record["quantity_sold"]
        }
        print(f"\nSending new sale: {clean_record['product']} in {clean_record['region']} at ${clean_record['sales_amount']}")
        response = requests.post(SOCKETIO_NOTIFY_URL, json=clean_record, timeout=2)
        response.raise_for_status()  # Raise an error for bad status codes
        print("✓ Successfully notified backend")
    except Exception as e:
        print(f"✗ Could not notify backend: {str(e)}")

def main():
    print("\n=== BizPulse Sales Data Simulator ===")
    print("Starting simulation with:")
    print(f"- Database: {DB_NAME}")
    print(f"- Collection: {data_collection}")
    print(f"- Notification URL: {SOCKETIO_NOTIFY_URL}")
    print("\nSales amounts will reflect the current time (HH.MM format)")
    print("Watch the dashboard for real-time updates!")
    print("\nPress Ctrl+C to stop the simulation")
    print("\nGenerating sales data...")
    
    try:
        while True:
            record = generate_record()
            # Insert into MongoDB
            try:
                collection.insert_one(record)
                print("✓ Inserted into MongoDB")
            except Exception as e:
                print(f"✗ Failed to insert into MongoDB: {e}")
            
            # Notify the backend
            notify_backend_new_sale(record)
            
            time.sleep(5)  # Generate a new sale every 5 seconds
            
    except KeyboardInterrupt:
        print("\nSimulation stopped by user")
    except Exception as e:
        print(f"\nSimulation stopped due to error: {e}")
    finally:
        client.close()
        print("\nMongoDB connection closed")

if __name__ == "__main__":
    main()
