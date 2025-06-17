// frontend/src/components/InsightCard.jsx
import React from 'react';
import styles from './InsightCard.module.css'; // Import the CSS module

function InsightCard({ insight }) {
  return (
    <div className={styles.insightCard}> {/* Apply the module class */}
      <p>{insight}</p>
    </div>
  );
}

export default InsightCard;