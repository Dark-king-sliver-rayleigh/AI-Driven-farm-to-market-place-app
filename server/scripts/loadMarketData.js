/**
 * Data Loader Script
 * 
 * This script loads market price and MSP data from CSV files into MongoDB.
 * Run this once to populate the database with government datasets.
 * 
 * Usage: node scripts/loadMarketData.js
 * 
 * DATA SOURCES:
 * - Mandi prices: Agmarknet daily reports (CSV from data directory)
 * - MSP prices: CACP data (CSV from data directory)
 * 
 * ACADEMIC NOTE:
 * This loader handles the specific format of Agmarknet CSV files which
 * have embedded state/market headers within the data rows.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MarketPrice = require('../models/MarketPrice');
const MSPPrice = require('../models/MSPPrice');

/**
 * Parse Agmarknet CSV file
 * 
 * Agmarknet CSV format has:
 * - Line 1: Report title with date
 * - Line 2: Empty
 * - Line 3: Column headers
 * - Following lines: Either "State Name: X" or "Market Name: X" or data rows
 */
function parseAgmarknetCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Extract date from first line
  // Format: "Market-wise, Commodity-wise Daily Report on: 19-Dec-2025"
  const dateMatch = lines[0].match(/(\d{1,2}-\w{3}-\d{4})/);
  const reportDate = dateMatch ? new Date(dateMatch[1]) : new Date();
  
  let currentState = '';
  let currentMarket = '';
  const records = [];
  
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line === 'Not Reported') continue;
    
    // Check for state header
    if (line.startsWith('State Name :')) {
      currentState = line.replace('State Name :', '').trim();
      continue;
    }
    
    // Check for market header
    if (line.startsWith('Market Name :')) {
      currentMarket = line.replace('Market Name :', '').trim();
      continue;
    }
    
    // Parse data row
    // Format: Commodity,Arrivals,Unit,Variety,Grade,MinPrice,MaxPrice,ModalPrice,PriceUnit
    const parts = line.split(',');
    if (parts.length >= 8) {
      const commodity = parts[0].trim();
      const arrivals = parseFloat(parts[1]) || 0;
      const variety = parts[3].trim();
      const minPrice = parseFloat(parts[5]) || 0;
      const maxPrice = parseFloat(parts[6]) || 0;
      const modalPrice = parseFloat(parts[7]) || 0;
      const priceUnit = parts[8] ? parts[8].trim() : 'Rs./Quintal';
      
      // Only add valid price records
      if (commodity && modalPrice > 0) {
        records.push({
          commodity,
          state: currentState,
          mandi: currentMarket,
          date: reportDate,
          minPrice,
          maxPrice,
          modalPrice,
          variety,
          unit: priceUnit,
          arrivals
        });
      }
    }
  }
  
  return records;
}

/**
 * Parse MSP CSV file
 * 
 * Format: Commodity,MSP Price,Season/Year
 */
function parseMSPCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const records = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 3) {
      const commodity = parts[0].trim();
      const msp = parseFloat(parts[1].replace(/[^\d.]/g, '')) || 0;
      const season = parts[2].trim();
      
      if (commodity && msp > 0) {
        records.push({
          commodity,
          msp,
          season
        });
      }
    }
  }
  
  return records;
}

/**
 * Load all market data from the data directory
 */
async function loadMarketData() {
  const dataDir = path.join(__dirname, '..', 'data');
  const files = fs.readdirSync(dataDir);
  
  let totalRecords = 0;
  
  // Process market price CSV files
  const marketFiles = files.filter(f => f.startsWith('Market-wise') && f.endsWith('.csv'));
  
  console.log(`📊 Found ${marketFiles.length} market price files`);
  
  for (const file of marketFiles) {
    const filePath = path.join(dataDir, file);
    console.log(`  Processing: ${file}`);
    
    const records = parseAgmarknetCSV(filePath);
    
    if (records.length > 0) {
      // Use insertMany with ordered: false to skip duplicates
      try {
        await MarketPrice.insertMany(records, { ordered: false });
        totalRecords += records.length;
        console.log(`    ✅ Loaded ${records.length} records`);
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error - some records already exist
          const inserted = error.result?.nInserted || 0;
          console.log(`    ⚠️ Loaded ${inserted} new records (some duplicates skipped)`);
          totalRecords += inserted;
        } else {
          console.error(`    ❌ Error loading ${file}:`, error.message);
        }
      }
    }
  }
  
  console.log(`\n📈 Total market price records loaded: ${totalRecords}`);
  return totalRecords;
}

/**
 * Load MSP data from CSV
 */
async function loadMSPData() {
  const dataDir = path.join(__dirname, '..', 'data');
  const mspFile = path.join(dataDir, 'Untitled spreadsheet - Sheet1.csv');
  
  if (!fs.existsSync(mspFile)) {
    console.log('⚠️ MSP file not found');
    return 0;
  }
  
  console.log(`📊 Processing MSP data file`);
  
  const records = parseMSPCSV(mspFile);
  
  if (records.length > 0) {
    // Clear existing MSP data and reload
    await MSPPrice.deleteMany({});
    await MSPPrice.insertMany(records);
    console.log(`  ✅ Loaded ${records.length} MSP records`);
    return records.length;
  }
  
  return 0;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Load market data
    console.log('📥 Loading Market Price Data...');
    const marketCount = await loadMarketData();
    
    // Load MSP data
    console.log('\n📥 Loading MSP Data...');
    const mspCount = await loadMSPData();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 DATA LOAD SUMMARY');
    console.log('='.repeat(50));
    console.log(`Market Price Records: ${marketCount}`);
    console.log(`MSP Records: ${mspCount}`);
    console.log('='.repeat(50));
    
    // Show sample data
    console.log('\n📋 Sample Market Data:');
    const sampleMarket = await MarketPrice.find().limit(3);
    sampleMarket.forEach(r => {
      console.log(`  - ${r.commodity} @ ${r.mandi}: ₹${r.modalPrice}/${(r.unit || 'Rs./Quintal').replace(/^Rs\.\//, '').toLowerCase()}`);
    });
    
    console.log('\n📋 Sample MSP Data:');
    const sampleMSP = await MSPPrice.find().limit(3);
    sampleMSP.forEach(r => {
      console.log(`  - ${r.commodity}: ₹${r.msp}/quintal (${r.season})`);  // MSP is always per quintal
    });
    
    console.log('\n✅ Data loading complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
main();
