# AgroDirect API Reference

**Base URL**: `http://localhost:5000`

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints Overview

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login user |
| GET | `/api/auth/me` | Protected | Get current user |

### Farmer APIs
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/farmer/products` | FARMER | Create product |
| GET | `/api/farmer/products` | FARMER | List own products |
| PATCH | `/api/farmer/products/:id/status` | FARMER | Update product status |
| GET | `/api/farmer/orders` | FARMER | View orders for my products |
| GET | `/api/farmer/dashboard` | FARMER | Dashboard info |

### Consumer APIs
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | CONSUMER/FARMER | Browse available products |
| GET | `/api/products/:id` | CONSUMER/FARMER | View product details |
| POST | `/api/orders` | CONSUMER | Create order |
| GET | `/api/consumer/orders` | CONSUMER | View my orders |
| GET | `/api/consumer/home` | CONSUMER | Home info |

### Logistics APIs
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/logistics/orders` | LOGISTICS | Get available orders |
| GET | `/api/logistics/my-deliveries` | LOGISTICS | Get assigned deliveries |
| POST | `/api/logistics/orders/:orderId/accept` | LOGISTICS | Accept order |
| POST | `/api/logistics/orders/:orderId/reject` | LOGISTICS | Reject order |
| PATCH | `/api/logistics/orders/:orderId/status` | LOGISTICS | Update delivery status |
| GET | `/api/logistics/dashboard` | LOGISTICS | Dashboard info |

### System APIs
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/system/stats` | Public | System statistics |
| GET | `/system/health` | Public | Health check |
| GET | `/api/health` | Public | Legacy health check |

---

## Detailed API Reference

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Farmer",
  "phone": "9876543210",
  "password": "password123",
  "role": "FARMER"
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Farmer",
    "phone": "9876543210",
    "role": "FARMER"
  }
}
```

---

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "9876543210",
  "password": "password123"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Farmer",
    "phone": "9876543210",
    "role": "FARMER"
  }
}
```

---

### Create Product (Farmer)
```http
POST /api/farmer/products
Authorization: Bearer <farmer_token>
Content-Type: application/json

{
  "name": "Fresh Tomatoes",
  "quantity": 100,
  "unit": "kg",
  "price": 40,
  "status": "AVAILABLE"
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Product created successfully",
  "product": {
    "_id": "507f1f77bcf86cd799439012",
    "farmerId": "507f1f77bcf86cd799439011",
    "name": "Fresh Tomatoes",
    "quantity": 100,
    "unit": "kg",
    "price": 40,
    "status": "AVAILABLE",
    "isOfflineCreated": false,
    "createdAt": "2025-12-19T09:00:00.000Z"
  }
}
```

---

### Update Product Status
```http
PATCH /api/farmer/products/:productId/status
Authorization: Bearer <farmer_token>
Content-Type: application/json

{
  "status": "ON_HOLD_OFFLINE"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Product status updated successfully",
  "product": { ... }
}
```

**Error (400 - Invalid Transition)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Invalid status transition from NOT_HARVESTED to ON_HOLD_OFFLINE",
    "details": {
      "currentStatus": "NOT_HARVESTED",
      "requestedStatus": "ON_HOLD_OFFLINE",
      "allowedTransitions": ["AVAILABLE", "PRE_ORDER"]
    }
  }
}
```

---

### Create Order (Consumer)
```http
POST /api/orders
Authorization: Bearer <consumer_token>
Content-Type: application/json

{
  "items": [
    { "productId": "507f1f77bcf86cd799439012", "quantity": 10 }
  ],
  "paymentMode": "COD"
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "_id": "507f1f77bcf86cd799439013",
    "consumerId": { "name": "Jane Consumer", "phone": "9876543211" },
    "farmerId": { "name": "John Farmer", "phone": "9876543210" },
    "items": [
      {
        "productId": { "name": "Fresh Tomatoes", "unit": "kg" },
        "quantity": 10,
        "price": 40
      }
    ],
    "totalAmount": 400,
    "paymentMode": "COD",
    "orderStatus": "CREATED",
    "createdAt": "2025-12-19T09:05:00.000Z"
  }
}
```

