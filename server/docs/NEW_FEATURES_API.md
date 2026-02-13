# New Features - API Reference

**Added**: Route Planning, Logistics KPIs, Platform Price Aggregator, Demand Forecast

All endpoints require `Authorization: Bearer <token>` header.

---

## A) Route Planning (`/api/logistics/routes`)

All endpoints require **LOGISTICS** role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/logistics/routes/plan` | Generate a new route plan |
| GET | `/api/logistics/routes` | List route plans (with filters) |
| GET | `/api/logistics/routes/:id` | Get a route plan by ID |
| POST | `/api/logistics/routes/:id/assign` | Assign a driver to a plan |
| PATCH | `/api/logistics/routes/:id/stops/:stopId/status` | Update stop status |

### POST `/api/logistics/routes/plan`

**Request:**
```json
{
  "orderIds": ["6612abc123...", "6612abc456..."],
  "driverId": "6612def789...",
  "origin": { "lat": 12.97, "lng": 77.59 },
  "vehicleCapacityKg": 500,
  "date": "2026-02-10T06:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Route plan created",
  "routePlan": {
    "_id": "...",
    "date": "2026-02-10T06:00:00.000Z",
    "driverId": "6612def789...",
    "stops": [
      {
        "_id": "stop1...",
        "orderId": "6612abc123...",
        "type": "PICKUP",
        "coordinates": { "lat": 12.95, "lng": 77.58 },
        "address": "Farm A, Bangalore",
        "sequence": 0,
        "eta": "2026-02-10T06:10:00.000Z",
        "plannedDistanceFromPrevKm": 2.35,
        "estimatedDurationFromPrevMin": 14.7,
        "weightKg": 10,
        "status": "PENDING"
      }
    ],
    "totalDistanceKm": 18.45,
    "estimatedDurationMin": 92.3,
    "vehicleCapacityKg": 500,
    "usedCapacityKg": 45,
    "utilizationPct": 9,
    "status": "ASSIGNED"
  }
}
```

### POST `/api/logistics/routes/:id/assign`

**Request:**
```json
{
  "driverId": "6612def789..."
}
```

### PATCH `/api/logistics/routes/:id/stops/:stopId/status`

**Request:**
```json
{
  "status": "COMPLETED",
  "remarks": "Delivered to consumer"
}
```

Stop status flow: `PENDING` → `ARRIVED` → `COMPLETED` / `FAILED` / `SKIPPED`

When a DROP stop is marked COMPLETED, the related Delivery and Order are automatically updated to DELIVERED.

---

## B) Logistics KPIs (`/api/logistics/kpi`)

All endpoints require **LOGISTICS** role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logistics/kpi/summary` | Full KPI summary |
| GET | `/api/logistics/kpi/on-time` | On-time delivery % |
| GET | `/api/logistics/kpi/avg-distance` | Average distance per order |
| GET | `/api/logistics/kpi/capacity-utilization` | Capacity utilization % |
| GET | `/api/logistics/kpi/time-series` | Time-series breakdown |

**Common Query Parameters:**
- `from` (ISO date) — start of period
- `to` (ISO date) — end of period
- `driverId` (ObjectId) — filter to specific driver

### GET `/api/logistics/kpi/summary?from=2026-01-01&to=2026-02-09`

**Response (200):**
```json
{
  "success": true,
  "period": {
    "from": "2026-01-01",
    "to": "2026-02-09"
  },
  "driverId": null,
  "kpis": {
    "onTimePercentage": 85.71,
    "averageDistancePerOrderKm": 12.45,
    "capacityUtilizationPct": 62.5
  },
  "counts": {
    "totalDeliveries": 28,
    "delivered": 21,
    "failed": 3,
    "delayed": 4
  }
}
```

### KPI Formulas

| KPI | Formula |
|-----|---------|
| On-time % | `(deliveries where updatedAt <= expectedDeliveryTime) / total delivered * 100` |
| Avg distance/order | `SUM(delivery.distance for DELIVERED) / COUNT(DELIVERED)` |
| Capacity utilization | `SUM(routePlan.usedCapacityKg) / SUM(routePlan.vehicleCapacityKg) * 100` |

### GET `/api/logistics/kpi/time-series?from=2026-01-01&to=2026-02-09&granularity=day`

**Response:**
```json
{
  "success": true,
  "granularity": "day",
  "count": 5,
  "series": [
    {
      "period": { "year": 2026, "month": 1, "day": 15 },
      "totalDelivered": 3,
      "onTimePercentage": 100,
      "averageDistancePerOrderKm": 8.5
    }
  ]
}
```

---

## C) Platform Price Aggregator

All endpoints require **FARMER** role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/farmer/platform-prices` | Platform realized prices |
| GET | `/api/farmer/price-insight/compare` | Compare platform vs mandi |

### GET `/api/farmer/platform-prices?commodity=Tomato&from=2026-01-01&to=2026-02-09`

**Response (200):**
```json
{
  "success": true,
  "commodity": "Tomato",
  "period": { "from": "2026-01-01", "to": "2026-02-09" },
  "weightedAveragePrice": 48.5,
  "minPrice": 35,
  "maxPrice": 65,
  "totalVolume": 1250,
  "totalValue": 60625,
  "orderCount": 42,
  "unit": "kg",
  "dataSource": "platform_orders"
}
```

### GET `/api/farmer/price-insight/compare?commodity=Tomato&mandi=Chennai`

**Response (200):**
```json
{
  "success": true,
  "commodity": "Tomato",
  "mandi": "Chennai",
  "period": { "from": null, "to": null },
  "platformPrice": {
    "weightedAveragePrice": 48.5,
    "minPrice": 35,
    "maxPrice": 65,
    "volume": 1250,
    "orderCount": 42,
    "unit": "kg"
  },
  "mandiPrice": {
    "averageModalPrice": 4200,
    "minPrice": 3800,
    "maxPrice": 5000,
    "dataPoints": 15,
    "unit": "Rs./Quintal"
  },
  "comparison": {
    "spread": -4151.5,
    "spreadPct": -98.84,
    "platformVsMandi": "MANDI_HIGHER",
    "note": "Platform price is 98.84% below mandi average"
  }
}
```

> **Note:** Platform prices are per-unit (kg/piece), while mandi prices are per Quintal. Direct comparison should account for unit differences.

---

## D) Demand Forecast (`/api/farmer/demand-forecast`)

All endpoints require **FARMER** role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/farmer/demand-forecast` | Get latest forecast |
| POST | `/api/farmer/demand-forecast/generate` | Trigger regeneration |

