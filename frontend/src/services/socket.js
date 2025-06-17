// frontend/src/services/socket.js
import { io } from 'socket.io-client';

// Connect to the Flask-SocketIO backend
const SOCKET_URL = 'http://127.0.0.1:5000';
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  withCredentials: true,
});

// Real-time event handlers
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server');
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

export const subscribeToSales = (callback) => {
  socket.on('new_sale', callback);
  return () => socket.off('new_sale', callback);
};

export const subscribeToDataUpdates = (callback) => {
  socket.on('data_update', callback);
  return () => socket.off('data_update', callback);
};

export default socket;
