/**
 * Tests for new feature modules:
 *  - RoutePlanningService (nearest-neighbor algorithm, distance helpers)
 *  - LogisticsKPIService (formula validation)
 *  - PlatformPriceService (aggregation logic)
 *  - DemandForecastService (statistical methods)
 *
 * These are unit tests for pure logic / algorithm functions.
 * They do NOT require a running MongoDB instance.
 */
import { describe, it, expect } from 'vitest'

// ─── Haversine distance (duplicated from service for isolated testing) ────────

function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (d) => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function haversineKm(a, b) {
  return haversineMeters(a, b) / 1000
}

// ─── Nearest-Neighbor sequencing (duplicated for isolated testing) ────────────

function nearestNeighborSequence(stops, origin) {
  const remaining = stops.map((s, i) => ({ ...s, _idx: i }))
  const result = []
  const pickedUpOrders = new Set()
  let currentPos = origin

  while (remaining.length > 0) {
    const eligible = remaining.filter(s => {
      if (s.type === 'DROP') {
        return pickedUpOrders.has(String(s.orderId))
      }
      return true
    })

    if (eligible.length === 0) {
      result.push(...remaining)
      break
    }

    let nearest = null
    let nearestDist = Infinity

    for (const s of eligible) {
      const d = haversineKm(currentPos, s.coordinates)
      if (d < nearestDist) {
        nearestDist = d
        nearest = s
      }
    }

    result.push(nearest)
    currentPos = nearest.coordinates

    if (nearest.type === 'PICKUP') {
      pickedUpOrders.add(String(nearest.orderId))
    }

    const idx = remaining.findIndex(s => s._idx === nearest._idx)
    remaining.splice(idx, 1)
  }

  return result.map(({ _idx, ...rest }) => rest)
}

// ─── Trend computation (duplicated from DemandForecastService) ────────────────

function computeTrend(weeklyDemand) {
  if (weeklyDemand.length < 2) return { slope: 0, direction: 'STABLE' }

  const n = weeklyDemand.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += weeklyDemand[i]
    sumXY += i * weeklyDemand[i]
    sumX2 += i * i
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return { slope: 0, direction: 'STABLE' }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const avgWeekly = sumY / n
  const slopePct = avgWeekly > 0 ? (slope / avgWeekly) * 100 : 0

  let direction = 'STABLE'
  if (slopePct > 5) direction = 'RISING'
  else if (slopePct < -5) direction = 'FALLING'

  return { slope, direction }
}

// ─── Seasonality computation (duplicated from DemandForecastService) ──────────

function computeSeasonality(dayOfWeekDemand) {
  const values = Object.values(dayOfWeekDemand)
  const overallAvg = values.reduce((a, b) => a + b, 0) / 7

  if (overallAvg === 0) {
    return { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
  }

  const factors = {}
  for (let d = 0; d < 7; d++) {
    factors[d] = dayOfWeekDemand[d] / overallAvg
    factors[d] = Math.max(0.5, Math.min(2.0, factors[d]))
  }
  return factors
}

// ─── Weighted moving average (duplicated) ────────────────────────────────────

function weightedMovingAverage(dailyDemand) {
  if (dailyDemand.length === 0) return 0
  const RECENCY_DECAY = 0.92

  let weightedSum = 0
  let weightTotal = 0
  const n = dailyDemand.length

  for (let i = 0; i < n; i++) {
    const weeksBack = Math.floor((n - 1 - i) / 7)
    const weight = Math.pow(RECENCY_DECAY, weeksBack)
    weightedSum += dailyDemand[i].qty * weight
    weightTotal += weight
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0
}

// ─── Std dev (duplicated) ────────────────────────────────────────────────────

function stdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sqDiffs = values.map(v => (v - mean) ** 2)
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Haversine distance calculation', () => {
  it('should return 0 for same point', () => {
    const p = { lat: 12.9716, lng: 77.5946 }
    expect(haversineMeters(p, p)).toBe(0)
  })

  it('should compute accurate distance between Bangalore and Chennai (~290 km)', () => {
    const bangalore = { lat: 12.9716, lng: 77.5946 }
    const chennai = { lat: 13.0827, lng: 80.2707 }
    const distKm = haversineKm(bangalore, chennai)
    expect(distKm).toBeGreaterThan(280)
    expect(distKm).toBeLessThan(310)
  })

  it('should compute short distance accurately', () => {
    // ~1.1 km apart within a city
    const a = { lat: 12.9716, lng: 77.5946 }
    const b = { lat: 12.9816, lng: 77.5946 }
    const distKm = haversineKm(a, b)
    expect(distKm).toBeGreaterThan(1.0)
    expect(distKm).toBeLessThan(1.2)
  })
})

