import React, { useState } from "react";

function InsightForm({ onSubmit }) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt("");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt..."
        style={{ padding: 8, width: 300, marginRight: 8 }}
      />
      <button type="submit">Get Insight</button>
    </form>
  );
}

export default InsightForm;
