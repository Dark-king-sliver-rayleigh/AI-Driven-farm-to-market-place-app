const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[\+]?[0-9\s]{10,15}$/, 'Please enter a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false  // Don't return password by default
  },
  role: {
    type: String,
    enum: {
      values: ['FARMER', 'CONSUMER', 'LOGISTICS'],
      message: 'Role must be FARMER, CONSUMER, or LOGISTICS'
    },
    required: [true, 'Role is required'],
    immutable: true  // Role cannot be changed after creation
  },
  // Profile fields (optional, editable)
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters'],
    default: ''
  },
  farmArea: {
    type: String,
    trim: true,
    maxlength: [100, 'Farm area cannot exceed 100 characters'],
    default: ''
  },
  profilePhoto: {
    type: String,  // Base64 data URL or external URL
    default: ''
  },
  // Logistics-specific fields (only applicable when role=LOGISTICS)
  vehicleType: {
    type: String,
    enum: {
      values: ['BIKE', 'SCOOTER', 'CAR', 'VAN', 'TRUCK'],
      message: 'Vehicle type must be BIKE, SCOOTER, CAR, VAN, or TRUCK'
    },
    default: 'BIKE'
  },
  vehicleNumber: {
    type: String,
    trim: true,
    maxlength: [20, 'Vehicle number cannot exceed 20 characters'],
    default: ''
  },
  loadCapacity: {
    type: Number,  // in kg
    min: [0, 'Load capacity cannot be negative'],
    default: 0
  },
  serviceArea: {
    type: String,
    trim: true,
    maxlength: [200, 'Service area cannot exceed 200 characters'],
    default: ''
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // === LOCATION FIELDS (all roles) ===
  
  // Primary location for the user (farm location / home / hub)
  location: {
    address: { type: String, trim: true, default: '' },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    updatedAt: { type: Date }
  },
  
  // === FARMER-SPECIFIC: Multiple pickup points ===
  pickupLocations: [{
    label: { type: String, trim: true, default: 'Farm' },
    address: { type: String, trim: true, required: true },
    coordinates: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 }
    },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // === CONSUMER-SPECIFIC: Saved delivery addresses ===
  deliveryAddresses: [{
    label: { type: String, trim: true, default: 'Home' },
    address: { type: String, trim: true, required: true },
    coordinates: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 }
    },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // === LOGISTICS-SPECIFIC: Real-time current location ===
  currentLocation: {
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    updatedAt: { type: Date },
    heading: { type: Number, min: 0, max: 360 }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }
  
  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
