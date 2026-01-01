# AgroDirect Demo Script

This script demonstrates the complete lifecycle of the AgroDirect marketplace:
1. User Registration
2. Product Creation
3. Order Placement
4. Delivery Assignment
5. Delivery Completion

**Base URL**: `http://localhost:5000`

---

## Prerequisites

Start the server:
```bash
cd server
npm run dev
```

Verify server is running:
```bash
curl http://localhost:5000/system/health
```

---

## Step 1: Register Users

### 1.1 Register Farmer
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Raju Farmer",
    "phone": "9876543210",
    "password": "farmer123",
    "role": "FARMER"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "<FARMER_TOKEN>",
  "user": { "id": "...", "name": "Raju Farmer", "role": "FARMER" }
}
```
> 💾 Save the `token` as `FARMER_TOKEN`

### 1.2 Register Consumer
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Consumer",
    "phone": "9876543211",
    "password": "consumer123",
    "role": "CONSUMER"
  }'
```
> 💾 Save the `token` as `CONSUMER_TOKEN`

### 1.3 Register Logistics Partner
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vijay Driver",
    "phone": "9876543212",
    "password": "logistics123",
    "role": "LOGISTICS"
  }'
```
> 💾 Save the `token` as `LOGISTICS_TOKEN`

---

## Step 2: Farmer Creates Products

### 2.1 Create Tomatoes
```bash
curl -X POST http://localhost:5000/api/farmer/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <FARMER_TOKEN>" \
  -d '{
    "name": "Fresh Tomatoes",
    "quantity": 100,
    "unit": "kg",
    "price": 40,
    "status": "AVAILABLE"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "product": {
    "_id": "<PRODUCT_ID_1>",
    "name": "Fresh Tomatoes",
    "quantity": 100,
    "status": "AVAILABLE"
  }
}
```
> 💾 Save `_id` as `PRODUCT_ID`

### 2.2 Create Onions
```bash
curl -X POST http://localhost:5000/api/farmer/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <FARMER_TOKEN>" \
  -d '{
    "name": "Red Onions",
    "quantity": 50,
    "unit": "kg",
    "price": 30,
    "status": "AVAILABLE"
  }'
```

### 2.3 Verify Products
```bash
curl -X GET http://localhost:5000/api/farmer/products \
  -H "Authorization: Bearer <FARMER_TOKEN>"
```

---

## Step 3: Consumer Browses and Orders

### 3.1 Browse Available Products
```bash
curl -X GET http://localhost:5000/api/products \
  -H "Authorization: Bearer <CONSUMER_TOKEN>"
```

### 3.2 Place Order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CONSUMER_TOKEN>" \
  -d '{
    "items": [
      { "productId": "<PRODUCT_ID>", "quantity": 10 }
    ],
    "paymentMode": "COD"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "order": {
    "_id": "<ORDER_ID>",
    "totalAmount": 400,
    "orderStatus": "CREATED"
  }
}
```
> 💾 Save `_id` as `ORDER_ID`

### 3.3 Verify Order Created
```bash
curl -X GET http://localhost:5000/api/consumer/orders \
  -H "Authorization: Bearer <CONSUMER_TOKEN>"
```

### 3.4 Farmer Views Incoming Order
```bash
curl -X GET http://localhost:5000/api/farmer/orders \
  -H "Authorization: Bearer <FARMER_TOKEN>"
```

---

## Step 4: Logistics Picks Up Order

### 4.1 View Available Orders
```bash
curl -X GET "http://localhost:5000/api/logistics/orders?status=CREATED" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>"
```

### 4.2 Accept Order
```bash
curl -X POST http://localhost:5000/api/logistics/orders/<ORDER_ID>/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{
    "pickupLocation": {
      "address": "Raju Farm, Village Greenfield, District Rural",
      "coordinates": { "lat": 28.5355, "lng": 77.3910 }
    },
    "dropLocation": {
      "address": "42 Urban Apartments, Sector 15, City",
      "coordinates": { "lat": 28.4595, "lng": 77.0266 }
    },
    "distance": 25.5
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "delivery": {
    "deliveryStatus": "ASSIGNED"
  }
}
```

