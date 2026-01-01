/**
 * Seed data helper for demo purposes
 * Creates initial mock data for testing
 * Updated with new model fields: offline/SMS/Voice, escrow, price intelligence, delivery audit
 */

export function seedData() {
  const now = new Date().toISOString()
  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()

  // --- Users ---
  const users = [
    {
      id: 'consumer-1',
      name: 'Demo Consumer',
      phone: '+91 9123456789',
      email: 'consumer@demo.com',
      role: 'consumer',
      defaultAddress: {
        address: 'MG Road, Bangalore',
        lat: 12.9716,
        lng: 77.5946,
        label: 'Home',
      },
      currency: 'INR',
      paymentMethods: [],
    },
    {
      id: 'farmer-1',
      name: 'Rajesh Kumar',
      phone: '+91 9876543210',
      email: 'rajesh@farm.com',
      role: 'farmer',
      address: 'Farm Road, Village A, Taluk B, District C',
      profileImage: null,
      verified: true,
      ratings: {
        avg: 4.5,
        count: 10,
      },
    },
    {
      id: 'logistics-1',
      name: 'Demo Driver',
      phone: '+91 9000000001',
      email: 'driver@demo.com',
      role: 'logistics',
      vehicleType: 'Two Wheeler',
      vehicleNumber: 'KA-01-AB-1234',
      verified: true,
    },
  ]

  // --- Farmers with new fields ---
  const farmers = [
    {
      id: 'f1',
      name: 'Demo Farmer',
      phone: '+91 9876543210',
      email: 'demo@farm.com',
      address: 'Near Demo Village',
      profileImage: null,
      verified: true,
      ratings: {
        avg: 4.5,
        count: 10,
      },
      onboardingMethod: 'SMS',
      pendingSyncCount: 1,
    },
    {
      id: 'farmer-1',
      name: 'Rajesh Kumar',
      phone: '+91 9876543210',
      email: 'rajesh@farm.com',
      address: 'Farm Road, Village A, Taluk B, District C',
      profileImage: null,
      verified: true,
      ratings: {
        avg: 4.5,
        count: 10,
      },
      onboardingMethod: 'WEB',
      pendingSyncCount: 0,
    },
  ]

  // --- Products with new fields ---
  const products = [
    {
      id: 'p1',
      farmerId: 'f1',
      name: 'Tomato',
      quantity: 200,
      unit: 'kg',
      pricePerUnit: 25,
      currency: 'INR',
      images: [],
      location: {
        address: 'Near Demo Village',
        lat: 12.95,
        lng: 77.6,
      },
      status: 'AVAILABLE',
      source: 'SMS',
      lastSyncedAt: yesterday,
      availabilityConfidence: 'MEDIUM',
      priceSuggestion: {
        value: 26,
        currency: 'INR',
        confidence: 0.6,
        rationaleId: 'r1',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'product-1',
      farmerId: 'farmer-1',
      name: 'Organic Tomatoes',
      quantity: 500,
      unit: 'kg',
      pricePerUnit: 40,
      currency: 'INR',
      images: [],
      location: {
        address: 'Farm Road, Village A, Taluk B, District C',
        lat: 12.9716,
        lng: 77.5946,
      },
      status: 'AVAILABLE',
      source: 'WEB',
      lastSyncedAt: now,
      availabilityConfidence: 'HIGH',
      priceSuggestion: {
        value: 42,
        currency: 'INR',
        confidence: 0.85,
        rationaleId: 'r1',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'product-2',
      farmerId: 'farmer-1',
      name: 'Fresh Potatoes',
      quantity: 300,
      unit: 'kg',
      pricePerUnit: 30,
      currency: 'INR',
      images: [],
      location: {
        address: 'Farm Road, Village A, Taluk B, District C',
        lat: 12.9716,
        lng: 77.5946,
      },
      status: 'AVAILABLE',
      source: 'WEB',
      lastSyncedAt: now,
      availabilityConfidence: 'HIGH',
      priceSuggestion: {
        value: 32,
        currency: 'INR',
        confidence: 0.8,
        rationaleId: 'r2',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'product-3',
      farmerId: 'farmer-1',
      name: 'Wheat',
      quantity: 10,
      unit: 'quintal',
      pricePerUnit: 2500,
      currency: 'INR',
      images: [],
      location: {
        address: 'Farm Road, Village A, Taluk B, District C',
        lat: 12.9716,
        lng: 77.5946,
      },
      status: 'NOT_HARVESTED',
      source: 'WEB',
      lastSyncedAt: now,
      availabilityConfidence: 'HIGH',
      priceSuggestion: {
        value: 2550,
        currency: 'INR',
        confidence: 0.75,
        rationaleId: 'r3',
      },
      createdAt: now,
      updatedAt: now,
    },
  ]

  // --- Orders with logistics fields ---
  const orders = [
    {
      id: 'order-1',
      productId: 'product-1',
      consumerId: 'consumer-1',
      quantity: 50,
      unit: 'kg',
      totalPrice: 2000,
      currency: 'INR',
      status: 'PENDING_ASSIGNMENT',
      paymentMethod: 'COD',
      escrowStatus: 'HELD',
      negotiation: [],
      assignedLogisticsId: 'logistics-1',
      pickupLocation: {
        address: 'Farm Road, Village A, Taluk B',
        lat: 12.92,
        lng: 77.55,
      },
      dropLocation: {
        address: 'MG Road, Bangalore',
        lat: 12.9716,
        lng: 77.5946,
      },
      deliveryAudit: [],
      createdAt: now,
    },
    {
      id: 'order-2',
      productId: 'product-2',
      consumerId: 'consumer-1',
      quantity: 20,
      unit: 'kg',
      totalPrice: 600,
      currency: 'INR',
      status: 'ACCEPTED',
      paymentMethod: 'ONLINE',
      escrowStatus: 'HELD',
      negotiation: [],
      assignedLogisticsId: 'logistics-1',
      pickupLocation: {
        address: 'Green Valley Farm, District C',
        lat: 12.88,
        lng: 77.52,
      },
      dropLocation: {
        address: 'Koramangala, Bangalore',
        lat: 12.9352,
        lng: 77.6245,
      },
      deliveryAudit: [
        { status: 'ACCEPTED', timestamp: now, note: 'Driver accepted delivery' }
      ],
      createdAt: yesterday,
    },
    {
      id: 'order-3',
      productId: 'product-1',
      consumerId: 'consumer-1',
      quantity: 30,
      unit: 'kg',
      totalPrice: 1200,
      currency: 'INR',
      status: 'IN_TRANSIT',
      paymentMethod: 'COD',
      escrowStatus: 'HELD',
      negotiation: [],
      assignedLogisticsId: 'logistics-1',
      pickupLocation: {
        address: 'Sunrise Farm, Village B',
        lat: 12.95,
        lng: 77.58,
      },
      dropLocation: {
        address: 'Indiranagar, Bangalore',
        lat: 12.9784,
        lng: 77.6408,
      },
      deliveryAudit: [
        { status: 'ACCEPTED', timestamp: yesterday, note: 'Driver accepted' },
        { status: 'AT_PICKUP', timestamp: yesterday, note: 'Arrived at farm' },
        { status: 'PICKED_UP', timestamp: yesterday, note: 'Produce collected' },
        { status: 'IN_TRANSIT', timestamp: now, note: 'Out for delivery' },
      ],
      createdAt: yesterday,
    },
  ]

  // --- Logistics ---
  const logistics = [
    {
      agentId: 'logistics-1',
      currentGeo: {
        lat: 12.96,
        lng: 77.59,
      },
      status: 'EN_ROUTE',
      assignedOrderIds: ['order-1', 'order-2', 'order-3'],
      routeId: null,
    },
  ]

  const transactions = [
    {
      id: 'txn-1',
      farmerId: 'farmer-1',
      orderId: 'order-1',
      amount: 2000,
      currency: 'INR',
      date: now,
      status: 'PENDING',
      fees: 50,
    },
  ]

  return {
    products,
    orders,
    farmers,
    logistics,
    transactions,
    users,
    cart: [],
    ui: {
      currentUser: {
        id: 'farmer-1',
        role: 'farmer',
      },
      notifications: [],
      offlineQueue: [],
    },
  }
}
