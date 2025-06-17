import React from "react";

function InsightResult({ result }) {
  if (!result) return null;
  return (
    <div style={{ border: "1px solid #4caf50", padding: 16, borderRadius: 8, background: "#f6fff6" }}>
      <h3>Generated Insight</h3>
      <p>{result}</p>
    </div>
  );
}

export default InsightResult;
