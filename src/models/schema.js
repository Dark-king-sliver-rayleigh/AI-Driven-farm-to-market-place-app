/**
 * Data model schemas for AgroDirect
 * Includes price intelligence, delivery audit
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} farmerId
 * @property {string} name
 * @property {number} quantity
 * @property {'kg'|'lb'|'quintal'|'ton'} unit
 * @property {number} pricePerUnit
 * @property {'INR'|'USD'} currency
 * @property {string[]} images - Array of data URLs
 * @property {{address: string, lat: number, lng: number}} location
 * @property {'NOT_HARVESTED'|'AVAILABLE'|'PRE_ORDER'|'OUT_OF_STOCK'|'DELETED'} status
 * @property {'WEB'|'MOBILE'} source
 * @property {string} lastSyncedAt - ISO date string
 * @property {'HIGH'|'MEDIUM'|'LOW'} availabilityConfidence
 * @property {{value: number, currency: 'INR'|'USD', confidence: number, rationaleId: string}} priceSuggestion
 * @property {string} createdAt - ISO date string
 * @property {string} updatedAt - ISO date string
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} productId
 * @property {string} consumerId
 * @property {number} quantity
 * @property {'kg'|'lb'} unit
 * @property {number} totalPrice
 * @property {'INR'|'USD'} currency
 * @property {'PENDING'|'ACCEPTED'|'REJECTED'|'PICKED_UP'|'OUT_FOR_DELIVERY'|'DELIVERED'} status
 * @property {Array<{from: 'consumer'|'farmer', message: string, priceOffer?: number, createdAt: string}>} negotiation
 * @property {string|null} assignedLogisticsId
 * @property {Array<{timestamp: string, eventType: string, geo: {lat: number, lng: number}, agentId: string, photoUrl?: string, signature?: string}>} deliveryAudit
 * @property {string} createdAt - ISO date string
 */

/**
 * @typedef {Object} Farmer
 * @property {string} id
 * @property {string} name
 * @property {string} phone
 * @property {string} email
 * @property {string} address
 * @property {string|null} profileImage - data URL
 * @property {boolean} verified
 * @property {{avg: number, count: number}} ratings
 * @property {'WEB'} onboardingMethod
 */

/**
 * @typedef {Object} Logistics
 * @property {string} agentId
 * @property {{lat: number, lng: number}} currentGeo
 * @property {'IDLE'|'ASSIGNED'|'EN_ROUTE'|'DELIVERING'} status
 * @property {string[]} assignedOrderIds
 * @property {string|null} routeId
 */

// Export type definitions for JSDoc usage
export const ProductSchema = {}
export const OrderSchema = {}
export const FarmerSchema = {}
export const LogisticsSchema = {}

