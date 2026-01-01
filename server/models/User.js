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
