import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Dynamically load Razorpay SDK
const loadRazorpay = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
};

// Initialize the app after loading Razorpay SDK
const initializeApp = async () => {
  try {
    await loadRazorpay();
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    reportWebVitals();
  } catch (error) {
    console.error('Error loading Razorpay SDK:', error);
    // Optionally render an error message or fallback UI
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <div>
        <h1>Error</h1>
        <p>Failed to load payment gateway. Please refresh the page or contact support.</p>
      </div>
    );
  }
};

initializeApp();