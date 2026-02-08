package com.agrodirect.logistics.tracking

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.OnMapReadyCallback
import org.maplibre.android.maps.Style
import org.maplibre.android.plugins.annotation.SymbolManager
import org.maplibre.android.plugins.annotation.SymbolOptions
import org.maplibre.android.plugins.annotation.Symbol
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource
import com.google.gson.JsonObject
import com.google.gson.JsonArray
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.*

/**
 * LogisticsTrackingFragment - Android Implementation
 *
 * PURPOSE:
 * Real-time delivery tracking visualization for Android using MapLibre + Geoapify tiles.
 * Shows farmer location, consumer location, driver movement, and route polyline.
 *
 * FEATURES:
 * - MapLibre map with Geoapify tile style
 * - Annotations for farmer, consumer, and driver
 * - Animated driver movement along route
 * - State-based marker colors
 * - ETA countdown display
 * - Polling for real-time updates
 *
 * CRITICAL RULE:
 * All driver location updates come from the backend via polling.
 * NO client-side location computation or faking is allowed.
 *
 * BUILD SETUP:
 * Add to build.gradle:
 *   implementation 'org.maplibre.gl:android-sdk:11.+'
 *   implementation 'org.maplibre.gl:android-plugin-annotation-v9:3.+'
 *
 * Initialize in Application.onCreate():
 *   MapLibre.getInstance(this)
 *
 * USAGE:
 * val fragment = LogisticsTrackingFragment.newInstance(orderId)
 * supportFragmentManager.beginTransaction()
 *     .replace(R.id.container, fragment)
 *     .commit()
 */
class LogisticsTrackingFragment : Fragment(), OnMapReadyCallback {

