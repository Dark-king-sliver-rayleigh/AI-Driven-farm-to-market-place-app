import { useParams, useNavigate } from 'react-router-dom';
import { useConsumerOrders } from '../../hooks/useData';
import { ConsumerTrackingView } from '../../components/integrated/ConsumerTrackingView';

/**
 * Consumer Order Tracking Page
 * 
 * Route: /consumer/orders/:orderId/track
 * Renders the full real-time tracking map for a consumer's order.
 */
export function ConsumerOrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders } = useConsumerOrders();

  // Find matching order for details
  const order = orders.find(o => o._id === orderId);

  const orderDetails = order
    ? {
        deliveryAddress: order.deliveryAddress || order.farmerId?.location || 'Not set',
        items: order.items?.map(item => ({
          name: item.productId?.name || 'Product',
          quantity: item.quantity,
          unit: item.productId?.unit || ''
        })),
        totalAmount: order.totalAmount
      }
    : undefined;

  return (
    <ConsumerTrackingView
      orderId={orderId}
      orderDetails={orderDetails}
      geoapifyApiKey={import.meta.env.VITE_GEOAPIFY_API_KEY}
      onDelivered={() => {
        // Optionally navigate back after delivery
      }}
      onBack={() => navigate('/consumer/orders')}
    />
  );
}

export default ConsumerOrderTracking;
