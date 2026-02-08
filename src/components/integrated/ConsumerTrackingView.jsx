import React, { useCallback } from 'react';
import { LogisticsTrackingProvider, useLogisticsTracking } from '../../context/LogisticsTrackingContext';
import { LogisticsTrackingMap } from './LogisticsTrackingMap';

/**
 * ConsumerTrackingView Component
 * 
 * PURPOSE:
 * Consumer-facing UI for tracking order delivery.
 * Read-only view of driver location and delivery progress.
 * 
 * FEATURES:
 * - Real-time map with driver position
 * - ETA countdown timer
 * - Status updates
 * - Driver contact information
 * - Delivery confirmation
 * 
 * PROPS:
 * @param {string} orderId - Order ID to track
 * @param {Object} orderDetails - Order information to display
 * @param {string} geoapifyApiKey - Geoapify API key
 * @param {function} onDelivered - Callback when delivery is complete
 * @param {function} onBack - Callback to go back
 */

function ConsumerTrackingContent({
  orderId,
  orderDetails,
  geoapifyApiKey,
  onDelivered,
  onBack
}) {
  const {
    tracking,
    currentState,
    stateMessage,
    markerColor,
    isActive,
    isDelivered,
    distance,
    eta,
    driver,
    etaCountdown,
    formatEtaCountdown,
    progressPercentage,
    LOGISTICS_STATES
  } = useLogisticsTracking();
  
  /**
   * Handle delivery notification
   */
  const handleDeliveryComplete = useCallback(() => {
    if (onDelivered) {
      onDelivered();
    }
  }, [onDelivered]);
  
  /**
   * Get state icon
   */
  const getStateIcon = (state) => {
    const icons = {
      ORDER_CONFIRMED: '📋',
      DRIVER_ASSIGNED: '👤',
      PICKUP_STARTED: '🚗',
      PICKUP_COMPLETED: '📦',
      IN_TRANSIT: '🚚',
      NEAR_DESTINATION: '📍',
      DELIVERED: '✅'
    };
    return icons[state] || '📦';
  };
  
  /**
   * Get progress steps
   */
  const progressSteps = [
    { state: 'ORDER_CONFIRMED', label: 'Order Confirmed' },
    { state: 'DRIVER_ASSIGNED', label: 'Driver Assigned' },
    { state: 'PICKUP_STARTED', label: 'Heading to Pickup' },
    { state: 'PICKUP_COMPLETED', label: 'Picked Up' },
    { state: 'IN_TRANSIT', label: 'On the Way' },
    { state: 'DELIVERED', label: 'Delivered' }
  ];
  
  /**
   * Check if step is complete
   */
  const isStepComplete = (stepState) => {
    const stateOrder = Object.values(LOGISTICS_STATES);
    const currentIndex = stateOrder.indexOf(currentState);
    const stepIndex = stateOrder.indexOf(stepState);
    return stepIndex <= currentIndex;
  };
  
  /**
   * Check if step is current
   */
  const isStepCurrent = (stepState) => {
    return stepState === currentState || 
           (stepState === 'IN_TRANSIT' && currentState === 'NEAR_DESTINATION');
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ←
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-800">Track Order</h1>
                <p className="text-sm text-gray-500">Order #{orderId?.slice(-8)}</p>
              </div>
            </div>
            
            {/* Live indicator */}
            {isActive && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-600 font-medium">Live</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Map Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <LogisticsTrackingMap
            orderId={orderId}
            geoapifyApiKey={geoapifyApiKey}
            onDelivered={handleDeliveryComplete}
            className="h-72 sm:h-96"
          />
        </div>
        
        {/* ETA Card */}
        {isActive && !isDelivered && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Estimated Arrival</p>
                <p className="text-3xl font-bold mt-1">
                  {etaCountdown !== null ? formatEtaCountdown(etaCountdown) : eta?.text || '--'}
                </p>
                {distance?.remaining && (
                  <p className="text-blue-100 text-sm mt-1">
                    {distance.remaining} away
                  </p>
                )}
              </div>
              
              <div className="text-6xl opacity-50">
                {getStateIcon(currentState)}
              </div>
            </div>
          </div>
        )}
        
        {/* Delivery Complete Card */}
        {isDelivered && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="text-center">
              <div className="text-5xl mb-3">✅</div>
              <h2 className="text-2xl font-bold">Order Delivered!</h2>
              <p className="text-green-100 mt-2">
                Thank you for ordering with us
              </p>
              {tracking?.deliveredAt && (
                <p className="text-green-200 text-sm mt-2">
                  Delivered at {new Date(tracking.deliveredAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Status Stepper */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Delivery Progress</h2>
          
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div
              className="absolute left-4 top-0 w-0.5 bg-green-500 transition-all duration-500"
              style={{ height: `${Math.min(progressPercentage, 100)}%` }}
            />
            
            {/* Steps */}
            <div className="space-y-4">
              {progressSteps.map((step, index) => (
                <div key={step.state} className="relative flex items-center pl-10">
                  {/* Step indicator */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isStepComplete(step.state)
                        ? 'bg-green-500 text-white'
                        : isStepCurrent(step.state)
                          ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                          : 'bg-gray-200 text-gray-400'
                      }
                    `}
                  >
                    {isStepComplete(step.state) ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Step label */}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isStepComplete(step.state) || isStepCurrent(step.state)
                        ? 'text-gray-800'
                        : 'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                    
                    {/* Show timestamp for completed steps */}
                    {tracking?.stateHistory && (
                      (() => {
                        const event = tracking.stateHistory.find(e => e.to === step.state);
                        if (event) {
                          return (
                            <p className="text-xs text-gray-400">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </p>
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>
                  
                  {/* Current step indicator */}
                  {isStepCurrent(step.state) && !isDelivered && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Driver Card */}
        {driver && isActive && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Your Driver</h2>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl text-white"
                  style={{ backgroundColor: markerColor }}
                >
                  🚚
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{driver.name}</p>
                  <p className="text-sm text-gray-500">{driver.vehicleNumber}</p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <a
                  href={`tel:${driver.phone}`}
                  className="p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                  title="Call driver"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
        
        {/* Order Summary */}
        {orderDetails && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Order Summary</h2>
            
            <div className="space-y-4">
              {/* Delivery Address */}
              <div className="flex items-start space-x-3">
                <span className="text-xl">📍</span>
                <div>
                  <p className="font-medium text-gray-700">Delivery Address</p>
                  <p className="text-sm text-gray-500">{orderDetails.deliveryAddress}</p>
                </div>
              </div>
              
              {/* Items */}
              {orderDetails.items && orderDetails.items.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="font-medium text-gray-700 mb-3">Items</p>
                  <div className="space-y-2">
                    {orderDetails.items.map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-600">{item.name}</span>
                        <span className="text-gray-800 font-medium">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {orderDetails.totalAmount && (
                    <div className="flex justify-between mt-4 pt-4 border-t border-gray-100">
                      <span className="font-semibold text-gray-800">Total</span>
                      <span className="font-bold text-gray-900">
                        ₹{orderDetails.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Help Card */}
        <div className="bg-gray-100 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">
            Need help with your order?
          </p>
          <button className="mt-2 text-blue-600 font-medium hover:underline">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper component that provides the tracking context
 */
export function ConsumerTrackingView(props) {
  return (
    <LogisticsTrackingProvider>
      <ConsumerTrackingContent {...props} />
    </LogisticsTrackingProvider>
  );
}

export default ConsumerTrackingView;