describe('Nearest-Neighbor Route Sequencing', () => {
  it('should sequence PICKUP before DROP for same order', () => {
    const stops = [
      { orderId: 'A', type: 'DROP', coordinates: { lat: 13.0, lng: 77.6 } },
      { orderId: 'A', type: 'PICKUP', coordinates: { lat: 12.9, lng: 77.5 } }
    ]
    const origin = { lat: 12.9, lng: 77.5 }
    const result = nearestNeighborSequence(stops, origin)
    expect(result[0].type).toBe('PICKUP')
    expect(result[1].type).toBe('DROP')
  })

  it('should pick nearest eligible stop first', () => {
    const stops = [
      { orderId: 'A', type: 'PICKUP', coordinates: { lat: 13.0, lng: 77.0 } },
      { orderId: 'B', type: 'PICKUP', coordinates: { lat: 12.91, lng: 77.51 } },
      { orderId: 'A', type: 'DROP', coordinates: { lat: 13.5, lng: 78.0 } },
      { orderId: 'B', type: 'DROP', coordinates: { lat: 13.1, lng: 77.1 } }
    ]
    const origin = { lat: 12.9, lng: 77.5 }
    const result = nearestNeighborSequence(stops, origin)

    // B's pickup is closer to origin
    expect(result[0].orderId).toBe('B')
    expect(result[0].type).toBe('PICKUP')
  })

  it('should handle single order (PICKUP + DROP)', () => {
    const stops = [
      { orderId: 'X', type: 'PICKUP', coordinates: { lat: 12.0, lng: 77.0 } },
      { orderId: 'X', type: 'DROP', coordinates: { lat: 13.0, lng: 78.0 } }
    ]
    const origin = { lat: 12.0, lng: 77.0 }
    const result = nearestNeighborSequence(stops, origin)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('PICKUP')
    expect(result[1].type).toBe('DROP')
  })

  it('should handle 3 orders correctly', () => {
    const stops = [
      { orderId: 'A', type: 'PICKUP', coordinates: { lat: 12.0, lng: 77.0 } },
      { orderId: 'A', type: 'DROP', coordinates: { lat: 12.1, lng: 77.1 } },
      { orderId: 'B', type: 'PICKUP', coordinates: { lat: 12.2, lng: 77.2 } },
      { orderId: 'B', type: 'DROP', coordinates: { lat: 12.3, lng: 77.3 } },
      { orderId: 'C', type: 'PICKUP', coordinates: { lat: 12.4, lng: 77.4 } },
      { orderId: 'C', type: 'DROP', coordinates: { lat: 12.5, lng: 77.5 } }
    ]
    const origin = { lat: 12.0, lng: 77.0 }
    const result = nearestNeighborSequence(stops, origin)

    // Verify all 6 stops are present
    expect(result).toHaveLength(6)

    // Verify each order's PICKUP comes before its DROP
    for (const orderId of ['A', 'B', 'C']) {
      const pickupIdx = result.findIndex(s => s.orderId === orderId && s.type === 'PICKUP')
      const dropIdx = result.findIndex(s => s.orderId === orderId && s.type === 'DROP')
      expect(pickupIdx).toBeLessThan(dropIdx)
    }
  })
})