---

### Accept Order (Logistics)
```http
POST /api/logistics/orders/:orderId/accept
Authorization: Bearer <logistics_token>
Content-Type: application/json

{
  "pickupLocation": {
    "address": "Farm ABC, Village XYZ, District",
    "coordinates": { "lat": 28.123, "lng": 77.456 }
  },
  "dropLocation": {
    "address": "123 Main Street, City",
    "coordinates": { "lat": 28.789, "lng": 77.012 }
  },
  "distance": 15.5
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Order accepted successfully",
  "delivery": {
    "_id": "507f1f77bcf86cd799439014",
    "orderId": { ... },
    "driverId": "507f1f77bcf86cd799439015",
    "deliveryStatus": "ASSIGNED",
    "pickupLocation": { ... },
    "dropLocation": { ... },
    "distance": 15.5
  }
}
```

---

### Update Delivery Status
```http
PATCH /api/logistics/orders/:orderId/status
Authorization: Bearer <logistics_token>
Content-Type: application/json

{
  "status": "PICKED_UP"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Delivery status updated successfully",
  "delivery": {
    "_id": "507f1f77bcf86cd799439014",
    "deliveryStatus": "PICKED_UP"
  },
  "order": {
    "_id": "507f1f77bcf86cd799439013",
    "orderStatus": "PICKED_UP"
  }
}
```

---

### System Stats
```http
GET /system/stats
```

**Response (200)**:
```json
{
  "success": true,
  "stats": {
    "users": {
      "total": 20,
      "byRole": { "FARMER": 5, "CONSUMER": 12, "LOGISTICS": 3 }
    },
    "products": {
      "total": 25,
      "byStatus": { "AVAILABLE": 18, "NOT_HARVESTED": 5, "PRE_ORDER": 2 }
    },
    "orders": {
      "total": 45,
      "byStatus": { "CREATED": 5, "ASSIGNED": 10, "PICKED_UP": 8, "DELIVERED": 20, "FAILED": 2 }
    },
    "deliveries": {
      "total": 40,
      "completed": 20,
      "failed": 2,
      "active": 18
    }
  },
  "timestamp": "2025-12-19T09:45:00.000Z"
}
```

---

## Status Flows

### Product Status
```
NOT_HARVESTED ──→ AVAILABLE ──→ ON_HOLD_OFFLINE
      │              │                 │
      ↓              ↓                 ↓
  PRE_ORDER ←──── AVAILABLE ←──── (back to available)
```

Valid Transitions:
- `NOT_HARVESTED` → `AVAILABLE`, `PRE_ORDER`
- `AVAILABLE` → `NOT_HARVESTED`, `ON_HOLD_OFFLINE`, `PRE_ORDER`
- `PRE_ORDER` → `AVAILABLE`, `NOT_HARVESTED`
- `ON_HOLD_OFFLINE` → `AVAILABLE`

### Order Status
```
CREATED → ASSIGNED → PICKED_UP → DELIVERED
    ↓         ↓          ↓
  FAILED    FAILED    FAILED
```

### Delivery Status
```
ASSIGNED → AT_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED
    ↓          ↓           ↓           ↓
  FAILED    FAILED      FAILED      FAILED
```

### Delivery → Order Status Mapping
| Delivery Status | Order Status |
|-----------------|--------------|
| ASSIGNED | ASSIGNED |
| AT_PICKUP | ASSIGNED |
| PICKED_UP | PICKED_UP |
| IN_TRANSIT | PICKED_UP |
| DELIVERED | DELIVERED |
| FAILED | FAILED |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | No/invalid token |
| `TOKEN_EXPIRED` | 401 | JWT has expired |
| `FORBIDDEN` | 403 | Role not allowed |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `INVALID_TRANSITION` | 400 | Invalid status change |
| `INSUFFICIENT_STOCK` | 400 | Not enough quantity |
| `DUPLICATE_ERROR` | 409 | Resource already exists |
| `CONFLICT` | 409 | Operation conflict |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Error Response Format

All errors follow this consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { }  // Optional additional info
  }
}
```
