const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      console.log(`Appointment not found for GET, ID: ${req.params.id}`);
      return res.status(404).json({ error: 'Appointment not found' });
    }
    console.log('Appointment fetched:', appointment);
    res.status(200).json(appointment);
  } catch (err) {
    console.error('Error fetching appointment:', err);
    res.status(500).json({ error: 'Failed to fetch appointment', details: err.message });
  }
});

router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency, slots, date } = req.body;
    if (!amount || !currency || !slots || !date) {
      console.log('Missing required fields for create-order:', req.body);
      return res.status(400).json({ error: 'Required fields (amount, currency, slots, date) are missing' });
    }

    const existingAppointments = await Appointment.find({ 
      date, 
      time: { $in: slots },
      paymentStatus: 'completed' 
    });
    if (existingAppointments.length > 0) {
      console.log(`One or more slots already booked for date: ${date}, slots: ${slots}`);
      return res.status(400).json({ error: 'One or more time slots are already booked' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials missing');
      return res.status(500).json({ error: 'Payment gateway configuration error' });
    }

    const options = {
      amount,
      currency,
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    console.log('Razorpay order created:', order);
    res.json({ orderId: order.id });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, formData } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !formData) {
      console.log('Missing payment details:', req.body);
      return res.status(400).json({ error: 'Required payment details are missing' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials missing:', {
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET ? '****' : undefined
      });
      return res.status(500).json({ error: 'Payment gateway configuration error' });
    }

    // Validate required formData fields
    const requiredFields = ['name', 'contactNumber', 'pincode', 'address', 'district', 'state', 'village', 'workCategory', 'date', 'time'];
    if (formData.workCategory === 'Transport' || formData.workCategory === 'Customize') {
      requiredFields.push('pickupLocation', 'deliveryLocation', 'kilometers');
    } else {
      requiredFields.push('area', 'sevenTwelveNumber');
    }
    const missingFields = requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      console.log('Missing required formData fields:', missingFields);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate contact number format
    if (!/^(\+)?\d{10,13}$/.test(formData.contactNumber)) {
      console.log('Invalid contact number:', formData.contactNumber);
      return res.status(400).json({ error: 'Contact number must have 10-13 digits with optional + prefix' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.log('Invalid payment signature:', { generatedSignature, razorpay_signature });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const timeArray = Array.isArray(formData.time) ? formData.time : [formData.time];
    if (timeArray.length === 0) {
      console.log('No time slots provided in formData');
      return res.status(400).json({ error: 'At least one time slot is required' });
    }

    const existingAppointments = await Appointment.find({ 
      date: formData.date, 
      time: { $in: timeArray },
      paymentStatus: 'completed' 
    });
    if (existingAppointments.length > 0) {
      console.log(`One or more slots already booked for date: ${formData.date}, slots: ${timeArray}`);
      return res.status(400).json({ error: 'One or more time slots are already booked' });
    }

    const appointmentData = {
      ...formData,
      time: timeArray,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentStatus: 'completed',
      paymentMode: 'online',
    };

    const appointment = new Appointment(appointmentData);
    await appointment.save();
    console.log('Appointment saved:', appointment);
    res.status(201).json(appointment);
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Failed to verify payment', details: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    console.log('Received POST /api/appointments with body:', req.body);
    const { name, email, contactNumber, area, pincode, address, district, state, village, workCategory, date, time, remark, paymentMode, sevenTwelveNumber, pickupLocation, deliveryLocation, kilometers } = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'contactNumber', 'pincode', 'address', 'district', 'state', 'village', 'workCategory', 'date', 'time'];
    if (workCategory === 'Transport' || workCategory === 'Customize') {
      requiredFields.push('pickupLocation', 'deliveryLocation', 'kilometers');
    } else {
      requiredFields.push('area', 'sevenTwelveNumber');
    }
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate contact number format
    if (!/^(\+)?\d{10,13}$/.test(contactNumber)) {
      console.log('Invalid contact number:', contactNumber);
      return res.status(400).json({ error: 'Contact number must have 10-13 digits with optional + prefix' });
    }

    // Validate time as array
    const timeArray = Array.isArray(time) ? time : [time];
    if (timeArray.length === 0) {
      console.log('No time slots provided');
      return res.status(400).json({ error: 'At least one time slot is required' });
    }

    const existingAppointments = await Appointment.find({ 
      date, 
      time: { $in: timeArray },
      paymentStatus: 'completed' 
    });
    if (existingAppointments.length > 0) {
      console.log(`One or more slots already booked for date: ${date}, time: ${timeArray}`);
      return res.status(400).json({ error: 'One or more time slots are already booked' });
    }

    const appointment = new Appointment({ 
      name, 
      email, 
      contactNumber, 
      area, 
      pincode,
      address,
      district,
      state,
      village,
      gunta: req.body.gunta || undefined,
      acre: req.body.acre || undefined,
      sevenTwelveNumber,
      khataNumber: req.body.khataNumber || undefined,
      workCategory,
      date, 
      time: timeArray, 
      remark,
      paymentStatus: paymentMode === 'cash' ? 'pending' : 'completed',
      paymentMode: paymentMode || 'cash',
      pickupLocation,
      deliveryLocation,
      kilometers
    });
    console.log('Appointment instance created:', appointment);
    await appointment.save();
    console.log('Appointment saved:', appointment);
    res.status(201).json(appointment);
  } catch (err) {
    console.error('Error saving appointment:', err);
    res.status(400).json({ error: 'Failed to save appointment', details: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (date) {
      const appointments = await Appointment.find({ date, paymentStatus: 'completed' }).select('time');
      const bookedTimes = appointments.reduce((acc, appointment) => [...acc, ...appointment.time], []);
      console.log(`Fetched ${bookedTimes.length} booked times for date: ${date}`);
      res.json(bookedTimes);
    } else {
      const appointments = await Appointment.find();
      console.log(`Fetched ${appointments.length} appointments`);
      res.json(appointments);
    }
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments', details: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, contactNumber, area, pincode, address, district, state, village, workCategory, date, time, remark, sevenTwelveNumber, paymentMode, paymentStatus, attempted, pickupLocation, deliveryLocation, kilometers } = req.body;
    const requiredFields = ['name', 'contactNumber', 'pincode', 'address', 'district', 'state', 'village', 'workCategory', 'date', 'time'];
    if (workCategory === 'Transport' || workCategory === 'Customize') {
      requiredFields.push('pickupLocation', 'deliveryLocation', 'kilometers');
    } else {
      requiredFields.push('area', 'sevenTwelveNumber');
    }
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      console.log('Missing required fields for update:', missingFields);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate contact number format
    if (!/^(\+)?\d{10,13}$/.test(contactNumber)) {
      console.log('Invalid contact number:', contactNumber);
      return res.status(400).json({ error: 'Contact number must have 10-13 digits with optional + prefix' });
    }

    const timeArray = Array.isArray(time) ? time : [time];
    const existingAppointments = await Appointment.find({
      date,
      time: { $in: timeArray },
      _id: { $ne: req.params.id },
      paymentStatus: 'completed'
    });
    if (existingAppointments.length > 0) {
      console.log(`One or more slots already booked for date: ${date}, time: ${timeArray}`);
      return res.status(400).json({ error: 'One or more time slots are already booked' });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { 
        name, 
        email, 
        contactNumber, 
        area,
        pincode,
        address,
        district,
        state,
        village,
        gunta: req.body.gunta || undefined,
        acre: req.body.acre || undefined,
        sevenTwelveNumber,
        khataNumber: req.body.khataNumber || undefined,
        workCategory,
        date, 
        time: timeArray, 
        remark,
        paymentMode,
        paymentStatus,
        attempted,
        pickupLocation,
        deliveryLocation,
        kilometers
      },
      { new: true, runValidators: true }
    );
    if (!appointment) {
      console.log(`Appointment not found for update, ID: ${req.params.id}`);
      return res.status(404).json({ error: 'Appointment not found' });
    }
    console.log('Appointment updated:', appointment);
    res.status(200).json(appointment);
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(400).json({ error: 'Failed to update appointment', details: err.message });
  }
});

router.patch('/:id/attempted', async (req, res) => {
  try {
    const { attempted } = req.body;
    if (typeof attempted !== 'boolean') {
      console.log('Invalid attempted status:', attempted);
      return res.status(400).json({ error: 'Attempted status must be a boolean' });
    }
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { attempted },
      { new: true, runValidators: true }
    );
    if (!appointment) {
      console.log(`Appointment not found for attempted status update, ID: ${req.params.id}`);
      return res.status(404).json({ error: 'Appointment not found' });
    }
    console.log('Appointment attempted status updated:', appointment);
    res.status(200).json(appointment);
  } catch (err) {
    console.error('Error updating attempted status:', err);
    res.status(400).json({ error: 'Failed to update attempted status', details: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) {
      console.log(`Appointment not found for deletion, ID: ${req.params.id}`);
      return res.status(404).json({ error: 'Appointment not found' });
    }
    console.log('Appointment deleted:', appointment);
    res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ error: 'Failed to delete appointment', details: err.message });
  }
});

module.exports = router;