const Order = require('../models/Order');
const Product = require('../models/Product');
const MarketPrice = require('../models/MarketPrice');

/**
 * PlatformPriceService
 *
 * Computes the platform's own realized price for a commodity by aggregating
 * data from completed orders on the marketplace.
 *
 * This is distinct from PriceInsightService which uses government mandi data.
 * PlatformPriceService answers: "What price are buyers *actually* paying on
 * our platform for this commodity?"
 *
 * METRICS:
 *  - Weighted average price (weighted by quantity)
 *  - Min / Max price observed
 *  - Total volume traded
 *  - Order count
 *
 * COMPARE:
 *  - Compares platform price vs mandi price for the same commodity
 *  - Calculates spread (absolute) and spread % (relative)
 */

class PlatformPriceService {

  /** Escape regex metacharacters so user input is treated as literal text */
  static _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get list of product names that have at least one DELIVERED order.
   * Used by the frontend for the commodity dropdown on Platform Prices
   * and Demand Forecast pages.
   */
  static async getTradedCommodities() {
    const since = new Date(Date.now() - 365 * 86400000); // last year

    const orders = await Order.find({
      orderStatus: 'DELIVERED',
      updatedAt: { $gte: since }
    }).select('items').populate('items.productId', 'name');

    const nameSet = new Set();
    for (const order of orders) {
      for (const item of order.items) {
        if (item.productId && item.productId.name) {
          nameSet.add(item.productId.name);
        }
      }
    }

    return Array.from(nameSet).sort();
  }

  /**
   * Get aggregated platform prices for a commodity.
   *
   * @param {Object} params
   * @param {string} params.commodity - Commodity / product name (case-insensitive)
   * @param {Date}   [params.from]    - Start date
   * @param {Date}   [params.to]      - End date
   * @param {string} [params.mandi]   - Optional mandi context (used for compare)
   * @returns {Promise<Object>}
   */
  static async getPlatformPrices({ commodity, from, to }) {
    if (!commodity) throw new Error('commodity is required');

    const escaped = this._escapeRegex(commodity);

    // 1. Find products matching the commodity name
    const products = await Product.find({
      name: { $regex: new RegExp(escaped, 'i') },
      isDeleted: false
    }).select('_id name price unit');

    const productIds = products.map(p => p._id);

    if (productIds.length === 0) {
      return this._noDataResponse(commodity, from, to);
    }

    // 2. Find delivered orders containing these products within date range
    const orderMatch = {
      orderStatus: 'DELIVERED',
      'items.productId': { $in: productIds }
    };

    if (from || to) {
      orderMatch.updatedAt = {};
      if (from) orderMatch.updatedAt.$gte = new Date(from);
      if (to) orderMatch.updatedAt.$lte = new Date(to);
    }

    const orders = await Order.find(orderMatch).select('items updatedAt');

    if (orders.length === 0) {
      return this._noDataResponse(commodity, from, to);
    }

    // 3. Extract relevant line items
    const productIdSet = new Set(productIds.map(id => id.toString()));
    let totalValue = 0;
    let totalQty = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const order of orders) {
      for (const item of order.items) {
        if (productIdSet.has(item.productId.toString())) {
          const unitPrice = item.price;
          totalValue += unitPrice * item.quantity;
          totalQty += item.quantity;
          if (unitPrice < minPrice) minPrice = unitPrice;
          if (unitPrice > maxPrice) maxPrice = unitPrice;
        }
      }
    }

    if (totalQty === 0) {
      return this._noDataResponse(commodity, from, to);
    }

    const weightedAvgPrice = Math.round((totalValue / totalQty) * 100) / 100;

