require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const appointmentRoutes = require('./routes/appointments');
const adminRoutes = require('./routes/admin');

const app = express();

// Configure CORS to allow requests from the frontend
const allowedOrigin = (process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Mount appointment routes with and without /api prefix
app.use('/api/appointments', appointmentRoutes);
app.use('/appointments', appointmentRoutes); // Added for frontend compatibility

// Mount admin routes with and without /api prefix
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes); // Added for frontend compatibility

// Health check endpoint
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(200).json({
    message: 'Server is running',
    database: dbState === 1 ? 'Connected' : 'Disconnected',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      REACT_APP_FRONTEND_URL: process.env.REACT_APP_FRONTEND_URL,
      MONGO_URI: process.env.MONGO_URI ? '[REDACTED]' : 'Not set'
    }
  });
});

// Handle 404 for unknown routes
app.use((req, res, next) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// MongoDB connection
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  REACT_APP_FRONTEND_URL: process.env.REACT_APP_FRONTEND_URL,
  MONGO_URI: process.env.MONGO_URI ? '[REDACTED]' : 'Not set'
});
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(async () => {
    console.log('Connected to MongoDB');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const appointmentCollection = collections.find(col => col.name === 'appointments');
    console.log('Appointments collection exists:', !!appointmentCollection);
    if (!appointmentCollection) {
      console.warn('Appointments collection not found. Creating...');
      await mongoose.connection.db.createCollection('appointments');
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));