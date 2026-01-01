const express = require('express');
const router = express.Router();
const {
  createProduct,
  getMyProducts,
  updateProductStatus,
  deleteProduct,
  addQuantity,
  getAvailableProducts,
  getProductById
} = require('../controllers/productController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateUser);

// Farmer-only routes
router.post('/', authorizeRoles('FARMER'), createProduct);
router.get('/', authorizeRoles('FARMER'), getMyProducts);
router.patch('/:id/status', authorizeRoles('FARMER'), updateProductStatus);
router.delete('/:productId', authorizeRoles('FARMER'), deleteProduct);
router.patch('/:productId/add-quantity', authorizeRoles('FARMER'), addQuantity);

module.exports = router;

