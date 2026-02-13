const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate JWT token
 * @param {string} id - User ID
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Validate role
    const validRoles = ['FARMER', 'CONSUMER', 'LOGISTICS'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be FARMER, CONSUMER, or LOGISTICS'
      });
    }

    // Create user
    const user = await User.create({
      name,
      phone,
      password,
      role
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate input
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone and password'
      });
    }

    // Find user and include password
    const user = await User.findOne({ phone }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        address: user.address || '',
        farmArea: user.farmArea || '',
        profilePhoto: user.profilePhoto || '',
        // Location fields
        location: user.location || null,
        pickupLocations: user.pickupLocations || [],
        deliveryAddresses: user.deliveryAddresses || [],
        currentLocation: user.currentLocation || null,
        // Logistics-specific fields
        vehicleType: user.vehicleType || 'BIKE',
        vehicleNumber: user.vehicleNumber || '',
        loadCapacity: user.loadCapacity || 0,
        serviceArea: user.serviceArea || '',
        isAvailable: user.isAvailable ?? true,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PATCH /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { 
      name, phone, address, farmArea, profilePhoto,
      // Logistics-specific fields
      vehicleType, vehicleNumber, loadCapacity, serviceArea, isAvailable,
      // Location fields
      location, pickupLocations, deliveryAddresses
    } = req.body;

    // Build update object with only provided fields
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (address !== undefined) updateFields.address = address.trim();
    if (farmArea !== undefined) updateFields.farmArea = farmArea.trim();
    if (profilePhoto !== undefined) updateFields.profilePhoto = profilePhoto;
    
    // Logistics-specific fields
    if (vehicleType !== undefined) updateFields.vehicleType = vehicleType;
    if (vehicleNumber !== undefined) updateFields.vehicleNumber = vehicleNumber.trim();
    if (loadCapacity !== undefined) updateFields.loadCapacity = Number(loadCapacity) || 0;
    if (serviceArea !== undefined) updateFields.serviceArea = serviceArea.trim();
    if (isAvailable !== undefined) updateFields.isAvailable = Boolean(isAvailable);
    
    // Location fields
    if (location !== undefined) updateFields.location = location;

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        address: user.address || '',
        farmArea: user.farmArea || '',
        profilePhoto: user.profilePhoto || '',
        // Location fields
        location: user.location || null,
        pickupLocations: user.pickupLocations || [],
        deliveryAddresses: user.deliveryAddresses || [],
        currentLocation: user.currentLocation || null,
        // Logistics-specific fields
        vehicleType: user.vehicleType || 'BIKE',
        vehicleNumber: user.vehicleNumber || '',
        loadCapacity: user.loadCapacity || 0,
        serviceArea: user.serviceArea || '',
        isAvailable: user.isAvailable ?? true,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('UpdateProfile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
};

module.exports = { register, login, getMe, updateProfile };
