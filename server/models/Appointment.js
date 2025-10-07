const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { 
    type: String, 
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  contactNumber: { 
    type: String, 
    required: [true, 'Contact number is required'], 
    trim: true,
    match: [/^(\+)?\d{10,13}$/, 'Please enter a valid contact number (10-13 digits, optional + prefix)']
  },
  area: { 
    type: String, 
    trim: true,
    required: function() { return this.workCategory !== 'Transport' && this.workCategory !== 'Customize'; }
  },
  pincode: { type: String, required: [true, 'PIN code is required'], trim: true, match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit PIN code'] },
  address: { type: String, required: [true, 'Address is required'], trim: true },
  district: { type: String, required: [true, 'District is required'], trim: true },
  state: { type: String, required: [true, 'State is required'], trim: true },
  village: { type: String, required: [true, 'Village is required'], trim: true },
  gunta: { type: Number, required: false, min: [0, 'Gunta cannot be negative'] },
  acre: { type: Number, required: false, min: [0, 'Acre cannot be negative'] },
  sevenTwelveNumber: { 
    type: String, 
    trim: true,
    required: function() { return this.workCategory !== 'Transport' && this.workCategory !== 'Customize'; }
  },
  khataNumber: { type: String, trim: true },
  workCategory: { type: String, required: [true, 'Work category is required'], trim: true },
  date: { type: String, required: [true, 'Date is required'], trim: true },
  time: { 
    type: [String], 
    required: [true, 'At least one time slot is required'], 
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'At least one time slot is required'
    }
  },
  remark: { type: String, trim: true },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  paymentStatus: { type: String, default: 'pending', enum: ['pending', 'completed', 'failed'] },
  paymentMode: { type: String, default: 'online', enum: ['online', 'cash'] },
  attempted: { type: Boolean, default: false },
  pickupLocation: { 
    type: String, 
    trim: true,
    required: function() { return this.workCategory === 'Transport' || this.workCategory === 'Customize'; }
  },
  deliveryLocation: { 
    type: String, 
    trim: true,
    required: function() { return this.workCategory === 'Transport' || this.workCategory === 'Customize'; }
  },
  kilometers: { 
    type: String, 
    trim: true,
    required: function() { return this.workCategory === 'Transport' || this.workCategory === 'Customize'; }
  }
}, { timestamps: true });

appointmentSchema.index({ date: 1, time: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);