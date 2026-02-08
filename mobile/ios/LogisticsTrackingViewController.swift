import UIKit
import MapLibre
import CoreLocation

/**
 * LogisticsTrackingViewController - iOS Implementation
 *
 * PURPOSE:
 * Real-time delivery tracking visualization for iOS using MapLibre Native + Geoapify tiles.
 * Shows farmer location, consumer location, driver movement, and route polyline.
 *
 * FEATURES:
 * - MapLibre map with Geoapify tiles
 * - Custom point annotations for farmer, consumer, and driver
 * - Animated driver movement along route
 * - State-based marker colors
 * - ETA countdown display
 * - Polling for real-time updates
 *
 * CRITICAL RULE:
 * All driver location updates come from the backend via polling.
 * NO client-side location computation or faking is allowed.
 *
 * USAGE:
 * let vc = LogisticsTrackingViewController(orderId: "order123")
 * navigationController?.pushViewController(vc, animated: true)
 *
 * BUILD SETUP:
 * Add MapLibre Native iOS via SPM or CocoaPods:
 *   SPM: https://github.com/maplibre/maplibre-gl-native-distribution
 *   Pod: pod 'MapLibre', '~> 6.0'
 */

// MARK: - Logistics State Machine

enum LogisticsState: String, CaseIterable {
    case orderConfirmed = "ORDER_CONFIRMED"
    case driverAssigned = "DRIVER_ASSIGNED"
    case pickupStarted = "PICKUP_STARTED"
    case pickupCompleted = "PICKUP_COMPLETED"
    case inTransit = "IN_TRANSIT"
    case nearDestination = "NEAR_DESTINATION"
    case delivered = "DELIVERED"
    
    var displayMessage: String {
        switch self {
        case .orderConfirmed: return "Order confirmed, waiting for driver"
        case .driverAssigned: return "Driver assigned to your order"
        case .pickupStarted: return "Driver heading to pickup location"
        case .pickupCompleted: return "Package collected, delivery starting"
        case .inTransit: return "Your order is on the way"
        case .nearDestination: return "Driver is nearby"
        case .delivered: return "Order delivered successfully"
        }
    }
    
    var markerColor: UIColor {
        switch self {
        case .orderConfirmed: return UIColor(hex: "#9CA3AF")
        case .driverAssigned: return UIColor(hex: "#3B82F6")
        case .pickupStarted: return UIColor(hex: "#F59E0B")
        case .pickupCompleted: return UIColor(hex: "#10B981")
        case .inTransit: return UIColor(hex: "#10B981")
        case .nearDestination: return UIColor(hex: "#8B5CF6")
        case .delivered: return UIColor(hex: "#059669")
        }
    }
    
    var nextAction: (state: LogisticsState, buttonText: String, buttonColor: UIColor)? {
        switch self {
        case .driverAssigned:
            return (.pickupStarted, "Start Pickup", UIColor(hex: "#F59E0B"))
        case .pickupStarted:
            return (.pickupCompleted, "Confirm Pickup", UIColor(hex: "#10B981"))
        case .pickupCompleted:
            return (.inTransit, "Start Delivery", UIColor(hex: "#10B981"))
        case .inTransit, .nearDestination:
            return (.delivered, "Mark Delivered", UIColor(hex: "#059669"))
        default:
            return nil
        }
    }
}

// MARK: - Data Models

struct Coordinate: Codable {
    let lat: Double
    let lng: Double
    
