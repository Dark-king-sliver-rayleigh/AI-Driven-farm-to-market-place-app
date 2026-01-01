# Quick Start Guide

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   - Navigate to `http://localhost:5173`
   - Use the **Role Switcher** (top-right) to switch to "Farmer" role

## First Steps

1. **Set up your profile:**
   - Go to Dashboard → Profile tab
   - Fill in your name, phone, address
   - Upload a profile photo (optional)

2. **Add your first product:**
   - Go to Dashboard → Add Product tab
   - Fill in crop details, quantity, price
   - Upload product images
   - Click "Add Product"

3. **Manage inventory:**
   - Go to Dashboard → Inventory tab
   - Edit products, update status, or delete items

4. **View orders:**
   - Navigate to Orders page
   - Accept/reject orders or negotiate prices

5. **Track logistics:**
   - Go to Track Logistics page
   - View real-time map of delivery agent

6. **Check transactions:**
   - Navigate to Transactions page
   - View earnings and export CSV

## Testing

Run tests:
```bash
npm test
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Troubleshooting

- **Images not showing:** Images are stored as base64 in localStorage. Check browser console for errors.
- **Map not loading:** Ensure you have internet connection (uses OpenStreetMap tiles).
- **Data not persisting:** Check browser localStorage in DevTools → Application → Local Storage → `agrodirect:mockdb:v1`

## Data Reset

To reset all data:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Delete `agrodirect:mockdb:v1`
4. Refresh the page


