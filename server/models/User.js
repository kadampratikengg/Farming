const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Username is required'], 
    unique: true, 
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'], 
    minlength: [6, 'Password must be at least 6 characters']
  },
  contactNumber: { 
    type: String, 
    required: [true, 'Contact number is required'], 
    match: [/^\+\d{10,15}$/, 'Please enter a valid contact number']
  },
  role: { 
    type: String, 
    default: 'admin' 
  },
  resetCode: { type: String },
  resetCodeExpires: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);