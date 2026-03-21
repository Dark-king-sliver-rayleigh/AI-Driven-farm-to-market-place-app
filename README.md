# AgroDirect - Farm Marketplace

A full-stack farm marketplace platform connecting farmers, consumers, and logistics partners. The current app includes API-backed authentication, product management, consumer ordering, logistics assignment/tracking, price intelligence, and demand forecasting.

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

### Additional Features

7. **Price Intelligence**
   - AI-powered price suggestions with confidence scores
   - Rationale display (MSP, mandi rates, trends)
   - Accept/Override price suggestions
   - Negotiation with predicted farmer acceptance likelihood
   - Live API wiring to Price Insight backend (with offline fallback)

8. **Delivery Audit Trail**
    - Photo evidence at each delivery milestone
    - GPS tracking with Leaflet maps
    - Delivery audit entries with timestamps and agent IDs

9. **Enhanced Order Management**
    - Availability confidence badges (HIGH, MEDIUM, LOW)
    - Source indicators (WEB, MOBILE)
    - Product status: NOT_HARVESTED, PRE_ORDER, OUT_OF_STOCK
    - Negotiation chat with price suggestion tags
    - Logistics agent assignment and route tracking

10. **Transaction Enhancements**
    - Pending disbursements list with ETA and reason codes
    - CSV export for settlement statements

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **React Router v6** - Routing
- **Leaflet + React-Leaflet** - Map integration
- **Express + MongoDB + Mongoose** - Backend API and persistence
- **JWT Authentication** - Role-based access control
- **Context API** - Frontend auth/session state
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
   - Register or log in as `FARMER`, `CONSUMER`, or `LOGISTICS`

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
├── src/                             # React frontend
│   ├── components/                  # Shared and role-specific UI
│   ├── pages/integrated/            # API-backed role dashboards
│   ├── context/                     # Auth and tracking context
│   ├── hooks/                       # Data fetching hooks
│   └── services/                    # Frontend API clients
├── server/                          # Express backend
│   ├── controllers/                 # Route handlers
│   ├── models/                      # Mongoose schemas
│   ├── routes/                      # API endpoints
│   ├── services/                    # Domain services
│   └── utils/                       # Helpers, schedulers, storage
├── tests/                           # Vitest test suite
├── package.json
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

- Core application data is stored in **MongoDB**
- Auth session data is stored in **sessionStorage** on the frontend
- Product images are stored as uploaded files under `server/uploads/` and persisted in MongoDB as URLs

## 🔧 Configuration

### Frontend API URL
Set `VITE_API_URL` in `.env` to your backend API base URL.

### Server Public URL
Optional: set `PUBLIC_SERVER_URL` on the backend if uploaded image URLs need an explicit public host.

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

### Current Remaining Enhancements

1. **Cloud Media Storage**: Uploaded product/profile images are now stored as server files; move the storage adapter to S3/Cloudinary for production.
2. **Real-Time Negotiation Chat**: Legacy negotiation chat is still local/mock and should be replaced with socket-based messaging.
3. **Multi-language Support**: UI copy and date/number formatting are still mostly hardcoded.
4. **Payments**: Current checkout flow is COD-first with limited online-payment handling.
5. **Broader Test Coverage**: Integrated frontend flows still need stronger end-to-end coverage.

## 📝 Notes

- **Images**: Product images are stored as server-hosted files and referenced by URL.
- **Authentication**: JWT-based authentication is implemented for all three roles.
- **WebSocket**: The active app is API-driven; legacy negotiation chat still uses mock behavior.
- **Maps**: Uses OpenStreetMap tiles. Consider Mapbox for production.

## 🤝 Contributing

This project is still evolving, but the consumer and logistics interfaces are already present in the current integrated app.

## 📄 License

This project is part of a major project assignment.

---

**Built with ❤️ for farmers**


