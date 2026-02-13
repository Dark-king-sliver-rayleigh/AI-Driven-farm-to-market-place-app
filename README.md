# AgroDirect - Farm Marketplace

A comprehensive farm marketplace platform connecting farmers, consumers, and logistics partners. This project implements the **Farmer Interface** with full CRUD operations, order management, logistics tracking, and transaction history.

## 🚀 Features

### Farmer Interface

1. **Farmer Profile Management**
   - Personal and business information
   - Profile photo upload
   - Address and location details
   - Verification status display
   - Ratings and feedback summary

2. **Product Management**
   - Add products with images, quantity, price, and location
   - Manage inventory (edit, update status, delete)
   - Mark products as "Not Harvested Yet" or "Available"
   - Support for multiple weight units (kg, lb, quintal, ton)
   - Multi-currency support (INR, USD)

3. **Order Management**
   - View all customer orders
   - Accept/reject orders
   - Negotiation chat with consumers
   - Real-time price negotiation
   - Order status tracking

4. **Logistics Tracking**
   - Real-time map view of delivery agent location
   - Route visualization
   - Pickup and delivery status updates
   - GPS-based tracking with Leaflet maps

5. **Transaction History**
   - Complete earnings ledger
   - Payment status tracking
   - Platform fee breakdown
   - CSV export functionality

6. **Feedback & Ratings**
   - View consumer and logistics partner ratings
   - Average rating display
   - Review comments

### Updated: Offline/SMS/Voice, Escrow, Price Suggestion

7. **Offline & SMS/Voice Listing Support**
   - Farmers can list products via SMS or voice calls
   - Offline mode with sync queue management
   - Pending sync count tracking
   - SMS/Voice format instructions and short codes
   - TODO: Integrate real SMS gateway (Twilio/MSG91) and IVR parser for voice uploads

8. **Price Intelligence**
   - AI-powered price suggestions with confidence scores
   - Rationale display (MSP, mandi rates, trends)
   - Accept/Override price suggestions
   - Negotiation with predicted farmer acceptance likelihood
   - Live API wiring to Price Insight backend (with offline fallback)

9. **Escrow System**
   - Payment held in escrow until delivery verification
   - Escrow status tracking (HELD, RELEASED, DISPUTED)
   - Consumer confirmation required at checkout
   - Dispute resolution flow
   - TODO: Integrate payment gateway supporting UPI and payment holds / escrow (production compliance required)

10. **Delivery Audit Trail**
    - Photo evidence at each delivery milestone
    - GPS tracking with Leaflet maps
    - SMS timeline fallback when GPS unavailable
    - Delivery audit entries with timestamps and agent IDs

11. **Enhanced Order Management**
    - Availability confidence badges (HIGH, MEDIUM, LOW)
    - Source indicators (WEB, MOBILE, SMS, VOICE)
    - Product status: NOT_HARVESTED, PRE_ORDER, ON_HOLD_OFFLINE, OUT_OF_STOCK
    - Negotiation chat with price suggestion tags
    - Logistics agent assignment and route tracking

12. **Transaction Enhancements**
    - Pending disbursements list with ETA and reason codes
    - CSV export for settlement statements
    - Escrow status in order details

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **React Router v6** - Routing
- **Leaflet + React-Leaflet** - Map integration
- **Context API + useReducer** - State management
- **localStorage** - Mock database persistence
- **Vitest** - Testing framework

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Major Project"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## 🎯 Usage

### Getting Started

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Access the application**
   - Open your browser to `http://localhost:5173`
   - Use the **Role Switcher** in the top-right corner to switch to "Farmer" role

3. **Navigate the interface**
   - **Dashboard**: Manage profile, add products, view inventory, and feedback
   - **Orders**: View and manage customer orders
   - **Track Logistics**: Monitor delivery agent location and status
   - **Transactions**: View earnings and transaction history

### Adding a Product

1. Go to **Dashboard** → **Add Product** tab
2. Fill in the form:
   - Crop name
   - Quantity and unit (kg, lb, quintal, ton)
   - Price per unit and currency
   - Upload product images
   - Enter pickup address and coordinates (optional)
3. Click **Add Product**
4. View your product in the **Inventory** tab

### Managing Orders

1. Go to **Orders** page
2. View pending orders from consumers
3. **Accept** or **Reject** orders
4. Click **Negotiate** to chat with consumers and adjust prices
5. Track order status updates

### Tracking Logistics

1. Go to **Track Logistics** page
2. Select an order with assigned logistics
3. View real-time map showing:
   - Farm location
   - Delivery agent current location
   - Route visualization
4. Monitor pickup and delivery progress

## 📁 Project Structure

