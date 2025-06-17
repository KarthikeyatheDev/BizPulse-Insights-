import React, { useState, useEffect } from 'react';
// Import ALL necessary API functions from your services/api.js
import { getSalesData, getAIInsight, getInsightCards, getRecommendations, postFeedback, getTrends } from './services/api';
import socket from './services/socket';

import InsightCard from './components/InsightCard';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, Sector
} from 'recharts';
import HeatMapGrid from 'react-heatmap-grid';

// Import the App.css for global styles
import './App.css';

// Helper function to interpolate colors for the heatmap
const interpolateColor = (ratio) => {
  // A cheerful gradient from green through yellow to red
  const colors = [
    { r: 144, g: 238, b: 144 },   // Light green (#90EE90)
    { r: 255, g: 220, b: 70 },    // Bright yellow
    { r: 255, g: 99, b: 71 }      // Tomato red (#FF6347)
  ];

  // Determine which two colors to interpolate between
  let colorIndex = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 2);
  let localRatio = (ratio * (colors.length - 1)) - colorIndex;

  const color1 = colors[colorIndex];
  const color2 = colors[colorIndex + 1];

  // Interpolate between the two colors
  const r = Math.round(color1.r + (color2.r - color1.r) * localRatio);
  const g = Math.round(color1.g + (color2.g - color1.g) * localRatio);
  const b = Math.round(color1.b + (color2.b - color1.b) * localRatio);

  return `rgb(${r}, ${g}, ${b})`;
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [insight, setInsight] = useState('');
  // Initialize dashboard with empty structures to prevent errors on initial render
  const [dashboard, setDashboard] = useState({
    pie: {},
    line: [],
    heatmap: {}
  });
  const [trends, setTrends] = useState(null);
  const [insightCards, setInsightCards] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [liveSales, setLiveSales] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [recentRegionSales, setRecentRegionSales] = useState({});

  useEffect(() => {
    // Fetch dashboard data using the function from services/api.js
    getSalesData()
      .then(res => {
        const initialLineData = res.data?.data?.line || [];
        setDashboard(prevDashboard => ({
          ...prevDashboard, // Preserve any existing state if merging
          pie: res.data?.data?.pie || {},
          line: initialLineData.map(d => ({
            date: d.date,
            timestamp: new Date(d.date).getTime(),
            sales: d.sales
          })).sort((a, b) => a.timestamp - b.timestamp),
          heatmap: res.data?.data?.heatmap || {} // Ensure heatmap is also initialized
        }));
      })
      .catch(error => console.error("Error fetching dashboard data:", error));

    // Fetch trends data
    getTrends()
      .then(data => setTrends(data))
      .catch(error => console.error("Error fetching trends data:", error));

    // Fetch insight cards data
    getInsightCards()
      .then(data => setInsightCards(data))
      .catch(error => console.error("Error fetching insight cards data:", error));

    // Fetch recommendations data
    getRecommendations()
      .then(data => setRecommendations(data))
      .catch(error => console.error("Error fetching recommendations data:", error));

    // WebSocket event handlers
    socket.on('connected', (msg) => {
      console.log('WebSocket connected:', msg);
    });

    socket.on('new_sale', (sale) => {
      // Ensure sales_amount is a valid number
      const numericSaleAmount = typeof sale.sales_amount === 'string'
        ? parseFloat(sale.sales_amount)
        : sale.sales_amount;

      if (isNaN(numericSaleAmount)) {
        console.error('Invalid sale amount received:', sale.sales_amount);
        return; // Stop processing if amount is invalid
      }

      // Update live sales feed
      const updatedSale = {
        ...sale,
        sales_amount: parseFloat(numericSaleAmount.toFixed(2)) // Ensure consistent number format
      };
      setLiveSales(prev => [updatedSale, ...prev].slice(0, 5)); // Keep only 5 most recent

      // Update total sales with proper number formatting
      setTotalSales(prev => parseFloat((prev + numericSaleAmount).toFixed(2)));

      // Update region sales with proper number handling
      setRecentRegionSales(prev => ({
        ...prev,
        [sale.region]: parseFloat(((prev[sale.region] || 0) + numericSaleAmount).toFixed(2))
      }));

      // Update dashboard data
      setDashboard(prevDashboard => {
        // Deep clone for dashboard object to ensure immutability without complex nested updates
        // For simpler structures, more targeted updates using spread syntax might be preferred
        const newDashboard = JSON.parse(JSON.stringify(prevDashboard));

        // --- START GRAPH LOGIC ADJUSTMENT (Line Chart) ---

        // Update line chart for "real sales vs time"
        const saleTimestamp = new Date(sale.timestamp).getTime();
        newDashboard.line.push({
          date: new Date(sale.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }), // Consistent time format
          timestamp: saleTimestamp,
          sales: parseFloat(numericSaleAmount.toFixed(2)), // Value of THIS individual sale
          product: sale.product, // Add product and region for tooltip context
          region: sale.region
        });

        // Keep a rolling window of recent sales (e.g., last 50 sales)
        newDashboard.line.sort((a, b) => a.timestamp - b.timestamp); // Ensure points are sorted by time
        if (newDashboard.line.length > 50) { // Adjust this number as needed for your desired window
          newDashboard.line = newDashboard.line.slice(newDashboard.line.length - 50);
        }

        // --- END GRAPH LOGIC ADJUSTMENT (Line Chart) ---

        // Update pie chart with proper number handling
        newDashboard.pie[sale.region] = parseFloat(
          ((newDashboard.pie[sale.region] || 0) + numericSaleAmount).toFixed(2)
        );

        // Update heatmap with proper number handling
        if (!newDashboard.heatmap[sale.product]) {
          newDashboard.heatmap[sale.product] = {};
        }
        newDashboard.heatmap[sale.product][sale.region] = parseFloat(
          ((newDashboard.heatmap[sale.product][sale.region] || 0) + numericSaleAmount).toFixed(2)
        );

        return newDashboard;
      });
    });

    socket.on('data_update', (info) => {
      console.log('Data update event:', info);
    });

    // Cleanup: unsubscribe from WebSocket events when component unmounts
    return () => {
      socket.off('connected');
      socket.off('new_sale');
      socket.off('data_update');
    };
  }, []); // Empty dependency array means this useEffect runs only once on component mount

  const handleGenerate = async () => {
    // Basic error handling for API calls
    try {
      // Prevent sending empty prompts
      if (!prompt.trim()) {
        setInsight("Please enter a prompt to generate insight.");
        return;
      }
      const response = await getAIInsight(prompt);
      setInsight(response); // response is already the insight text
    } catch (error) {
      console.error("Error generating AI insight:", error);
      setInsight("Failed to generate insight. Please try again.");
    }
  };

  // Renamed 'card' to 'cardTitle' for clarity as it's just the title string
  const handleFeedback = (cardTitle, value) => {
    setFeedback(prevFeedback => [...prevFeedback, { card: cardTitle, value }]);
    postFeedback(cardTitle, value) // Use postFeedback from services/api.js
      .catch(error => console.error("Error sending feedback:", error));
  };

  const onPieEnter = (_, index) => setActiveIndex(index);

  const renderActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const {
      cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
      fill // payload, percent, value are available in props if you want to display labels
    } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    // These variables (sx, sy, mx, my, ex, ey) are for drawing external labels/lines,
    // which are currently commented out. Keep if you plan to re-enable text labels.
    // const sx = cx + (outerRadius + 10) * cos;
    // const sy = cy + (outerRadius + 10) * sin;
    // const mx = cx + (outerRadius + 30) * cos;
    // const my = cy + (outerRadius + 30) * sin;
    // const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    // const ey = my;

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6} // Slightly larger for active state
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke="#222" // Add a subtle border for active state
          strokeWidth={2}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        {/* If you want to show a label on hover, uncomment this part: */}
        {/*
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={cos >= 0 ? 'start' : 'end'} fill="#333">{`${payload.name} ${(percent * 100).toFixed(2)}%`}</text>
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
        */}
      </g>
    );
  };

  // Prepare heatmap data with proper number handling
  let heatmapData = null;
  let xLabels = []; // Regions
  let yLabels = []; // Products
  let minHeatmapValue = 0;
  let maxHeatmapValue = 0;

  const heatmapSource = dashboard?.heatmap || {}; // Ensure heatmapSource is an object
  if (Object.keys(heatmapSource).length > 0) {
    yLabels = Object.keys(heatmapSource); // Products are Y-axis labels
    xLabels = [...new Set(
      Object.values(heatmapSource) // Iterate over product data (e.g., { 'ProductA': { 'Region1': 100, 'Region2': 50 } })
        .flatMap(productRegions => Object.keys(productRegions)) // Get all region keys
    )].sort(); // Ensure unique and sorted regions for X-axis labels

    heatmapData = yLabels.map(product => {
      const productData = heatmapSource[product] || {}; // Get data for this product, default to empty object
      return xLabels.map(region => {
        const value = productData[region]; // Get sale value for this product in this region
        const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0); // Convert to number, default to 0 if null/undefined
        return parseFloat(numValue.toFixed(2)); // Return formatted number
      });
    });

    // Calculate min and max values for the legend
    if (heatmapData.length > 0) {
      const allValues = heatmapData.flat().filter(v => typeof v === 'number' && !isNaN(v)); // Ensure values are numbers
      if (allValues.length > 0) {
        minHeatmapValue = Math.min(...allValues);
        maxHeatmapValue = Math.max(...allValues);
      } else {
        // Handle case where all values might be zero or non-numeric
        minHeatmapValue = 0;
        maxHeatmapValue = 0;
      }
    }
  }

  // Define some colors for the pie chart
  const COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8', '#fd7e14', '#e83e8c'];

  return (
    <div className="app-container">
      <h1>BizPulse Insights</h1>

      {/* Real-time Sales Feed with enhanced visibility */}
      <div className="section-card" style={{
        border: liveSales.length > 0 ? '2px solid #4CAF50' : '1px solid #ddd',
        background: liveSales.length > 0 ? '#f0fff0' : 'white'
      }}>
        <h2>
          Live Sales Feed
          {liveSales.length > 0 &&
            <span style={{
              color: '#4CAF50',
              fontSize: '0.8em',
              marginLeft: '10px'
            }}>
              ● LIVE
            </span>
          }
        </h2>
        {liveSales.length === 0 ? (
          <p>Waiting for real-time sales data...</p>
        ) : (
          <ul className="styled-list">
            {liveSales.map((sale, i) => {
              // Convert ISO timestamp to local time
              const saleTime = new Date(sale.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
              return (
                <li key={i} style={{
                  animation: 'fadeIn 0.5s ease-in',
                  borderLeft: '4px solid #4CAF50',
                  marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b>{sale.product}</b> sold in <b>{sale.region}</b>
                      <br />
                      Amount: <b>${sale.sales_amount.toFixed(2)}</b> (Qty: {sale.quantity_sold})
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9em' }}>
                      {saleTime}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Smart Prompt Section */}
      <div className="section-card">
        <h2>Smart Prompt for AI Insights</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask for insight (e.g., Show me quarterly trends in sales performance for specific regions.)"
          rows="4"
          className="text-input" // 'cols' prop removed, typically handled by CSS
        />
        {/* Using a div for spacing instead of <br /> for better control */}
        <div style={{ marginBottom: '15px' }}></div>
        <button
          onClick={handleGenerate}
          className="primary-button"
        >
          Generate Insight
        </button>
        {insight && <InsightCard insight={insight} />}
      </div>

      {/* Real-time Stats Dashboard */}
      <div className="section-card">
        <h2>
          Real-time Performance
          <span className="live-indicator" title="Live updates"></span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {/* Total Sales Card */}
          <div className="stats-box">
            <h3>Total Sales Today</h3>
            <div className="stat-value">${totalSales.toFixed(2)}</div>
            <div className="stat-label">Live Updates</div>
          </div>

          {/* Average Sale Card */}
          <div className="stats-box">
            <h3>Average Sale Value</h3>
            <div className="stat-value">
              ${liveSales.length > 0
                ? (liveSales.reduce((acc, sale) => acc + sale.sales_amount, 0) / liveSales.length).toFixed(2)
                : '0.00'
              }
            </div>
            <div className="stat-label">Based on recent sales</div>
          </div>

          {/* Top Performing Region */}
          <div className="stats-box">
            <h3>Top Region</h3>
            <div className="stat-value">
              {Object.entries(recentRegionSales)
                .sort(([, a], [, b]) => parseFloat(b) - parseFloat(a))[0]?.[0] || 'N/A'}
            </div>
            <div className="stat-label">Highest sales volume</div>
          </div>

          {/* Recent Activity */}
          <div className="stats-box">
            <h3>Recent Activity</h3>
            <div className="stat-value">{liveSales.length}</div>
            <div className="stat-label">Sales in last session</div>
          </div>
        </div>
      </div>

      {/* Dashboard Visualizations */}
      {/* 'dashboard' is now initialized, so a simple check is sufficient */}
      {dashboard && (
        <>
          <div className="section-card">
            <h2>Sales Dashboard</h2>

            {/* --- START GRAPH LOGIC ADJUSTMENT (Line Chart) --- */}
            <div className="chart-section">
              <h3>Real-time Sales Activity</h3> {/* Changed title for clarity */}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboard.line} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  {/* XAxis now uses 'date' (which is time string) and `timestamp` for sorting */}
                  <XAxis
                    dataKey="date"
                    stroke="#555"
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis stroke="#555" label={{ value: 'Sales Amount ($)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value, name, props) => [`$${value.toFixed(2)}`, `Product: ${props.payload.product || 'N/A'}, Region: ${props.payload.region || 'N/A'}`]}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  {/* `dot={false}` helps prevent clutter with many real-time points. Added animation for smoother updates. */}
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#007bff"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={true} // Enable animation
                    animationDuration={300} // Set animation duration in milliseconds
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* --- END GRAPH LOGIC ADJUSTMENT (Line Chart) --- */}

            <div className="chart-section">
              <h3>Region-wise Heatmap (Sales by Product)</h3>
              {/* Ensure heatmapData is not null/empty before rendering */}
              {heatmapData && heatmapData.length > 0 ? (
                <div className="heatmap-container">
                  <div style={{ width: '100%', overflowX: 'auto', padding: '20px 10px' }}>
                    <HeatMapGrid
                      data={heatmapData}
                      xLabels={xLabels}
                      yLabels={yLabels}
                      cellRender={(x, y, value) => {
                        // Ensure value is a valid number
                        const numValue = typeof value === 'string' ? parseFloat(value) : value;
                        if (isNaN(numValue)) {
                          return '$0';
                        }

                        // Format the display value (e.g., $123)
                        const formattedValue = new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0, // Changed to 0 for cleaner display in cell
                          maximumFractionDigits: 0 // Changed to 0 for cleaner display in cell
                        }).format(numValue);

                        return (
                          // Ensure content is returned for display
                          <div
                            className="heatmap-cell-content"
                            title={`${yLabels[y]} in ${xLabels[x]}: ${new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(numValue)}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: "'Inter', sans-serif",
                              fontSize: '0.9em', // Ensure font size is readable
                              fontWeight: '600',
                              minWidth: '80px', // Added min-width for content
                              minHeight: '40px', // Added min-height for content
                            }}
                          >
                            {formattedValue}
                          </div>
                        );
                      }}
                      cellStyle={(x, y, ratio) => ({
                        background: interpolateColor(ratio),
                        color: ratio > 0.5 ? '#fff' : '#333', // Ensure text color contrasts with background
                        borderRadius: '4px',
                        padding: '12px',
                        textAlign: 'center',
                        minWidth: '100px',
                        transition: 'all 0.3s ease'
                      })}
                      cellHeight="60px"
                      xLabelWidth={100}
                      yLabelWidth={120}
                      xLabelsLocation="top"
                      xLabelStyle={(x) => ({
                        color: '#555',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        padding: '10px'
                      })}
                      yLabelStyle={() => ({
                        color: '#555',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        padding: '10px'
                      })}
                    />
                  </div>
                  {/* Heatmap Legend - Added inline style for the color gradient */}
                  <div className="heatmap-legend">
                    <span>${minHeatmapValue.toFixed(0)}</span>
                    <div className="color-bar" style={{
                      background: `linear-gradient(to right, rgb(144, 238, 144), rgb(255, 220, 70), rgb(255, 99, 71))`
                    }}></div>
                    <span>${maxHeatmapValue.toFixed(0)}</span>
                  </div>
                </div>
              ) : (
                <p>No heatmap data available</p>
              )}
            </div>

            {/* Pie Chart Section */}
            <div className="chart-section">
              <h3>Sales by Region (Pie Chart)</h3>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={400} height={300}>
                  {/* Ensure pie chart data values are parsed as numbers */}
                  <Pie
                    data={Object.entries(dashboard?.pie || {}).map(([name, value]) => ({ name, value: parseFloat(value) || 0 }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter}
                  >
                    {(dashboard?.pie ? Object.keys(dashboard.pie) : []).map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value ? parseFloat(value).toFixed(2) : 'N/A'}`} />
                  <Legend />
                </PieChart>
              </div>
            </div>
          </div>
        </>
      )}

      {trends && (
        <div className="section-card">
          <h2>Quarterly Growth Trends</h2>
          <h3>Quarterly Growth Figures:</h3>
          <ul className="styled-list">
            {trends.quarterly_growth && trends.quarterly_growth.map((q, i) => (
              <li key={i}>
                <span className="font-semibold">{q.quarter}:</span> ${q.sales ? parseFloat(q.sales).toFixed(2) : 'N/A'} (
                <span style={{ color: q.growth > 0 ? '#28a745' : (q.growth < 0 ? '#dc3545' : '#6c757d') }}>
                  {/* Added explicit null/undefined check for q.growth */}
                  {(q.growth !== undefined && q.growth !== null) ? (q.growth * 100).toFixed(1) : 'N/A'}%
                </span>
                )
              </li>
            ))}
          </ul>
          {trends.alerts && trends.alerts.length > 0 && (
            <div className="alerts-container">
              <b>Alerts:</b>
              <ul>
                {trends.alerts.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {insightCards.length > 0 && (
        <div className="section-card">
          <h2>Key Insights</h2>
          <div className="card-grid">
            {insightCards.map((card, i) => (
              <div key={i} className="card-item">
                <InsightCard insight={card.title + ': ' + card.value} />
                <div className="feedback-buttons">
                  <button onClick={() => handleFeedback(card.title, 'helpful')}>👍 Helpful</button>
                  <button onClick={() => handleFeedback(card.title, 'not helpful')}>👎 Not Helpful</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="section-card">
          <h2>Auto Recommendations</h2>
          <ul className="styled-list">
            {recommendations.map((rec, i) => <li key={i}>{rec.text}</li>)}
          </ul>
        </div>
      )}

      {/* Footer with dynamic year */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} BizPulse. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;