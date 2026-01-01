# Logistics Module - Enhanced Documentation

## Overview

The Logistics module has been extended with:
1. **Immutable Audit Trail** - Every status change is logged
2. **SLA & Expected Delivery Time** - Computed on assignment
3. **Delay Detection** - Automatic detection when SLA is exceeded
4. **Backup Reassignment** - Delayed deliveries can be reassigned

## Schema Enhancements

### Delivery Schema

New fields added to `models/Delivery.js`:

| Field | Type | Description |
|-------|------|-------------|
| `expectedDeliveryTime` | Date | Computed SLA deadline |
| `isDelayed` | Boolean | True if SLA exceeded |
| `delayDetectedAt` | Date | When delay was detected |
| `deliveryEvents` | Array | Append-only audit trail |
| `previousDriverId` | ObjectId | For tracking reassignments |
| `reassignmentCount` | Number | Number of reassignments |

### DeliveryEvent Schema (Embedded)

Each event in the audit trail contains:

| Field | Type | Description |
|-------|------|-------------|
| `eventType` | String | CREATED, STATUS_CHANGE, DELAYED, REASSIGNED, etc. |
| `fromStatus` | String | Previous status |
| `toStatus` | String | New status |
| `driverId` | ObjectId | Driver at time of event |
| `performedByRole` | String | LOGISTICS, SYSTEM, etc. |
| `performedBy` | ObjectId | User who performed action |
| `remarks` | String | Human-readable notes |
| `timestamp` | Date | Immutable timestamp |

## API Endpoints

### Existing Endpoints (Enhanced)

| Method | Endpoint | Changes |
|--------|----------|---------|
| POST | `/api/logistics/orders/:orderId/accept` | Now computes SLA, logs CREATED event |
| PATCH | `/api/logistics/orders/:orderId/status` | Now logs STATUS_CHANGE, checks delay |

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logistics/delayed` | Get delayed deliveries |
| GET | `/api/logistics/pending-reassignment` | Get deliveries awaiting reassignment |
| POST | `/api/logistics/deliveries/:id/reassign` | Initiate reassignment |
| POST | `/api/logistics/deliveries/:id/accept-reassignment` | Accept reassignment |
| GET | `/api/logistics/deliveries/:id/events` | Get audit trail |

## SLA Calculation

Expected delivery time is calculated as:
- **Base SLA**: 4 hours
- **Distance adjustment**: +30 minutes per 10 km beyond first 10 km
- **Maximum cap**: 8 hours

```javascript
let slaHours = 4;  // Base
if (distance > 10) {
  slaHours += ((distance - 10) / 10) * 0.5;
}
slaHours = Math.min(slaHours, 8);  // Cap
```

## Delay Detection

On every status update:
1. System checks if `current time > expectedDeliveryTime`
2. If true, sets `isDelayed = true`
3. Adds DELAYED event to audit trail

## Reassignment Flow

1. **Initiate**: `POST /api/logistics/deliveries/:id/reassign`
   - Only delayed deliveries can be reassigned
   - Status changes to `PENDING_REASSIGNMENT`
   - REASSIGNED event logged

2. **Accept**: `POST /api/logistics/deliveries/:id/accept-reassignment`
   - New driver accepts the delivery
   - Status returns to `ASSIGNED`
   - New SLA is calculated
   - Delay flag is reset

## Sample Audit Trail

```json
{
  "deliveryId": "507f1f77bcf86cd799439011",
  "currentStatus": "DELIVERED",
  "isDelayed": true,
  "eventCount": 5,
  "events": [
    {
      "eventType": "CREATED",
      "toStatus": "ASSIGNED",
      "performedByRole": "LOGISTICS",
      "remarks": "Delivery accepted by driver. Expected: 2025-12-21T20:00:00Z",
      "timestamp": "2025-12-21T16:00:00Z"
    },
    {
      "eventType": "STATUS_CHANGE",
      "fromStatus": "ASSIGNED",
      "toStatus": "AT_PICKUP",
      "performedByRole": "LOGISTICS",
      "timestamp": "2025-12-21T16:30:00Z"
    },
    {
      "eventType": "DELAYED",
      "fromStatus": "AT_PICKUP",
      "toStatus": "AT_PICKUP",
      "performedByRole": "SYSTEM",
      "remarks": "Delivery exceeded expected time",
      "timestamp": "2025-12-21T20:15:00Z"
    },
    {
      "eventType": "STATUS_CHANGE",
      "fromStatus": "AT_PICKUP",
      "toStatus": "PICKED_UP",
      "performedByRole": "LOGISTICS",
      "timestamp": "2025-12-21T20:30:00Z"
    },
    {
      "eventType": "COMPLETED",
      "fromStatus": "IN_TRANSIT",
      "toStatus": "DELIVERED",
      "performedByRole": "LOGISTICS",
      "remarks": "Delivery completed successfully",
      "timestamp": "2025-12-21T21:00:00Z"
    }
  ]
}
```

## Academic Notes

- **No ML models** - All logic is rule-based and explainable
- **No background schedulers** - Delay detection is on-demand
- **No automatic reassignment** - Requires explicit human action
- **Immutable audit trail** - Events cannot be deleted or modified
- **Strict status transitions** - Enforced by schema validation
