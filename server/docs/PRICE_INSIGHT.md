# Price Intelligence Module

## Overview

The Price Intelligence Module provides **transparent, explainable, data-driven price insights** to farmers using government mandi (market) datasets. This module does NOT use machine learning or price prediction — it analyzes historical market data to help farmers make informed pricing decisions.

## Key Principles

1. **No ML/AI Predictions** - All insights are rule-based analysis of actual market data
2. **Full Transparency** - All calculations are explainable and auditable
3. **MSP as Price Floor** - Farmers are guided to never price below the government MSP
4. **Farmer Autonomy** - Suggestions only, final pricing decision belongs to the farmer

## Data Sources

### Mandi Prices - Current Daily Price (Agmarknet)
- **Source**: [data.gov.in](https://data.gov.in) / [Agmarknet](https://agmarknet.gov.in)
- **Dataset**: "Current Daily Price of Various Commodities from Various Markets (Mandi)"
- **Format**: Daily commodity-wise, market-wise price reports
- **Fields**: Commodity, State, Market, Min/Max/Modal Price, Arrivals
- **Update Frequency**: Daily
- **Source Tag**: `data.gov.in`

### Mandi Prices - Variety-wise Daily Prices (NEW)
- **Source**: [data.gov.in](https://data.gov.in)
- **Dataset**: "Variety-wise Daily Market Prices Data of Commodity"
- **Format**: Daily commodity-wise, variety-wise, market-wise price reports
- **Fields**: Commodity, Variety, State, Market, Min/Max/Modal Price
- **Key Differentiator**: Provides granular variety information (e.g., "Tomato - Hybrid", "Tomato - Local")
- **Update Frequency**: Daily
- **Source Tag**: `data.gov.in-variety`

### MSP Data (CACP)
- **Source**: Commission for Agricultural Costs and Prices
- **Format**: Annual commodity-wise MSP announcements
- **Fields**: Commodity, MSP (Rs./Quintal), Season/Year

## API Endpoints

### GET `/api/farmer/price-insight`

Get price insight for a specific commodity and mandi.

**Authorization**: FARMER role only

**Query Parameters**:
- `commodity` (required): Commodity name (e.g., "Tomato", "Onion")
- `mandi` (required): Market name (e.g., "Chennai", "Bangalore")

**Response**:
```json
{
  "success": true,
  "commodity": "Tomato",
  "mandi": "Chennai",
  "suggestedPrice": 4500,
  "minPrice": 4000,
  "maxPrice": 5200,
  "msp": null,
  "trend": "RISING",
  "confidence": "MEDIUM",
  "rationale": "Based on 5 market price records from Chennai over the last 7 days. Prices show an upward trend. No government MSP is available for Tomato. This is a suggestion only — you retain full control over your final pricing decision.",
  "dataPoints": 5,
  "periodDays": 7
}
```

### GET `/api/farmer/price-insight/commodities`

Get list of available commodities in the database.

**Response**:
```json
{
  "success": true,
  "count": 150,
  "commodities": ["Amaranthus", "Banana", "Beans", "Beetroot", ...]
}
```

### GET `/api/farmer/price-insight/mandis`

Get list of available mandis for a commodity.

**Query Parameters**:
- `commodity` (required): Commodity name

**Response**:
```json
{
  "success": true,
  "commodity": "Tomato",
  "count": 45,
  "mandis": ["Bangalore APMC", "Chennai Market", ...]
}
```

## Methodology

### Price Calculation

1. **Suggested Price**: 7-day average of modal prices
2. **Min/Max Range**: Historical min/max from the 7-day period
3. **MSP Floor**: If MSP exists, suggested price is never below MSP

### Trend Analysis

Compares first-half vs second-half of the 7-day period:
- **RISING**: >5% increase in modal prices
- **FALLING**: >5% decrease in modal prices
- **STABLE**: Within ±5% variation

### Confidence Levels

Based on data availability:
- **HIGH**: 5+ data points (>70% coverage)
- **MEDIUM**: 3-4 data points (40-70% coverage)
- **LOW**: 0-2 data points (<40% coverage)

## Error Handling

The module NEVER throws errors for missing data. Instead:
- Returns `null` values for prices
- Sets `confidence` to "LOW"
- Provides clear explanation in `rationale`

## Loading Data

To load/update market data, run:

```bash
cd server
node scripts/loadMarketData.js
```

## Academic Notes

This module is designed for academic evaluation with:
- Clear separation of concerns
- Explainable algorithms
- No black-box ML models
- Government data sources only
- Farmer-centric design

## Future Enhancements

1. Seasonal pattern analysis
2. Weather data correlation
3. Regional price comparison
4. Historical price charts API