    companion object {
        private const val TAG = "LogisticsTracking"
        private const val ARG_ORDER_ID = "order_id"
        private const val POLLING_INTERVAL_MS = 5000L
        private const val ANIMATION_DURATION_MS = 500L
        /** Set via BuildConfig or resources */
        private const val GEOAPIFY_API_KEY = "" // TODO: set from BuildConfig

        fun newInstance(orderId: String): LogisticsTrackingFragment {
            return LogisticsTrackingFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_ORDER_ID, orderId)
                }
            }
        }
    }

    // ============================================
    // STATE MACHINE DEFINITIONS
    // ============================================

    enum class LogisticsState(val displayMessage: String, val markerColor: String) {
        ORDER_CONFIRMED("Order confirmed, waiting for driver", "#9CA3AF"),
        DRIVER_ASSIGNED("Driver assigned to your order", "#3B82F6"),
        PICKUP_STARTED("Driver heading to pickup location", "#F59E0B"),
        PICKUP_COMPLETED("Package collected, delivery starting", "#10B981"),
        IN_TRANSIT("Your order is on the way", "#10B981"),
        NEAR_DESTINATION("Driver is nearby", "#8B5CF6"),
        DELIVERED("Order delivered successfully", "#059669")
    }

    // ============================================
    // PROPERTIES
    // ============================================

    private var orderId: String? = null
    private var mapLibreMap: MapLibreMap? = null
    private var mapView: MapView? = null
    private var isMapReady = false

    // Annotations
    private var symbolManager: SymbolManager? = null
    private var farmerSymbol: Symbol? = null
    private var consumerSymbol: Symbol? = null
    private var driverSymbol: Symbol? = null
    private var routeSource: GeoJsonSource? = null

    // Tracking state
    private var currentState: LogisticsState = LogisticsState.ORDER_CONFIRMED
    private var isPolling = false
    private var trackingData: TrackingData? = null

    // Handlers
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null

    // Listeners
    var onStateChanged: ((LogisticsState, LogisticsState) -> Unit)? = null
    var onDelivered: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    // ============================================
    // DATA CLASSES
    // ============================================

    data class Coordinate(val lat: Double, val lng: Double)

    data class LocationInfo(
        val address: String,
        val coordinates: Coordinate
    )

    data class DriverInfo(
        val name: String,
        val phone: String,
        val vehicleNumber: String
    )

    data class DistanceInfo(
        val total: String,
        val remaining: String,
        val remainingMeters: Int
    )

    data class EtaInfo(
        val arrival: String?,
        val seconds: Int,
        val text: String
    )

    data class TrackingData(
        val orderId: String,
        val currentState: String,
        val stateMessage: String,
        val markerColor: String,
        val driverLocation: Coordinate,
        val farmerLocation: LocationInfo,
        val consumerLocation: LocationInfo,
        val routePolyline: String?,
        val distance: DistanceInfo,
        val eta: EtaInfo,
        val driver: DriverInfo?,
        val isActive: Boolean,
        val progressPercentage: Int
    )

    // ============================================
    // LIFECYCLE
    // ============================================

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        orderId = arguments?.getString(ARG_ORDER_ID)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_logistics_tracking, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Initialize MapLibre
        MapLibre.getInstance(requireContext())
        mapView = view.findViewById(R.id.mapView)
        mapView?.onCreate(savedInstanceState)
        mapView?.getMapAsync(this)

        // Setup UI components
        setupUI(view)
    }

    override fun onStart() {
        super.onStart()
        mapView?.onStart()
    }

    override fun onResume() {
        super.onResume()
        mapView?.onResume()
        startPolling()
    }

    override fun onPause() {
        super.onPause()
        mapView?.onPause()
        stopPolling()
    }

    override fun onStop() {
        super.onStop()
        mapView?.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        mapView?.onSaveInstanceState(outState)
    }

    override fun onLowMemory() {
        super.onLowMemory()
        mapView?.onLowMemory()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        stopPolling()
        symbolManager?.onDestroy()
        mapView?.onDestroy()
    }

    // ============================================
    // MAP INITIALIZATION
    // ============================================

    override fun onMapReady(map: MapLibreMap) {
        mapLibreMap = map

        val styleUrl = "https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=$GEOAPIFY_API_KEY"

        map.setStyle(Style.Builder().fromUri(styleUrl)) { style ->
            isMapReady = true

            // Disable rotation / tilt
            map.uiSettings.isRotateGesturesEnabled = false
            map.uiSettings.isTiltGesturesEnabled = false

            // Create symbol manager for markers
            mapView?.let { mv ->
                symbolManager = SymbolManager(mv, map, style)
                symbolManager?.iconAllowOverlap = true
            }

            // If we already have tracking data, render it
            trackingData?.let { renderTracking(it) }
        }

        Log.d(TAG, "MapLibre map is ready")
    }

    // ============================================
    // UI SETUP
    // ============================================

    private fun setupUI(view: View) {
        // Initialize views (assuming layout has these IDs)
        // statusTextView = view.findViewById(R.id.statusTextView)
        // etaTextView = view.findViewById(R.id.etaTextView)
        // distanceTextView = view.findViewById(R.id.distanceTextView)
        // etc.
    }

    // ============================================
    // POLLING LOGIC
    // ============================================

    private fun startPolling() {
        if (isPolling || orderId == null) return

        isPolling = true

        pollingRunnable = object : Runnable {
            override fun run() {
                if (!isPolling) return

                fetchTracking()

                mainHandler.postDelayed(this, POLLING_INTERVAL_MS)
            }
        }

        // Start immediately
        mainHandler.post(pollingRunnable!!)

        Log.d(TAG, "Polling started for order: $orderId")
    }

    private fun stopPolling() {
        isPolling = false
        pollingRunnable?.let { mainHandler.removeCallbacks(it) }
        pollingRunnable = null

        Log.d(TAG, "Polling stopped")
    }

    // ============================================
    // API CALLS
    // ============================================

    private fun fetchTracking() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val tracking = fetchTrackingFromAPI()

                withContext(Dispatchers.Main) {
                    tracking?.let {
                        handleTrackingUpdate(it)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching tracking: ${e.message}")
                withContext(Dispatchers.Main) {
                    onError?.invoke(e.message ?: "Unknown error")
                }
            }
        }
    }

    private suspend fun fetchTrackingFromAPI(): TrackingData? {
        val apiUrl = "${getApiBaseUrl()}/logistics/tracking/$orderId"

        val url = URL(apiUrl)
        val connection = url.openConnection() as HttpURLConnection

        return try {
            connection.apply {
                requestMethod = "GET"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer ${getAuthToken()}")
                connectTimeout = 10000
                readTimeout = 10000
            }

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().readText()
                parseTrackingResponse(response)
            } else {
                null
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseTrackingResponse(json: String): TrackingData? {
        return try {
            val jsonObj = JSONObject(json)
            if (!jsonObj.getBoolean("success")) return null

            val tracking = jsonObj.getJSONObject("tracking")

            val driverLoc = tracking.getJSONObject("driverLocation")
            val farmerLoc = tracking.getJSONObject("farmerLocation")
            val consumerLoc = tracking.getJSONObject("consumerLocation")
            val distance = tracking.getJSONObject("distance")
            val eta = tracking.getJSONObject("eta")

            val driverJson = tracking.optJSONObject("driver")

            TrackingData(
                orderId = tracking.getString("orderId"),
                currentState = tracking.getString("currentState"),
                stateMessage = tracking.getString("stateMessage"),
                markerColor = tracking.getString("markerColor"),
                driverLocation = Coordinate(
                    driverLoc.getDouble("lat"),
                    driverLoc.getDouble("lng")
                ),
                farmerLocation = LocationInfo(
                    farmerLoc.getString("address"),
                    Coordinate(
                        farmerLoc.getJSONObject("coordinates").getDouble("lat"),
                        farmerLoc.getJSONObject("coordinates").getDouble("lng")
                    )
                ),
                consumerLocation = LocationInfo(
                    consumerLoc.getString("address"),
                    Coordinate(
                        consumerLoc.getJSONObject("coordinates").getDouble("lat"),
                        consumerLoc.getJSONObject("coordinates").getDouble("lng")
                    )
                ),
                routePolyline = tracking.optString("routePolyline", null),
                distance = DistanceInfo(
                    distance.getString("total"),
                    distance.getString("remaining"),
                    distance.getInt("remainingMeters")
                ),
                eta = EtaInfo(
                    eta.optString("arrival", null),
                    eta.getInt("seconds"),
                    eta.getString("text")
                ),
                driver = driverJson?.let {
                    DriverInfo(
                        it.getString("name"),
                        it.getString("phone"),
                        it.optString("vehicleNumber", "N/A")
                    )
                },
                isActive = tracking.getBoolean("isActive"),
                progressPercentage = tracking.optJSONObject("routeProgress")
                    ?.getInt("percentComplete") ?: 0
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing tracking response: ${e.message}")
            null
        }
    }

    // ============================================
    // TRACKING UPDATE HANDLER
    // ============================================

    private fun handleTrackingUpdate(data: TrackingData) {
        val previousState = currentState

        // Update state
        currentState = LogisticsState.values().find { it.name == data.currentState }
            ?: LogisticsState.ORDER_CONFIRMED

        // Notify state change
        if (previousState != currentState) {
            onStateChanged?.invoke(previousState, currentState)

            if (currentState == LogisticsState.DELIVERED) {
                onDelivered?.invoke()
                stopPolling()
            }
        }

        // Store tracking data
        trackingData = data

        // Update UI
        updateUI(data)

        // Render on map if ready
        if (isMapReady) {
            renderTracking(data)
        }
    }

    private fun updateUI(data: TrackingData) {
        view?.let { view ->
            // Update status text
            // statusTextView?.text = data.stateMessage

            // Update ETA
            // etaTextView?.text = "ETA: ${data.eta.text}"

            // Update distance
            // distanceTextView?.text = "Distance: ${data.distance.remaining}"

            // Update progress
            // progressBar?.progress = data.progressPercentage

            // Update driver info
            // driverNameTextView?.text = data.driver?.name
        }
    }

    // ============================================
    // MAP RENDERING
    // ============================================

    private fun renderTracking(data: TrackingData) {
        val map = mapLibreMap ?: return

        // Render route polyline (GeoJSON source + LineLayer)
        renderRoute(data)

        // Render farmer marker
        renderFarmerMarker(data.farmerLocation)

        // Render consumer marker
        renderConsumerMarker(data.consumerLocation)

        // Render/animate driver marker
        renderDriverMarker(data)

        // Fit bounds on first render
        if (farmerSymbol != null && consumerSymbol != null && driverSymbol == null) {
            fitMapBounds()
        }
    }

    private fun renderFarmerMarker(location: LocationInfo) {
        val sm = symbolManager ?: return
        val position = LatLng(location.coordinates.lat, location.coordinates.lng)

        if (farmerSymbol == null) {
            farmerSymbol = sm.create(
                SymbolOptions()
                    .withLatLng(position)
                    .withTextField("🌾")
                    .withTextSize(22f)
                    .withTextOffset(arrayOf(0f, 0f))
            )
        } else {
            farmerSymbol?.latLng = position
            sm.update(farmerSymbol!!)
        }
    }

    private fun renderConsumerMarker(location: LocationInfo) {
        val sm = symbolManager ?: return
        val position = LatLng(location.coordinates.lat, location.coordinates.lng)

        if (consumerSymbol == null) {
            consumerSymbol = sm.create(
                SymbolOptions()
                    .withLatLng(position)
                    .withTextField("🏠")
                    .withTextSize(22f)
                    .withTextOffset(arrayOf(0f, 0f))
            )
        } else {
            consumerSymbol?.latLng = position
            sm.update(consumerSymbol!!)
        }
    }

    private fun renderDriverMarker(data: TrackingData) {
        val sm = symbolManager ?: return
        val newPosition = LatLng(data.driverLocation.lat, data.driverLocation.lng)

        if (driverSymbol == null) {
            driverSymbol = sm.create(
                SymbolOptions()
                    .withLatLng(newPosition)
                    .withTextField("🚚")
                    .withTextSize(22f)
                    .withTextOffset(arrayOf(0f, 0f))
            )
        } else {
            // Animate marker to new position
            animateSymbol(driverSymbol!!, newPosition)
        }
    }

    private fun renderRoute(data: TrackingData) {
        val map = mapLibreMap ?: return
        val style = map.style ?: return

        // Build coordinate list
        val coords: List<LatLng> = if (!data.routePolyline.isNullOrEmpty()) {
            decodePolyline(data.routePolyline)
        } else {
            listOf(
                LatLng(data.farmerLocation.coordinates.lat, data.farmerLocation.coordinates.lng),
                LatLng(data.consumerLocation.coordinates.lat, data.consumerLocation.coordinates.lng)
            )
        }

        // Build GeoJSON LineString
        val coordArray = JsonArray()
        for (c in coords) {
            val point = JsonArray()
            point.add(c.longitude)
            point.add(c.latitude)
            coordArray.add(point)
        }

        val geometry = JsonObject().apply {
            addProperty("type", "LineString")
            add("coordinates", coordArray)
        }
        val geojson = JsonObject().apply {
            addProperty("type", "Feature")
            add("geometry", geometry)
            add("properties", JsonObject())
        }

        val sourceId = "route-source"
        val layerId = "route-line"

        if (style.getSource(sourceId) != null) {
            (style.getSource(sourceId) as? GeoJsonSource)?.setGeoJson(geojson.toString())
        } else {
            val source = GeoJsonSource(sourceId, geojson.toString())
            style.addSource(source)
            routeSource = source

            val lineLayer = LineLayer(layerId, sourceId).apply {
                setProperties(
                    PropertyFactory.lineColor(Color.parseColor("#10B981")),
                    PropertyFactory.lineWidth(4f),
                    PropertyFactory.lineCap(org.maplibre.android.style.layers.Property.LINE_CAP_ROUND),
                    PropertyFactory.lineJoin(org.maplibre.android.style.layers.Property.LINE_JOIN_ROUND)
                )
            }
            style.addLayer(lineLayer)
        }
    }

    // ============================================
    // MARKER ANIMATION
    // ============================================

    private fun animateSymbol(symbol: Symbol, toPosition: LatLng) {
        val sm = symbolManager ?: return
        val fromPosition = symbol.latLng

        val animator = ValueAnimator.ofFloat(0f, 1f)
        animator.duration = ANIMATION_DURATION_MS
        animator.interpolator = LinearInterpolator()

        animator.addUpdateListener { animation ->
            val t = animation.animatedValue as Float
            val lat = fromPosition.latitude + (toPosition.latitude - fromPosition.latitude) * t
            val lng = fromPosition.longitude + (toPosition.longitude - fromPosition.longitude) * t
            symbol.latLng = LatLng(lat, lng)
            sm.update(symbol)
        }

        animator.start()
    }

    // ============================================
    // MAP UTILITIES
    // ============================================

    private fun fitMapBounds() {
        val map = mapLibreMap ?: return
        val farmer = farmerSymbol?.latLng ?: return
        val consumer = consumerSymbol?.latLng ?: return

        val bounds = LatLngBounds.Builder()
            .include(farmer)
            .include(consumer)
            .build()

        val padding = 100 // pixels
        map.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, padding))
    }

    // ============================================
    // POLYLINE DECODING
    // ============================================

    private fun decodePolyline(encoded: String): List<LatLng> {
        val poly = mutableListOf<LatLng>()
        var index = 0
        val len = encoded.length
        var lat = 0
        var lng = 0

        while (index < len) {
            var b: Int
            var shift = 0
            var result = 0

            do {
                b = encoded[index++].code - 63
                result = result or (b and 0x1f shl shift)
                shift += 5
            } while (b >= 0x20)

            val dlat = if (result and 1 != 0) (result shr 1).inv() else result shr 1
            lat += dlat

            shift = 0
            result = 0

            do {
                b = encoded[index++].code - 63
                result = result or (b and 0x1f shl shift)
                shift += 5
            } while (b >= 0x20)

            val dlng = if (result and 1 != 0) (result shr 1).inv() else result shr 1
            lng += dlng

            poly.add(LatLng(lat.toDouble() / 1e5, lng.toDouble() / 1e5))
        }

        return poly
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private fun getApiBaseUrl(): String {
        // Get from BuildConfig or environment
        return "http://10.0.2.2:5000/api" // Android emulator localhost
    }

    private fun getAuthToken(): String {
        // Get from secure storage
        return "" // Implement actual token retrieval
    }
}
