const Product = require('../models/Product');
const Order = require('../models/Order');
const { persistImageList } = require('../utils/imageStorage');

/**
 * @desc    Create a new product
 * @route   POST /api/farmer/products
 * @access  Private (FARMER only)
 */
const createProduct = async (req, res) => {
  try {
    const { name, quantity, unit, price, status, images, category, pickupLocation } = req.body;
    const storedImages = await persistImageList(images || [], { entity: 'products', req });

    const product = await Product.create({
      farmerId: req.user._id,
      name,
      quantity,
      unit,
      price,
      status: status || 'AVAILABLE',
      images: storedImages,
      category: category || null,
      pickupLocation: pickupLocation?.address ? {
        address: pickupLocation.address,
        coordinates: {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng
        }
      } : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('image')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating product'
    });
  }
};

/**
 * @desc    Get all products for logged-in farmer (excludes soft-deleted)
 * @route   GET /api/farmer/products
 * @access  Private (FARMER only)
 */
const getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      farmerId: req.user._id,
      isDeleted: { $ne: true }  // Exclude soft-deleted products
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products'
    });
  }
};

/**
 * @desc    Update product status
 * @route   PATCH /api/farmer/products/:id/status
 * @access  Private (FARMER only)
 */
const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Find product (exclude deleted)
    const product = await Product.findOne({ _id: id, isDeleted: { $ne: true } });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check ownership
    if (product.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    // Validate status transition
    if (!Product.isValidTransition(product.status, status)) {
      const allowed = Product.getAllowedTransitions(product.status);
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${product.status} to ${status}`,
        allowedTransitions: allowed
      });
    }

    // Update status
    product.status = status;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product status updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating product status'
    });
  }
};

/**
 * @desc    Soft delete a product
 * @route   DELETE /api/farmer/products/:productId
 * @access  Private (FARMER only)
 * 
 * Rules:
 * - Only product owner can delete
 * - Cannot delete if active orders exist (not DELIVERED, FAILED, or CANCELLED)
 */
const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Find product (exclude already deleted)
    const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check ownership
    if (product.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    // Check for active orders containing this product
    const activeOrderStatuses = ['PRE_ORDER', 'CREATED', 'ASSIGNED', 'PICKED_UP'];
    const activeOrders = await Order.find({
      'items.productId': productId,
      orderStatus: { $in: activeOrderStatuses }
    });

    if (activeOrders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product with ${activeOrders.length} active order(s). Complete or cancel orders first.`,
        activeOrderCount: activeOrders.length
      });
    }

    // Soft delete
    product.isDeleted = true;
    product.deletedAt = new Date();
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      productId: product._id
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting product'
    });
  }
};

/**
 * @desc    Add quantity to existing product (restock)
 * @route   PATCH /api/farmer/products/:productId/add-quantity
 * @access  Private (FARMER only)
 * 
 * Uses atomic $inc operation to prevent race conditions
 */
const addQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    // Validate quantity
    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number'
      });
    }

    // Find product (exclude deleted)
    const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check ownership
    if (product.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    // Atomic increment to prevent race conditions
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { quantity: quantity } },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `Added ${quantity} ${updatedProduct.unit} to ${updatedProduct.name}`,
      product: updatedProduct,
      addedQuantity: quantity
    });
  } catch (error) {
    console.error('Add quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding quantity'
    });
  }
};

/**
 * @desc    Get all products for consumers to browse (excludes soft-deleted)
 * @route   GET /api/products
 * @access  Private (CONSUMER, FARMER)
 */
const getAvailableProducts = async (req, res) => {
  try {
    // Return non-deleted products for browsing
    const products = await Product.find({ isDeleted: { $ne: true } })
      .populate('farmerId', 'name phone')
      .sort({ status: 1, createdAt: -1 }); // Sort by status (AVAILABLE first) then newest

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get available products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products'
    });
  }
};

/**
 * @desc    Get single product by ID (excludes soft-deleted)
 * @route   GET /api/products/:id
 * @access  Private (CONSUMER, FARMER)
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true }
    }).populate('farmerId', 'name phone');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product'
    });
  }
};

module.exports = {
  createProduct,
  getMyProducts,
  updateProductStatus,
  deleteProduct,
  addQuantity,
  getAvailableProducts,
  getProductById
};