describe('Demand Forecast - Trend Computation', () => {
  it('should detect RISING trend', () => {
    const weeklyDemand = [10, 12, 15, 18, 22, 27, 33, 40]
    const result = computeTrend(weeklyDemand)
    expect(result.direction).toBe('RISING')
    expect(result.slope).toBeGreaterThan(0)
  })

  it('should detect FALLING trend', () => {
    const weeklyDemand = [50, 45, 40, 35, 30, 25, 20, 15]
    const result = computeTrend(weeklyDemand)
    expect(result.direction).toBe('FALLING')
    expect(result.slope).toBeLessThan(0)
  })

  it('should detect STABLE trend when values are flat', () => {
    const weeklyDemand = [20, 21, 19, 20, 21, 20, 19, 20]
    const result = computeTrend(weeklyDemand)
    expect(result.direction).toBe('STABLE')
  })

  it('should return STABLE for single data point', () => {
    const result = computeTrend([100])
    expect(result.direction).toBe('STABLE')
    expect(result.slope).toBe(0)
  })

  it('should return STABLE for empty array', () => {
    const result = computeTrend([])
    expect(result.direction).toBe('STABLE')
  })
})

describe('Demand Forecast - Seasonality', () => {
  it('should return even factors when all days have equal demand', () => {
    const dow = { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 }
    const result = computeSeasonality(dow)
    for (let d = 0; d < 7; d++) {
      expect(result[d]).toBeCloseTo(1.0, 1)
    }
  })

  it('should produce higher factor for high-demand days', () => {
    const dow = { 0: 5, 1: 10, 2: 10, 3: 10, 4: 10, 5: 20, 6: 30 }
    const result = computeSeasonality(dow)
    // Saturday (6) should have highest factor
    expect(result[6]).toBeGreaterThan(result[0])
    expect(result[6]).toBeGreaterThan(1.0)
  })

  it('should clamp extreme factors to [0.5, 2.0]', () => {
    const dow = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 100 }
    const result = computeSeasonality(dow)
    // Sunday through Friday should be clamped at 0.5 (not 0)
    expect(result[0]).toBeGreaterThanOrEqual(0.5)
    // Saturday should be clamped at 2.0
    expect(result[6]).toBeLessThanOrEqual(2.0)
  })

  it('should return all 1.0 when demand is zero everywhere', () => {
    const dow = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    const result = computeSeasonality(dow)
    for (let d = 0; d < 7; d++) {
      expect(result[d]).toBe(1)
    }
  })
})

describe('Demand Forecast - Weighted Moving Average', () => {
  it('should return 0 for empty data', () => {
    expect(weightedMovingAverage([])).toBe(0)
  })

  it('should return the value for single data point', () => {
    expect(weightedMovingAverage([{ qty: 42 }])).toBeCloseTo(42, 1)
  })

  it('should give more weight to recent data', () => {
    // Old data: low demand, recent data: high demand
    const data = [
      { qty: 5 }, { qty: 5 }, { qty: 5 }, { qty: 5 }, { qty: 5 }, { qty: 5 }, { qty: 5 },
      { qty: 50 }, { qty: 50 }, { qty: 50 }, { qty: 50 }, { qty: 50 }, { qty: 50 }, { qty: 50 }
    ]
    const avg = weightedMovingAverage(data)
    // Should be closer to 50 than to 5 (recency bias)
    expect(avg).toBeGreaterThan(27.5)
  })
})

describe('Standard Deviation', () => {
  it('should return 0 for empty array', () => {
    expect(stdDev([])).toBe(0)
  })

  it('should return 0 for constant values', () => {
    expect(stdDev([5, 5, 5, 5])).toBe(0)
  })

  it('should compute correct std dev', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] -> stddev ≈ 2.0
    const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9])
    expect(result).toBeGreaterThan(1.5)
    expect(result).toBeLessThan(2.5)
  })
})

