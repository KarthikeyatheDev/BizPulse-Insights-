# backend/mongo_utils.py
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "bizpulse")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def insert_sales_data(collection_name, data):
    collection = db[collection_name]
    if isinstance(data, list):
        collection.insert_many(data)
    else:
        collection.insert_one(data)

def get_all_sales(collection_name):
    collection = db[collection_name]
    return list(collection.find({}, {"_id": 0}))  # Exclude MongoDB _id
# mongo_utils.py
def get_sales_summary():
    collection = db['sales']
    pipeline = [
        {"$group": {
            "_id": {"quarter": "$quarter", "region": "$region"},
            "total_sales": {"$sum": "$sales"}
        }}
    ]
    return list(collection.aggregate(pipeline))

def get_sales_by_time(collection_name, since):
    collection = db[collection_name]
    # Ensure timestamp is stored in ISO format (string)
    return list(collection.find({
        "timestamp": {"$gte": since.isoformat()}
    }, {"_id": 0}))

def store_feedback(feedback_data):
    collection = db["feedback"]
    collection.insert_one(feedback_data)

def store_ai_log(log_data):
    collection = db["ai_logs"]
    collection.insert_one(log_data)

def fetch_relevant_data(query):
    """
    Fetch relevant data from the database based on the query.
    """
    collection = db["sales"]  # Replace "sales" with the relevant collection name
    # Example: Search for documents containing the query in a specific field
    results = collection.find({"description": {"$regex": query, "$options": "i"}})
    return "\n".join([result["description"] for result in results])