    var clLocation: CLLocationCoordinate2D {
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct LocationInfo: Codable {
    let address: String
    let coordinates: Coordinate
}

struct DriverInfo: Codable {
    let name: String
    let phone: String
    let vehicleNumber: String?
}

struct DistanceInfo: Codable {
    let total: String
    let remaining: String
    let remainingMeters: Int
}

struct EtaInfo: Codable {
    let arrival: String?
    let seconds: Int
    let text: String
}

struct RouteProgress: Codable {
    let currentIndex: Int
    let totalPoints: Int
    let percentComplete: Int
}

struct TrackingData: Codable {
    let orderId: String
    let currentState: String
    let stateMessage: String
    let markerColor: String
    let driverLocation: Coordinate
    let farmerLocation: LocationInfo
    let consumerLocation: LocationInfo
    let routePolyline: String?
    let distance: DistanceInfo
    let eta: EtaInfo
    let driver: DriverInfo?
    let isActive: Bool
    let routeProgress: RouteProgress?
    let deliveredAt: String?
}

struct TrackingResponse: Codable {
    let success: Bool
    let tracking: TrackingData?
    let message: String?
}

// MARK: - Delegate Protocol

protocol LogisticsTrackingDelegate: AnyObject {
    func trackingDidUpdateState(from previousState: LogisticsState, to newState: LogisticsState)
    func trackingDidComplete()
    func trackingDidEncounterError(_ error: Error)
}

// MARK: - View Controller

class LogisticsTrackingViewController: UIViewController, MLNMapViewDelegate {
    
    // MARK: - Configuration
    
    private static let pollingIntervalSeconds: TimeInterval = 5.0
    private static let animationDuration: TimeInterval = 0.5
    /// Set your Geoapify API key here or via Info.plist / env
    private static let geoapifyApiKey: String = {
        return Bundle.main.object(forInfoDictionaryKey: "GEOAPIFY_API_KEY") as? String ?? ""
    }()
    
    // MARK: - Properties
    
    private let orderId: String
    private var isDriverMode: Bool = false
    
    private var mapView: MLNMapView!
    private var farmerAnnotation: MLNPointAnnotation?
    private var consumerAnnotation: MLNPointAnnotation?
    private var driverAnnotation: MLNPointAnnotation?
    private var routeSource: MLNShapeSource?
    
    private var currentState: LogisticsState = .orderConfirmed
    private var trackingData: TrackingData?
    private var pollingTimer: Timer?
    private var isPolling = false
    
    weak var delegate: LogisticsTrackingDelegate?
    
    // MARK: - UI Components
    
    private lazy var statusCard: UIView = {
        let view = UIView()
        view.backgroundColor = .white
        view.layer.cornerRadius = 12
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOffset = CGSize(width: 0, height: 2)
        view.layer.shadowRadius = 8
        view.layer.shadowOpacity = 0.1
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var statusIndicator: UIView = {
        let view = UIView()
        view.layer.cornerRadius = 6
        view.backgroundColor = UIColor(hex: "#10B981")
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var statusLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        label.textColor = UIColor(hex: "#1F2937")
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var liveIndicator: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(hex: "#ECFDF5")
        view.layer.cornerRadius = 10
        view.translatesAutoresizingMaskIntoConstraints = false
        
        let dot = UIView()
        dot.backgroundColor = UIColor(hex: "#10B981")
        dot.layer.cornerRadius = 4
        dot.translatesAutoresizingMaskIntoConstraints = false
        
        let label = UILabel()
        label.text = "Live"
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.textColor = UIColor(hex: "#059669")
        label.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(dot)
        view.addSubview(label)
        
        NSLayoutConstraint.activate([
            dot.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            dot.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8),
            
            label.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 4),
            label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        return view
    }()
    
    private lazy var distanceLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 14)
        label.textColor = UIColor(hex: "#6B7280")
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var etaLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 14)
        label.textColor = UIColor(hex: "#6B7280")
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var progressView: UIProgressView = {
        let progress = UIProgressView(progressViewStyle: .default)
        progress.progressTintColor = UIColor(hex: "#10B981")
        progress.trackTintColor = UIColor(hex: "#E5E7EB")
        progress.layer.cornerRadius = 4
        progress.clipsToBounds = true
        progress.translatesAutoresizingMaskIntoConstraints = false
        return progress
    }()
    
    private lazy var driverCard: UIView = {
        let view = UIView()
        view.backgroundColor = .white
        view.layer.cornerRadius = 12
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOffset = CGSize(width: 0, height: 2)
        view.layer.shadowRadius = 8
        view.layer.shadowOpacity = 0.1
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()
    
    private lazy var driverAvatarView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(hex: "#10B981")
        view.layer.cornerRadius = 28
        view.translatesAutoresizingMaskIntoConstraints = false
        
        let label = UILabel()
        label.text = "🚚"
        label.font = .systemFont(ofSize: 28)
        label.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        return view
    }()
    
    private lazy var driverNameLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        label.textColor = UIColor(hex: "#1F2937")
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var vehicleLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 14)
        label.textColor = UIColor(hex: "#6B7280")
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var callButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("📞", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 24)
        button.backgroundColor = UIColor(hex: "#ECFDF5")
        button.layer.cornerRadius = 24
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(callDriver), for: .touchUpInside)
        return button
    }()
    
    private lazy var actionButton: UIButton = {
        let button = UIButton(type: .system)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 12
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(handleAction), for: .touchUpInside)
        button.isHidden = true
        return button
    }()
    
    private lazy var deliveredOverlay: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor.white.withAlphaComponent(0.95)
        view.isHidden = true
        view.translatesAutoresizingMaskIntoConstraints = false
        
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.alignment = .center
        stackView.spacing = 16
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        let emoji = UILabel()
        emoji.text = "✅"
        emoji.font = .systemFont(ofSize: 64)
        
        let title = UILabel()
        title.text = "Delivery Complete!"
        title.font = .systemFont(ofSize: 24, weight: .bold)
        title.textColor = UIColor(hex: "#047857")
        
        let subtitle = UILabel()
        subtitle.text = "Order delivered successfully"
        subtitle.font = .systemFont(ofSize: 14)
        subtitle.textColor = UIColor(hex: "#059669")
        
        stackView.addArrangedSubview(emoji)
        stackView.addArrangedSubview(title)
        stackView.addArrangedSubview(subtitle)
        
        view.addSubview(stackView)
        NSLayoutConstraint.activate([
            stackView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        return view
    }()
    
    // MARK: - Initialization
    
    init(orderId: String, isDriverMode: Bool = false) {
        self.orderId = orderId
        self.isDriverMode = isDriverMode
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupMapView()
        setupUI()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startPolling()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopPolling()
    }
    
    // MARK: - Setup
    
    private func setupMapView() {
        let styleURL = URL(string: "https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=\(Self.geoapifyApiKey)")!
        mapView = MLNMapView(frame: view.bounds, styleURL: styleURL)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        mapView.allowsRotating = false
        mapView.allowsTilting = false
        mapView.showsUserLocation = false
        
        view.addSubview(mapView)
    }
    
    private func setupUI() {
        // Status Card
        view.addSubview(statusCard)
        statusCard.addSubview(statusIndicator)
        statusCard.addSubview(statusLabel)
        statusCard.addSubview(liveIndicator)
        statusCard.addSubview(distanceLabel)
        statusCard.addSubview(etaLabel)
        statusCard.addSubview(progressView)
        
        // Driver Card
        view.addSubview(driverCard)
        driverCard.addSubview(driverAvatarView)
        driverCard.addSubview(driverNameLabel)
        driverCard.addSubview(vehicleLabel)
        driverCard.addSubview(callButton)
        
        // Action Button (Driver Mode)
        view.addSubview(actionButton)
        
        // Delivered Overlay
        view.addSubview(deliveredOverlay)
        
        NSLayoutConstraint.activate([
            // Status Card
            statusCard.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            statusCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            statusCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            statusIndicator.topAnchor.constraint(equalTo: statusCard.topAnchor, constant: 16),
            statusIndicator.leadingAnchor.constraint(equalTo: statusCard.leadingAnchor, constant: 16),
            statusIndicator.widthAnchor.constraint(equalToConstant: 12),
            statusIndicator.heightAnchor.constraint(equalToConstant: 12),
            
            statusLabel.centerYAnchor.constraint(equalTo: statusIndicator.centerYAnchor),
            statusLabel.leadingAnchor.constraint(equalTo: statusIndicator.trailingAnchor, constant: 12),
            statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: liveIndicator.leadingAnchor, constant: -8),
            
            liveIndicator.centerYAnchor.constraint(equalTo: statusIndicator.centerYAnchor),
            liveIndicator.trailingAnchor.constraint(equalTo: statusCard.trailingAnchor, constant: -16),
            liveIndicator.heightAnchor.constraint(equalToConstant: 20),
            
            distanceLabel.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 12),
            distanceLabel.leadingAnchor.constraint(equalTo: statusCard.leadingAnchor, constant: 16),
            
            etaLabel.centerYAnchor.constraint(equalTo: distanceLabel.centerYAnchor),
            etaLabel.leadingAnchor.constraint(equalTo: distanceLabel.trailingAnchor, constant: 16),
            
            progressView.centerYAnchor.constraint(equalTo: distanceLabel.centerYAnchor),
            progressView.trailingAnchor.constraint(equalTo: statusCard.trailingAnchor, constant: -16),
            progressView.widthAnchor.constraint(equalToConstant: 80),
            progressView.heightAnchor.constraint(equalToConstant: 8),
            
            distanceLabel.bottomAnchor.constraint(equalTo: statusCard.bottomAnchor, constant: -16),
            
            // Driver Card
            driverCard.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            driverCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            driverCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            driverAvatarView.topAnchor.constraint(equalTo: driverCard.topAnchor, constant: 16),
            driverAvatarView.leadingAnchor.constraint(equalTo: driverCard.leadingAnchor, constant: 16),
            driverAvatarView.bottomAnchor.constraint(equalTo: driverCard.bottomAnchor, constant: -16),
            driverAvatarView.widthAnchor.constraint(equalToConstant: 56),
            driverAvatarView.heightAnchor.constraint(equalToConstant: 56),
            
            driverNameLabel.topAnchor.constraint(equalTo: driverAvatarView.topAnchor, constant: 8),
            driverNameLabel.leadingAnchor.constraint(equalTo: driverAvatarView.trailingAnchor, constant: 16),
            
            vehicleLabel.topAnchor.constraint(equalTo: driverNameLabel.bottomAnchor, constant: 4),
            vehicleLabel.leadingAnchor.constraint(equalTo: driverNameLabel.leadingAnchor),
            
            callButton.centerYAnchor.constraint(equalTo: driverCard.centerYAnchor),
            callButton.trailingAnchor.constraint(equalTo: driverCard.trailingAnchor, constant: -16),
            callButton.widthAnchor.constraint(equalToConstant: 48),
            callButton.heightAnchor.constraint(equalToConstant: 48),
            
            // Action Button
            actionButton.bottomAnchor.constraint(equalTo: driverCard.topAnchor, constant: -16),
            actionButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            actionButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            actionButton.heightAnchor.constraint(equalToConstant: 56),
            
            // Delivered Overlay
            deliveredOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            deliveredOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            deliveredOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            deliveredOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    // MARK: - Polling
    
    private func startPolling() {
        guard !isPolling else { return }
        isPolling = true
        
        // Fetch immediately
        fetchTracking()
        
        // Start timer
        pollingTimer = Timer.scheduledTimer(withTimeInterval: Self.pollingIntervalSeconds, repeats: true) { [weak self] _ in
            self?.fetchTracking()
        }
    }
    
    private func stopPolling() {
        isPolling = false
        pollingTimer?.invalidate()
        pollingTimer = nil
    }
    
    // MARK: - API
    
    private func fetchTracking() {
        let urlString = "\(getApiBaseUrl())/logistics/tracking/\(orderId)"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(getAuthToken())", forHTTPHeaderField: "Authorization")
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                DispatchQueue.main.async {
                    self.delegate?.trackingDidEncounterError(error)
                }
                return
            }
            
            guard let data = data else { return }
            
            do {
                let response = try JSONDecoder().decode(TrackingResponse.self, from: data)
                if let tracking = response.tracking {
                    DispatchQueue.main.async {
                        self.handleTrackingUpdate(tracking)
                    }
                }
            } catch {
                print("Error parsing tracking: \(error)")
            }
        }.resume()
    }
    
    // MARK: - Tracking Update Handler
    
    private func handleTrackingUpdate(_ data: TrackingData) {
        let previousState = currentState
        
        // Update state
        if let newState = LogisticsState(rawValue: data.currentState) {
            currentState = newState
            
            // Notify delegate on state change
            if previousState != newState {
                delegate?.trackingDidUpdateState(from: previousState, to: newState)
                
                if newState == .delivered {
                    delegate?.trackingDidComplete()
                    stopPolling()
                    showDeliveredOverlay()
                }
            }
        }
        
        // Store data
        trackingData = data
        
        // Update UI
        updateUI(with: data)
        
        // Render map
        renderTracking(data)
    }
    
    private func updateUI(with data: TrackingData) {
        // Status
        statusLabel.text = data.stateMessage
        statusIndicator.backgroundColor = UIColor(hex: data.markerColor)
        
        // Distance & ETA
        distanceLabel.text = "📏 \(data.distance.remaining)"
        etaLabel.text = "⏱️ \(data.eta.text)"
        
        // Progress
        let progress = Float(data.routeProgress?.percentComplete ?? 0) / 100.0
        progressView.setProgress(progress, animated: true)
        
        // Driver info
        if let driver = data.driver {
            driverCard.isHidden = false
            driverNameLabel.text = driver.name
            vehicleLabel.text = driver.vehicleNumber ?? "N/A"
            driverAvatarView.backgroundColor = UIColor(hex: data.markerColor)
        }
        
        // Action button (driver mode)
        if isDriverMode, let action = currentState.nextAction {
            actionButton.isHidden = false
            actionButton.setTitle(action.buttonText, for: .normal)
            actionButton.backgroundColor = action.buttonColor
        } else {
            actionButton.isHidden = true
        }
        
        // Live indicator visibility
        liveIndicator.isHidden = !data.isActive
    }
    
    // MARK: - Map Rendering
    
    private func renderTracking(_ data: TrackingData) {
        // Farmer marker
        renderFarmerMarker(data.farmerLocation)
        
        // Consumer marker
        renderConsumerMarker(data.consumerLocation)
        
        // Route polyline
        renderRoute(data)
        
        // Driver marker
        renderDriverMarker(data)
        
        // Fit bounds on first render
        if farmerAnnotation != nil && consumerAnnotation != nil && driverAnnotation == nil {
            fitMapBounds()
        }
    }
    
    private func renderFarmerMarker(_ location: LocationInfo) {
        let position = location.coordinates.clLocation
        
        if farmerAnnotation == nil {
            let annotation = MLNPointAnnotation()
            annotation.coordinate = position
            annotation.title = "Pickup"
            annotation.subtitle = location.address
            farmerAnnotation = annotation
            mapView.addAnnotation(annotation)
        } else {
            farmerAnnotation?.coordinate = position
        }
    }
    
    private func renderConsumerMarker(_ location: LocationInfo) {
        let position = location.coordinates.clLocation
        
        if consumerAnnotation == nil {
            let annotation = MLNPointAnnotation()
            annotation.coordinate = position
            annotation.title = "Delivery"
            annotation.subtitle = location.address
            consumerAnnotation = annotation
            mapView.addAnnotation(annotation)
        } else {
            consumerAnnotation?.coordinate = position
        }
    }
    
    private func renderDriverMarker(_ data: TrackingData) {
        let newPosition = data.driverLocation.clLocation
        
        if driverAnnotation == nil {
            let annotation = MLNPointAnnotation()
            annotation.coordinate = newPosition
            annotation.title = "Driver"
            driverAnnotation = annotation
            mapView.addAnnotation(annotation)
        } else {
            // Animate to new position
            UIView.animate(withDuration: Self.animationDuration) {
                self.driverAnnotation?.coordinate = newPosition
            }
        }
    }
    
    private func renderRoute(_ data: TrackingData) {
        // Remove existing route layer & source
        if let style = mapView.style {
            if let layer = style.layer(withIdentifier: "route-line") {
                style.removeLayer(layer)
            }
            if let source = style.source(withIdentifier: "route-source") {
                style.removeSource(source)
            }
        }
        
        var coordinates: [CLLocationCoordinate2D]
        
        if let polyline = data.routePolyline, !polyline.isEmpty {
            coordinates = decodePolyline(polyline)
        } else {
            // Fallback: straight line
            coordinates = [
                data.farmerLocation.coordinates.clLocation,
                data.consumerLocation.coordinates.clLocation
            ]
        }
        
        guard coordinates.count >= 2, let style = mapView.style else { return }
        
        let polyline = MLNPolyline(coordinates: &coordinates, count: UInt(coordinates.count))
        let source = MLNShapeSource(identifier: "route-source", shape: polyline, options: nil)
        style.addSource(source)
        routeSource = source
        
        let layer = MLNLineStyleLayer(identifier: "route-line", source: source)
        layer.lineColor = NSExpression(forConstantValue: UIColor(hex: "#10B981"))
        layer.lineWidth = NSExpression(forConstantValue: 4)
        layer.lineCap = NSExpression(forConstantValue: "round")
        layer.lineJoin = NSExpression(forConstantValue: "round")
        style.addLayer(layer)
    }
    
    // MARK: - MLNMapViewDelegate
    
    func mapView(_ mapView: MLNMapView, viewFor annotation: MLNAnnotation) -> MLNAnnotationView? {
        // Return nil to use default pin; for custom images use MLNAnnotationView subclass
        return nil
    }
    
    func mapView(_ mapView: MLNMapView, annotationCanShowCallout annotation: MLNAnnotation) -> Bool {
        return true
    }
    
    // MARK: - Map Utilities
    
    private func fitMapBounds() {
        guard let farmer = farmerAnnotation?.coordinate,
              let consumer = consumerAnnotation?.coordinate else { return }
        
        let bounds = MLNCoordinateBounds(
            sw: CLLocationCoordinate2D(
                latitude: min(farmer.latitude, consumer.latitude),
                longitude: min(farmer.longitude, consumer.longitude)
            ),
            ne: CLLocationCoordinate2D(
                latitude: max(farmer.latitude, consumer.latitude),
                longitude: max(farmer.longitude, consumer.longitude)
            )
        )
        
        let camera = mapView.cameraThatFitsCoordinateBounds(bounds, edgePadding: UIEdgeInsets(top: 100, left: 60, bottom: 100, right: 60))
        mapView.setCamera(camera, animated: true)
    }
    
    // MARK: - Actions
    
    @objc private func callDriver() {
        guard let phone = trackingData?.driver?.phone,
              let url = URL(string: "tel://\(phone)") else { return }
        UIApplication.shared.open(url)
    }
    
    @objc private func handleAction() {
        guard let action = currentState.nextAction else { return }
        updateState(to: action.state)
    }
    
    private func updateState(to newState: LogisticsState) {
        // API call to update state
        let urlString = "\(getApiBaseUrl())/logistics/tracking/\(orderId)/state"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(getAuthToken())", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = ["state": newState.rawValue]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { [weak self] _, _, error in
            if let error = error {
                DispatchQueue.main.async {
                    self?.delegate?.trackingDidEncounterError(error)
                }
            }
        }.resume()
    }
    
    private func showDeliveredOverlay() {
        deliveredOverlay.isHidden = false
        UIView.animate(withDuration: 0.3) {
            self.deliveredOverlay.alpha = 1
        }
    }
    
    // MARK: - Helpers
    
    /// Decode a Google-compatible encoded polyline string into coordinates
    private func decodePolyline(_ encoded: String) -> [CLLocationCoordinate2D] {
        var coordinates: [CLLocationCoordinate2D] = []
        let chars = Array(encoded.utf8)
        var index = 0
        var lat: Int = 0
        var lng: Int = 0
        
        while index < chars.count {
            var result = 0
            var shift = 0
            var b: Int
            repeat {
                b = Int(chars[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
            } while b >= 0x20
            let dlat = (result & 1) != 0 ? ~(result >> 1) : (result >> 1)
            lat += dlat
            
            result = 0
            shift = 0
            repeat {
                b = Int(chars[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
            } while b >= 0x20
            let dlng = (result & 1) != 0 ? ~(result >> 1) : (result >> 1)
            lng += dlng
            
            coordinates.append(CLLocationCoordinate2D(latitude: Double(lat) / 1e5, longitude: Double(lng) / 1e5))
        }
        
        return coordinates
    }
    
    private func getApiBaseUrl() -> String {
        // Get from configuration
        return "http://localhost:5000/api"
    }
    
    private func getAuthToken() -> String {
        // Get from secure storage
        return ""
    }
}

// MARK: - UIColor Extension

extension UIColor {
    convenience init(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        
        if hexString.hasPrefix("#") {
            hexString.remove(at: hexString.startIndex)
        }
        
        var rgbValue: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgbValue)
        
        self.init(
            red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
            alpha: 1.0
        )
    }
}