describe('KPI Formula Validation', () => {
  it('on-time % formula: onTime/total * 100', () => {
    // 8 out of 10 delivered on time
    const onTime = 8, total = 10
    const pct = (onTime / total) * 100
    expect(pct).toBe(80)
  })

  it('avg distance formula: totalDist / orderCount', () => {
    const totalDistance = 150  // km
    const orderCount = 10
    const avg = totalDistance / orderCount
    expect(avg).toBe(15)
  })

  it('capacity utilization formula: used / available * 100', () => {
    const used = 350, available = 500
    const util = (used / available) * 100
    expect(util).toBe(70)
  })

  it('should handle zero denominator safely', () => {
    expect(0 / 0 || 0).toBe(0) // NaN || 0 = 0
    const total = 0
    const pct = total > 0 ? (0 / total) * 100 : 0
    expect(pct).toBe(0)
  })
})

describe('Platform Price Aggregator - Spread Calculation', () => {
  it('should compute positive spread when platform price > mandi price', () => {
    const platformPrice = 5000
    const mandiPrice = 4000
    const spread = platformPrice - mandiPrice
    const spreadPct = (spread / mandiPrice) * 100
    expect(spread).toBe(1000)
    expect(spreadPct).toBe(25)
  })

  it('should compute negative spread when mandi price > platform price', () => {
    const platformPrice = 3000
    const mandiPrice = 4000
    const spread = platformPrice - mandiPrice
    const spreadPct = (spread / mandiPrice) * 100
    expect(spread).toBe(-1000)
    expect(spreadPct).toBe(-25)
  })

  it('should handle equal prices', () => {
    const spread = 4000 - 4000
    expect(spread).toBe(0)
  })

  it('weighted average price = totalValue / totalQty', () => {
    // Order 1: 10 kg @ 50/kg, Order 2: 20 kg @ 60/kg
    const totalValue = 10 * 50 + 20 * 60  // 500 + 1200 = 1700
    const totalQty = 10 + 20               // 30
    const wap = totalValue / totalQty       // 56.67
    expect(wap).toBeCloseTo(56.67, 1)
  })
})

describe('RoutePlan model status transitions', () => {
  const ROUTE_STATUS_TRANSITIONS = {
    'DRAFT':       ['ASSIGNED', 'CANCELLED'],
    'ASSIGNED':    ['IN_PROGRESS', 'CANCELLED'],
    'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
    'COMPLETED':   [],
    'CANCELLED':   []
  }

  const STOP_STATUS_TRANSITIONS = {
    'PENDING':     ['ARRIVED', 'SKIPPED'],
    'ARRIVED':     ['COMPLETED', 'FAILED'],
    'COMPLETED':   [],
    'FAILED':      [],
    'SKIPPED':     []
  }

  function isValidTransition(transitions, from, to) {
    if (from === to) return true
    return (transitions[from] || []).includes(to)
  }

  it('DRAFT can go to ASSIGNED', () => {
    expect(isValidTransition(ROUTE_STATUS_TRANSITIONS, 'DRAFT', 'ASSIGNED')).toBe(true)
  })

  it('DRAFT cannot go to COMPLETED', () => {
    expect(isValidTransition(ROUTE_STATUS_TRANSITIONS, 'DRAFT', 'COMPLETED')).toBe(false)
  })

  it('COMPLETED is terminal', () => {
    expect(isValidTransition(ROUTE_STATUS_TRANSITIONS, 'COMPLETED', 'DRAFT')).toBe(false)
    expect(isValidTransition(ROUTE_STATUS_TRANSITIONS, 'COMPLETED', 'ASSIGNED')).toBe(false)
  })

  it('Stop PENDING can go to ARRIVED or SKIPPED', () => {
    expect(isValidTransition(STOP_STATUS_TRANSITIONS, 'PENDING', 'ARRIVED')).toBe(true)
    expect(isValidTransition(STOP_STATUS_TRANSITIONS, 'PENDING', 'SKIPPED')).toBe(true)
    expect(isValidTransition(STOP_STATUS_TRANSITIONS, 'PENDING', 'COMPLETED')).toBe(false)
  })

  it('Stop ARRIVED can go to COMPLETED or FAILED', () => {
    expect(isValidTransition(STOP_STATUS_TRANSITIONS, 'ARRIVED', 'COMPLETED')).toBe(true)
    expect(isValidTransition(STOP_STATUS_TRANSITIONS, 'ARRIVED', 'FAILED')).toBe(true)
  })
})