```
Major Project/
├── src/
│   ├── components/
│   │   ├── AddProductForm.jsx      # Product creation form
│   │   ├── InventoryTable.jsx      # Inventory management table
│   │   ├── NegotiationChat.jsx     # Order negotiation chat
│   │   ├── FeedbackList.jsx         # Ratings and reviews
│   │   └── RoleSwitcher.jsx         # Demo role switcher
│   ├── pages/
│   │   ├── FarmerDashboard.jsx      # Main dashboard
│   │   ├── Orders.jsx               # Order management
│   │   ├── MapTracker.jsx           # Logistics tracking
│   │   └── Transactions.jsx         # Transaction history
│   ├── store/
│   │   ├── StoreContext.jsx         # Global state context
│   │   ├── reducers.js              # State reducers
│   │   └── actions.js               # Action creators
│   ├── utils/
│   │   ├── units.js                 # Unit conversion & currency
│   │   ├── storage.js               # localStorage adapter
│   │   ├── seedData.js              # Demo data generator
│   │   └── mockWebSocket.js         # Mock WebSocket for chat
│   ├── App.jsx                      # Main app with routing
│   ├── main.jsx                     # Entry point
│   └── index.css                    # Global styles
├── tests/
│   └── integration.test.js          # Integration tests
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 🗄️ Data Models

### Product
```javascript
{
  id: "string",
  farmerId: "string",
  name: "string",
  quantity: 100.0,
  unit: "kg | lb | quintal | ton",
  pricePerUnit: 100.0,
  currency: "INR | USD",
  images: ["dataUrl1", "dataUrl2"],
  location: { address: "string", lat: 0.0, lng: 0.0 },
  status: "NOT_HARVESTED | AVAILABLE | SOLD_OUT | DELETED",
  createdAt: "ISODate",
  updatedAt: "ISODate"
}
```

### Order
```javascript
{
  id: "string",
  productId: "string",
  consumerId: "string",
  quantity: 10.0,
  unit: "kg | lb",
  totalPrice: 1000.0,
  currency: "INR | USD",
  status: "PENDING | ACCEPTED | REJECTED | PICKED_UP | DELIVERED",
  negotiation: [...],
  assignedLogisticsId: "string",
  createdAt: "ISODate"
}
```

### Farmer
```javascript
{
  id: "string",
  name: "string",
  phone: "string",
  email: "string",
  address: "string",
  profileImage: "dataUrl",
  verified: boolean,
  ratings: { avg: 4.5, count: 10 }
}
```

### Transaction
```javascript
{
  id: "string",
  farmerId: "string",
  orderId: "string",
  amount: 1000.0,
  currency: "INR | USD",
  date: "ISODate",
  status: "PAID | PENDING | FAILED",
  fees: 0.0
}
```

## 💾 Data Persistence

- All data is stored in **localStorage** under the key `agrodirect:mockdb:v1`
- Data persists across page refreshes
- Seed data is automatically loaded on first run
- To reset data, clear localStorage in browser dev tools

## 🔧 Configuration

### Storage Key
The localStorage key can be changed in `src/utils/storage.js`:
```javascript
const STORAGE_KEY = 'agrodirect:mockdb:v1'
```

### Seed Data
Modify `src/utils/seedData.js` to customize initial demo data.

## 🧪 Testing

Run tests with:
```bash
npm test
```

Test coverage includes:
- Reducer logic (products, orders, farmers, transactions, UI)
- Unit conversion functions
- Currency formatting
- Integration tests for product flow

## 🚧 TODO / Future Enhancements

### Production Integrations Required

1. **SMS Gateway**: Integrate real SMS gateway (Twilio/MSG91) for SMS listing support
2. **IVR Parser**: Integrate IVR parser for voice uploads
3. ~~**Price Intelligence API**: Replace priceEngineMock with real price-intelligence API~~ ✅ **DONE** — Frontend wired to live Price Insight API with graceful offline fallback
4. **Payment Gateway**: Integrate payment gateway supporting UPI and payment holds / escrow (production compliance required)
5. **Reconciliation Service**: Reconcile offline queue using server-side reconciliation endpoints and conflict resolution

### Other Enhancements

6. **Image Storage**: Migrate from base64 to cloud storage (AWS S3, Cloudinary)
7. **Authentication**: Implement real authentication system
8. **Real WebSocket**: Replace mock WebSocket with real-time messaging
9. **Mobile App**: React Native version
10. **Admin Interface**: Complete admin dashboard
11. **Consumer Interface**: Build consumer-facing features
12. **Logistics Interface**: Complete logistics partner features

## 📝 Notes

- **Images**: Currently stored as base64 data URLs. In production, upload to cloud storage.
- **Authentication**: Uses a demo role switcher. Real authentication should be implemented.
- **WebSocket**: Mock implementation for chat. Replace with real WebSocket server.
- **Maps**: Uses OpenStreetMap tiles. Consider Mapbox for production.

## 🤝 Contributing

This is a prototype project. Future interfaces (Consumer, Logistics, Admin) will be added incrementally.

## 📄 License

This project is part of a major project assignment.

---

**Built with ❤️ for farmers**