    return {
      success: true,
      commodity,
      period: { from: from || null, to: to || null },
      weightedAveragePrice: weightedAvgPrice,
      minPrice: minPrice === Infinity ? null : minPrice,
      maxPrice: maxPrice === -Infinity ? null : maxPrice,
      totalVolume: totalQty,
      totalValue: Math.round(totalValue * 100) / 100,
      orderCount: orders.length,
      unit: products[0]?.unit || 'kg',
      dataSource: 'platform_orders'
    };
  }

  /**
   * Compare platform price vs mandi (government market) price.
   *
   * @param {Object} params
   * @param {string} params.commodity
   * @param {string} params.mandi
   * @param {Date}   [params.from]
   * @param {Date}   [params.to]
   * @returns {Promise<Object>}
   */
  static async comparePrices({ commodity, mandi, from, to }) {
    if (!commodity) throw new Error('commodity is required');
    if (!mandi) throw new Error('mandi is required for comparison');

    // Get platform price
    const platformData = await this.getPlatformPrices({ commodity, from, to });

    // Get mandi price for the same period
    const dateFilter = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.$gte = new Date(from);
      if (to) dateFilter.date.$lte = new Date(to);
    }

    const escapedCommodity = this._escapeRegex(commodity);
    const escapedMandi = this._escapeRegex(mandi);

    const mandiPrices = await MarketPrice.find({
      commodity: { $regex: new RegExp(escapedCommodity, 'i') },
      mandi: { $regex: new RegExp(escapedMandi, 'i') },
      ...dateFilter
    }).sort({ date: -1 });

    let mandiAvgPrice = null;
    let mandiMin = null;
    let mandiMax = null;
    let mandiDataPoints = 0;

    if (mandiPrices.length > 0) {
      mandiDataPoints = mandiPrices.length;
      const modalPrices = mandiPrices.map(p => p.modalPrice);
      mandiAvgPrice = Math.round((modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length) * 100) / 100;
      mandiMin = Math.min(...mandiPrices.map(p => p.minPrice));
      mandiMax = Math.max(...mandiPrices.map(p => p.maxPrice));
    }

    // Convert mandi prices from Rs/Quintal to same unit as platform (e.g. Rs/kg)
    // 1 Quintal = 100 kg
    const platformUnit = platformData.unit || 'kg';
    let mandiAvgConverted = mandiAvgPrice;
    let mandiMinConverted = mandiMin;
    let mandiMaxConverted = mandiMax;
    let mandiDisplayUnit = 'Rs./Quintal';

    if (mandiAvgPrice !== null && platformUnit === 'kg') {
      mandiAvgConverted = Math.round((mandiAvgPrice / 100) * 100) / 100;
      mandiMinConverted = mandiMin !== null ? Math.round((mandiMin / 100) * 100) / 100 : null;
      mandiMaxConverted = mandiMax !== null ? Math.round((mandiMax / 100) * 100) / 100 : null;
      mandiDisplayUnit = `Rs./${platformUnit} (converted from Rs./Quintal)`;
    }

    // Calculate spread using same-unit prices
    const platformPrice = platformData.weightedAveragePrice;
    let spread = null;
    let spreadPct = null;

    if (platformPrice && mandiAvgConverted) {
      spread = Math.round((platformPrice - mandiAvgConverted) * 100) / 100;
      spreadPct = Math.round((spread / mandiAvgConverted) * 100 * 100) / 100;
    }

    return {
      success: true,
      commodity,
      mandi,
      period: { from: from || null, to: to || null },
      platformPrice: {
        weightedAveragePrice: platformPrice,
        minPrice: platformData.minPrice,
        maxPrice: platformData.maxPrice,
        volume: platformData.totalVolume,
        orderCount: platformData.orderCount,
        unit: platformUnit
      },
      mandiPrice: {
        averageModalPrice: mandiAvgConverted,
        minPrice: mandiMinConverted,
        maxPrice: mandiMaxConverted,
        dataPoints: mandiDataPoints,
        unit: mandiDisplayUnit,
        rawUnit: 'Rs./Quintal',
        rawAverageModalPrice: mandiAvgPrice
      },
      comparison: {
        spread,
        spreadPct,
        platformVsMandi: spread > 0 ? 'PLATFORM_HIGHER' : spread < 0 ? 'MANDI_HIGHER' : 'EQUAL',
        note: platformPrice && mandiAvgConverted
          ? `Platform price is ${Math.abs(spreadPct)}% ${spread > 0 ? 'above' : 'below'} mandi average (per ${platformUnit})`
          : 'Insufficient data for comparison'
      }
    };
  }

  static _noDataResponse(commodity, from, to) {
    return {
      success: true,
      commodity,
      period: { from: from || null, to: to || null },
      weightedAveragePrice: null,
      minPrice: null,
      maxPrice: null,
      totalVolume: 0,
      totalValue: 0,
      orderCount: 0,
      unit: null,
      dataSource: 'platform_orders',
      message: `No delivered orders found for commodity "${commodity}" in the given period`
    };
  }
}

module.exports = PlatformPriceService;
