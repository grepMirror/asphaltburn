// Dynamically determine the backend URL based on the current hostname
// This allows access via localhost, LAN IP, or any other address without rebuilding
const host = window.location.hostname;
const port = 8000; // Your backend port

export const API_BASE_URL = `http://${host}:${port}`;

console.log('API_BASE_URL:', API_BASE_URL);