### 4.3 Verify Order Status Changed to ASSIGNED
```bash
curl -X GET http://localhost:5000/api/consumer/orders \
  -H "Authorization: Bearer <CONSUMER_TOKEN>"
```

---

## Step 5: Delivery Flow

### 5.1 Update Status: AT_PICKUP
```bash
curl -X PATCH http://localhost:5000/api/logistics/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{ "status": "AT_PICKUP" }'
```

### 5.2 Update Status: PICKED_UP
```bash
curl -X PATCH http://localhost:5000/api/logistics/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{ "status": "PICKED_UP" }'
```

### 5.3 Update Status: IN_TRANSIT
```bash
curl -X PATCH http://localhost:5000/api/logistics/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{ "status": "IN_TRANSIT" }'
```

### 5.4 Update Status: DELIVERED
```bash
curl -X PATCH http://localhost:5000/api/logistics/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{ "status": "DELIVERED" }'
```

**Expected Response**:
```json
{
  "success": true,
  "delivery": { "deliveryStatus": "DELIVERED" },
  "order": { "orderStatus": "DELIVERED" }
}
```

---

## Step 6: Verify Final State

### 6.1 Consumer Sees Delivered Order
```bash
curl -X GET http://localhost:5000/api/consumer/orders \
  -H "Authorization: Bearer <CONSUMER_TOKEN>"
```

### 6.2 Farmer Sees Completed Order
```bash
curl -X GET http://localhost:5000/api/farmer/orders \
  -H "Authorization: Bearer <FARMER_TOKEN>"
```

### 6.3 Check System Stats
```bash
curl http://localhost:5000/system/stats
```

---

## Backup Flow: Delivery Failure

If delivery fails at any point:

### Mark Delivery as Failed
```bash
curl -X PATCH http://localhost:5000/api/logistics/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{ "status": "FAILED" }'
```

**Expected Response**:
```json
{
  "success": true,
  "delivery": { "deliveryStatus": "FAILED" },
  "order": { "orderStatus": "FAILED" }
}
```

---

## Error Scenarios

### 1. Invalid Status Transition
```bash
# Try to go from ASSIGNED directly to DELIVERED
curl -X PATCH http://localhost:5000/api/logistics/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOGISTICS_TOKEN>" \
  -d '{ "status": "DELIVERED" }'
```

**Expected Error**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Invalid status transition from ASSIGNED to DELIVERED",
    "details": { "allowedTransitions": ["AT_PICKUP", "FAILED"] }
  }
}
```

### 2. Insufficient Stock
```bash
# Try to order more than available
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CONSUMER_TOKEN>" \
  -d '{
    "items": [{ "productId": "<PRODUCT_ID>", "quantity": 1000 }],
    "paymentMode": "COD"
  }'
```

### 3. Unauthorized Access
```bash
# Try to access farmer endpoint as consumer
curl -X GET http://localhost:5000/api/farmer/products \
  -H "Authorization: Bearer <CONSUMER_TOKEN>"
```

**Expected Error**:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied - Role 'CONSUMER' is not authorized"
  }
}
```

---

## Summary Checklist

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Register 3 users | Tokens received |
| 2 | Create 2 products | Products listed |
| 3 | Place order | Order status = CREATED |
| 4 | Accept delivery | Delivery status = ASSIGNED |
| 5.1 | At pickup | Status = AT_PICKUP |
| 5.2 | Picked up | Status = PICKED_UP |
| 5.3 | In transit | Status = IN_TRANSIT |
| 5.4 | Delivered | Status = DELIVERED |
| 6 | Verify final state | All parties see DELIVERED |
