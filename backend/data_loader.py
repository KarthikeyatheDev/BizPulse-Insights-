# backend/data_loader.py
from mongo_utils import insert_sales_data
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import matplotlib.pyplot as plt
import seaborn as sns

dummy_data = [
    {"quarter": "Q1", "region": "North", "sales": 25000},
    {"quarter": "Q1", "region": "South", "sales": 20000},
    {"quarter": "Q2", "region": "North", "sales": 27000},
    {"quarter": "Q2", "region": "South", "sales": 22000},
    {"quarter": "Q3", "region": "North", "sales": 29000},
    {"quarter": "Q3", "region": "South", "sales": 21000},
]

def load_sales_csv(csv_path="sales_demo.csv"):
    df = pd.read_csv(csv_path, parse_dates=["date"])
    return df

# Dynamic Dashboard Data

def get_dashboard_data():
    # Get all sales from MongoDB
    from mongo_utils import get_all_sales
    df = pd.DataFrame(get_all_sales("sales_data"))
    
    if df.empty:
        return {
            "line": [],
            "heatmap": {},
            "pie": {}
        }
    
    # Format timestamp and ensure all required columns exist
    df['date'] = pd.to_datetime(df['timestamp']).dt.date.astype(str)
    
    # Line graph: sales over time
    line = df.groupby("date")["sales_amount"].sum().reset_index()
    line = line.rename(columns={"sales_amount": "sales"})
    
    # Region heatmap: sales by region and product
    # Convert sales_amount to float to ensure numerical values
    df['sales_amount'] = df['sales_amount'].astype(float)
    
    # Pivot table with products as rows and regions as columns
    heatmap = df.pivot_table(
        values="sales_amount",
        index="product",
        columns="region",
        aggfunc="sum",
        fill_value=0.0  # Explicitly use float
    )
    
    # Sort products and regions for consistent display
    heatmap = heatmap.sort_index()
    heatmap = heatmap.reindex(sorted(heatmap.columns), axis=1)
    
    # Round values for cleaner display and ensure float type
    heatmap = heatmap.astype(float).round(2)
    
    # Pie chart: sales by region
    pie = df.groupby("region")["sales_amount"].sum().round(2).to_dict()
    
    return {
        "line": line.to_dict("records"),
        "heatmap": heatmap.to_dict('index'),
        "pie": pie
    }

# Trend Detection

def detect_trends():
    df = load_sales_csv()
    df["quarter"] = df["date"].dt.to_period("Q")

    # Convert the Period objects to strings before grouping
    # This is the key change!
    df["quarter_str"] = df["quarter"].astype(str)

    # Group by the string representation of the quarter
    q_sales = df.groupby("quarter_str")["sales"].sum().reset_index()
    q_sales["growth"] = q_sales["sales"].pct_change().fillna(0)

    alerts = []
    for i, row in q_sales.iterrows():
        # Refer to 'quarter_str' here too for consistency if needed in alerts
        if row["growth"] < -0.1:
            alerts.append(f"Alert: Sales dropped by {abs(row['growth']*100):.1f}% in {row['quarter_str']}")
        elif row["growth"] > 0.1:
            alerts.append(f"Growth: Sales increased by {row['growth']*100:.1f}% in {row['quarter_str']}")

    # Ensure 'q_sales' is converted to a dictionary of records
    # Also, rename 'quarter_str' back to 'quarter' if that's what your frontend expects
    q_sales.rename(columns={'quarter_str': 'quarter'}, inplace=True)

    return {"quarterly_growth": q_sales.to_dict("records"), "alerts": alerts}

# Insight Cards

def get_insight_cards():
    df = load_sales_csv()
    top_product = df.groupby("product")["sales"].sum().idxmax()
    low_region = df.groupby("region")["sales"].sum().idxmin()
    # Simple forecast: linear regression
    df["date_ordinal"] = df["date"].map(pd.Timestamp.toordinal)
    X = df[["date_ordinal"]]
    y = df["sales"]
    model = LinearRegression().fit(X, y)
    next_date = df["date_ordinal"].max() + 7  # 1 week ahead
    forecast = model.predict([[next_date]])[0]
    return [
        {"title": "Top Selling Product", "value": top_product},
        {"title": "Lowest Performing Region", "value": low_region},
        {"title": "Sales Forecast (AI Predicted)", "value": f"${forecast:.2f}"}
    ]

# Auto Recommendations

def get_recommendations():
    df = load_sales_csv()
    recs = []
    for _, row in df.iterrows():
        if row["inventory"] < 10 and row["sales"] > 100:
            recs.append(f"Inventory is low for {row['product']}, but demand is increasing.")
    # Compare last two quarters
    df["quarter"] = df["date"].dt.to_period("Q")
    q_sales = df.groupby(["quarter", "region"])["sales"].sum().unstack()
    if len(q_sales) >= 2:
        last, prev = q_sales.iloc[-1], q_sales.iloc[-2]
        for region in q_sales.columns:
            if prev[region] > 0:
                drop = (last[region] - prev[region]) / prev[region]
                if drop < -0.1:
                    recs.append(f"Sales dropped in {region} by {abs(drop*100):.1f}% compared to last quarter. Consider promotion.")
    return recs

if __name__ == "__main__":
    insert_sales_data("sales_data", dummy_data)
    print("Dummy sales data inserted successfully.")
