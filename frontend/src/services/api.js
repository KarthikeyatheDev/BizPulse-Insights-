// frontend/src/services/api.js
import axios from 'axios';

// Create an Axios instance with your backend's base URL
const api = axios.create({
  baseURL: 'http://127.0.0.1:5000', // This is the single, correct base URL for your Flask backend
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Now, define your API functions using this 'api' instance with RELATIVE paths
export const getSalesData = () => api.get('/dashboard-data').then(res => res.data);
export const getAIInsight = async (prompt) => {
  try {
    const res = await api.post('/generate', { prompt });
    return res.data.response;
  } catch (error) {
    console.error('API Error:', error.response?.data?.error || error.message);
    throw new Error(error.response?.data?.error || 'Failed to generate insight');
  }
};
export const getInsightCards = () => api.get('/insight-cards').then(res => res.data.data);
export const getRecommendations = () => api.get('/recommendations').then(res => res.data.data);
export const postFeedback = (card, value) => api.post('/feedback', { card, value }).then(res => res.data);
export const getTrends = () => api.get('/trends').then(res => res.data.data);
export const generateInsight = (prompt) => api.post('/generate-insight', { prompt }).then(res => res.data);