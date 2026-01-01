# Traceability & Mock UPI Payments Module

## Overview

This module implements:
1. **Immutable Delivery Audit Trail** - Every logistics action is logged
2. **Mock UPI Payment Workflow** - Simulated payment for academic demonstration
3. **Fraud Detection** - Rule-based, non-AI fraud prevention
4. **Read-Only Visibility** - Consumers/Farmers can view delivery timeline

> **ACADEMIC NOTE**: This is NOT a real payment integration. No actual money transfers occur.

---

## Part 1: Delivery Audit Trail

### Schema: deliveryEvents (in Delivery.js)

```javascript
deliveryEvents: [{
  eventType: String,     // CREATED, STATUS_CHANGE, DELAYED, REASSIGNED, DELIVERED, FAILED
  fromStatus: String,
  toStatus: String,
  performedByRole: String,  // LOGISTICS, SYSTEM, ADMIN
  performedBy: ObjectId,
  remarks: String,
  timestamp: Date         // Immutable
}]
```

### Events Logged

| Action | Event Type |
|--------|------------|
| Assign delivery | CREATED |
| Status update | STATUS_CHANGE |
| Delay detected | DELAYED |
| Reassignment | REASSIGNED |
| Delivery complete | COMPLETED |
| Failure | FAILED |

### Read-Only Access

| Role | Access |
|------|--------|
| LOGISTICS | Full audit trail for assigned deliveries |
| CONSUMER | Read-only timeline via `/api/orders/:id/timeline` |
| FARMER | Read-only timeline via `/api/orders/:id/timeline` |

---

## Part 2: Mock UPI Payments

### Payment Schema

```javascript
{
  orderId: ObjectId,      // One payment per order
  payerId: ObjectId,      // Consumer
  amount: Number,
  method: "UPI",
  status: "INITIATED" | "SUCCESS" | "FAILED",
  transactionRef: String, // MOCK-UPI-{timestamp}-{random}
  confirmedAt: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/initiate` | Start payment (CONSUMER) |
| POST | `/api/payments/confirm` | Confirm payment (CONSUMER) |
| GET | `/api/payments/order/:orderId` | Get payment status |
| GET | `/api/payments/my-payments` | Get all payments |

### Payment Flow

```
1. Consumer calls POST /api/payments/initiate
   → status = INITIATED
   → Mock transactionRef generated

2. Consumer calls POST /api/payments/confirm
   → status = SUCCESS (or FAILED for testing)
   → Order.paymentStatus = PAID
```

### Fraud Detection Rules (Non-AI)

| Rule | Enforcement |
|------|-------------|
| One payment per order | Unique index on orderId |
| Amount must match | `amount === order.totalAmount` |
| Payer must be consumer | `payerId === order.consumerId` |
| No duplicate confirmations | Status check before confirm |

All violations are **logged but do NOT crash the system**.

---

## Part 3: Order ↔ Payment Coupling

### Order.paymentStatus

```javascript
paymentStatus: "PENDING" | "PAID" | "FAILED"
```

### Logistics Assignment Rules

Delivery can only be assigned if:
- `paymentMode = COD`, OR
- `paymentMode = ONLINE` AND `paymentStatus = PAID`

---

## Sample Data

### Sample deliveryEvents

```json
[
  {
    "eventType": "CREATED",
    "toStatus": "ASSIGNED",
    "performedByRole": "LOGISTICS",
    "remarks": "Delivery accepted. Expected: 2025-12-21T22:00:00Z",
    "timestamp": "2025-12-21T18:00:00Z"
  },
  {
    "eventType": "STATUS_CHANGE",
    "fromStatus": "ASSIGNED",
    "toStatus": "AT_PICKUP",
    "timestamp": "2025-12-21T18:30:00Z"
  }
]
```

### Sample Mock UPI Transaction

```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "payerId": "507f1f77bcf86cd799439022",
  "amount": 1500,
  "method": "UPI",
  "status": "SUCCESS",
  "transactionRef": "MOCK-UPI-1734789012345-ABC123",
  "confirmedAt": "2025-12-21T17:30:00Z"
}
```

---

## Academic Defensibility

- **No real banking integration** - Mock transaction references only
- **No sensitive data storage** - No bank credentials
- **Rule-based fraud detection** - Explainable, auditable
- **Immutable audit trail** - Events cannot be modified
- **Read-only access for stakeholders** - Transparency without modification