### GET `/api/farmer/demand-forecast?commodity=Tomato&location=ALL&horizon=90d`

**Response (200):**
```json
{
  "success": true,
  "forecast": {
    "_id": "...",
    "commodity": "Tomato",
    "location": "ALL",
    "horizonDays": 90,
    "totalForecastQty": 3450.5,
    "weeklyBreakdown": [
      {
        "weekNumber": 1,
        "startDate": "2026-02-09T00:00:00Z",
        "endDate": "2026-02-15T00:00:00Z",
        "forecastQty": 295.2,
        "lowerBound": 210.5,
        "upperBound": 379.9
      }
    ],
    "confidence": "MEDIUM",
    "assumptions": [
      "Based on 85 delivered orders over 120 days",
      "Weighted moving average daily demand: 38.34 units",
      "Trend: RISING (+2.15 units/week)",
      "No external market events factored in",
      "Assumes demand patterns continue from historical data"
    ],
    "methodology": "moving_average_trend_seasonality",
    "inputSummary": {
      "historicalOrderCount": 85,
      "historicalDays": 120,
      "avgDailyQty": 38.34,
      "trendDirection": "RISING",
      "trendStrength": 2.15
    },
    "generatedAt": "2026-02-09T10:00:00Z",
    "expiresAt": "2026-02-16T10:00:00Z"
  }
}
```

### POST `/api/farmer/demand-forecast/generate`

**Request:**
```json
{
  "commodity": "Tomato",
  "location": "ALL"
}
```

### Forecast Methodology

1. **Moving Average**: Exponentially weighted (decay=0.92/week) daily demand over 180-day lookback
2. **Trend**: Linear regression on weekly demand buckets
3. **Seasonality**: Day-of-week multipliers clamped to [0.5, 2.0]
4. **Confidence Bounds**: ±0.5 standard deviation per week
5. **Automatic Expiry**: Forecasts expire after 7 days; regenerated on-demand or via scheduler

### Scheduler Integration

Demand forecasts are automatically regenerated every 24 hours via the existing `PriceDataScheduler` infrastructure. Manual trigger available via `POST /api/farmer/demand-forecast/generate`.

---

## Files Changed

### New Files (13)
| File | Purpose |
|------|---------|
| `server/models/RoutePlan.js` | Route plan MongoDB schema |
| `server/models/DemandForecast.js` | Demand forecast MongoDB schema |
| `server/services/RoutePlanningService.js` | Route planning algorithm (nearest-neighbor) |
| `server/services/LogisticsKPIService.js` | KPI computation with MongoDB aggregation |
| `server/services/PlatformPriceService.js` | Platform price aggregation from orders |
| `server/services/DemandForecastService.js` | Statistical demand forecasting |
| `server/controllers/routePlanController.js` | Route plan API handlers |
| `server/controllers/kpiController.js` | KPI API handlers |
| `server/controllers/platformPriceController.js` | Platform price API handlers |
| `server/controllers/demandForecastController.js` | Demand forecast API handlers |
| `server/routes/routePlan.js` | Route plan route definitions |
| `server/routes/kpi.js` | KPI route definitions |
| `server/routes/demandForecast.js` | Demand forecast route definitions |

### Modified Files (3)
| File | Change |
|------|--------|
| `server/server.js` | Mounted 3 new route modules |
| `server/routes/priceInsight.js` | Added platform-prices and compare endpoints |
| `server/utils/priceDataScheduler.js` | Added daily demand forecast scheduler |

### Test Files (1)
| File | Tests |
|------|-------|
| `tests/features.test.js` | 35 unit tests covering algorithms, formulas, state machines |

---

## Assumptions & Known Limitations

1. **Route Planning**: Uses nearest-neighbor heuristic (O(n^2)) — sufficient for typical delivery batches (<100 stops). Not optimal for very large fleets; would need TSP solver for production scale.

2. **Capacity**: Weight is approximated from order item quantities (1 unit ≈ 1 kg default). Accurate weight requires product-level weight data.

3. **Distance**: Road distance is estimated as 1.3× Haversine straight-line distance. Real road distances require the Geoapify API key.

4. **KPIs**: Capacity utilization requires route plans to exist. If routes are not used (individual deliveries only), this metric returns 0.

5. **Platform Prices**: Compares per-unit platform prices against per-quintal mandi prices. Unit normalization is left to the consumer of the API.

6. **Demand Forecast**: Non-ML baseline. Does not account for external events (holidays, weather, market disruptions). Confidence improves with more historical data (50+ orders, 60+ days = HIGH).

7. **Backward Compatibility**: All new endpoints are additive. No existing endpoint signatures or response formats were changed. Existing Delivery/Order status updates from route execution use safe guards.
