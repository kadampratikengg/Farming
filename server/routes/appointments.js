const express = require('express');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        // More permissive email regex to allow test@test
        return /^[^\s@]+@[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email',
    },
  },
  contactNumber: { type: String, required: true },
  pincode: { type: String, required: true },
  address: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  village: { type: String, required: true },
  gunta: { type: Number, required: true },
  acre: { type: Number, required: true },
  area: { type: String, required: true },
  sevenTwelveNumber: { type: String, required: false },
  khataNumber: { type: String, required: false },
  workCategory: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: [String], required: true },
  remark: { type: String, default: '' },
  paymentMode: { type: String, required: true },
  pickupLocation: { type: String, default: '' },
  deliveryLocation: { type: String, default: '' },
  kilometers: { type: String, default: '' },
  pickupCoords: { type: Object, default: null },
  deliveryCoords: { type: Object, default: null },
  paymentStatus: { type: String, default: 'pending' },
  attempted: { type: Boolean, default: false },
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// GET appointments by date
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    const appointments = await Appointment.find({ date });
    console.log(`Fetched ${appointments.length} booked times for date: ${date}`);
    res.json(appointments);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// POST create appointment
router.post('/', async (req, res) => {
  try {
    console.log('Received POST /api/appointments with body:', req.body);
    const appointmentData = {
      ...req.body,
      acre: parseFloat(req.body.acre) || 0,
      gunta: parseInt(req.body.gunta) || 0,
    };
    const appointment = new Appointment(appointmentData);
    console.log('Appointment instance created:', appointment);
    await appointment.save();
    res.status(201).json({ message: 'Appointment created successfully', appointment });
  } catch (err) {
    console.warn('Error saving appointment:', err);
    res.status(400).json({ error: 'Failed to save appointment', details: err.message });
  }
});

// POST create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    // Ensure minimum amount (₹1 = 100 paise for Razorpay)
    const orderAmount = Math.max(parseInt(amount) || 100, 100); // Default to 100 if amount is missing or too low
    const options = {
      amount: orderAmount, // Amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(400).json({ error: 'Failed to create order', details: err });
  }
});

module.exports = router;