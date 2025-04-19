/**
 * Map Handler
 * Created by: Ashish-suman-sharma
 * Created on: 2025-02-22 09:45:18
 * Updated by: GitHub Copilot
 * Updated on: 2025-04-19
 */

class MapHandler {
  constructor() {
    this.map = null;
    this.markers = [];
    this.trafficLayer = null;
    this.streetViewPanorama = null;
    this.directionsRenderer = null;
    this.routePolyline = null;
    this.currentInfoWindow = null;
    this.activeRouteMarkers = [];
    this.isStreetViewActive = false;
  }

  initMap(position) {
    this.map = new google.maps.Map(document.getElementById("map"), {
      center: position,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: this.getMapStyles(),
    });

    // Initialize Street View panorama
    this.streetViewPanorama = new google.maps.StreetViewPanorama(
      document.getElementById("map"),
      {
        position: position,
        pov: {
          heading: 0,
          pitch: 0,
        },
        visible: false,
        zoomControl: true,
        fullscreenControl: true,
      }
    );

    this.map.setStreetView(this.streetViewPanorama);

    // Add traffic layer
    this.trafficLayer = new google.maps.TrafficLayer();
    this.trafficLayer.setMap(this.map);

    // Add marker for current location
    this.updateMarker(position);

    // Setup event listeners for map controls
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Street view toggle
    document
      .getElementById("mapViewBtn")
      .addEventListener("click", () => this.toggleStreetView(false));
    document
      .getElementById("streetViewBtn")
      .addEventListener("click", () => this.toggleStreetView(true));

    // Navigation button
    document
      .getElementById("navigation-btn")
      .addEventListener("click", () => this.toggleNavigationPanel());

    // Layers button
    document
      .getElementById("layers-btn")
      .addEventListener("click", () => this.toggleMapLayers());

    // Calculate route button
    document
      .getElementById("calculateRouteBtn")
      .addEventListener("click", () => this.calculateRoute());

    // Clear route button
    document
      .getElementById("clearRouteBtn")
      .addEventListener("click", () => this.clearRoute());

    // Start navigation button
    document
      .getElementById("startNavigationBtn")
      .addEventListener("click", () => this.startNavigation());
  }

  toggleStreetView(showStreetView) {
    if (!this.map || !this.streetViewPanorama) return;

    const mapBtn = document.getElementById("mapViewBtn");
    const streetBtn = document.getElementById("streetViewBtn");

    if (showStreetView) {
      // Check if Street View is available at current position
      const streetViewService = new google.maps.StreetViewService();
      const position = this.map.getCenter();

      streetViewService.getPanorama(
        { location: position, radius: 50 },
        (data, status) => {
          if (status === google.maps.StreetViewStatus.OK) {
            // Street View is available
            this.streetViewPanorama.setPosition(position);
            this.streetViewPanorama.setVisible(true);
            this.isStreetViewActive = true;

            // Update button states
            mapBtn.classList.remove("active");
            streetBtn.classList.add("active");
          } else {
            // Street View is not available
            alert("Street View is not available at this location.");
          }
        }
      );
    } else {
      // Switch back to map view
      this.streetViewPanorama.setVisible(false);
      this.isStreetViewActive = false;

      // Update button states
      mapBtn.classList.add("active");
      streetBtn.classList.remove("active");
    }
  }

  toggleNavigationPanel() {
    const navigationSection = document.getElementById("navigationSection");
    const navButton = document.getElementById("navigation-btn");

    if (navigationSection.style.display === "none") {
      navigationSection.style.display = "block";
      navButton.classList.add("active");

      // Set up location autocompletes
      this.setupLocationAutocompletes();
    } else {
      navigationSection.style.display = "none";
      navButton.classList.remove("active");
    }
  }

  setupLocationAutocompletes() {
    // Setup autocomplete for start location
    const startInput = document.getElementById("startLocation");
    const startAutocomplete = new google.maps.places.Autocomplete(startInput);

    // Setup autocomplete for end location
    const endInput = document.getElementById("endLocation");
    const endAutocomplete = new google.maps.places.Autocomplete(endInput);
  }

  toggleMapLayers() {
    // Toggle traffic layer
    if (this.trafficLayer) {
      if (this.trafficLayer.getMap()) {
        this.trafficLayer.setMap(null);
        document.getElementById("layers-btn").classList.remove("active");
      } else {
        this.trafficLayer.setMap(this.map);
        document.getElementById("layers-btn").classList.add("active");
      }
    }
  }

  calculateRoute() {
    const startInput = document.getElementById("startLocation");
    const endInput = document.getElementById("endLocation");

    // Get start location (use current position if empty)
    let start;
    if (startInput.value.trim() === "") {
      start = this.map.getCenter();
    } else {
      // Try to get from autocomplete
      const startPlace = this.getPlaceFromAutocomplete(startInput);
      if (startPlace && startPlace.geometry) {
        start = startPlace.geometry.location;
      } else {
        alert("Please enter a valid start location");
        return;
      }
    }

    // Get end location
    if (endInput.value.trim() === "") {
      alert("Please enter a destination");
      return;
    }

    const endPlace = this.getPlaceFromAutocomplete(endInput);
    let end;

    if (endPlace && endPlace.geometry) {
      end = endPlace.geometry.location;
    } else {
      alert("Please enter a valid destination");
      return;
    }

    // Show loading state
    document.getElementById("calculateRouteBtn").disabled = true;
    document.getElementById("calculateRouteBtn").innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Calculating...';

    // Use the traffic service to calculate route
    const trafficService = new TrafficService();

    trafficService
      .calculateRoute(start, end, this.map)
      .then((routeInfo) => {
        // Display route info
        this.displayRouteInfo(routeInfo);

        // Reset button
        document.getElementById("calculateRouteBtn").disabled = false;
        document.getElementById("calculateRouteBtn").innerHTML =
          '<i class="fas fa-directions"></i> Get Directions';
      })
      .catch((error) => {
        console.error("Error calculating route:", error);
        alert("Error calculating route. Please try again.");

        // Reset button
        document.getElementById("calculateRouteBtn").disabled = false;
        document.getElementById("calculateRouteBtn").innerHTML =
          '<i class="fas fa-directions"></i> Get Directions';
      });
  }

  getPlaceFromAutocomplete(input) {
    // Try to get place from autocomplete
    if (input.autocomplete && input.autocomplete.getPlace()) {
      return input.autocomplete.getPlace();
    }

    // If not available, return null
    return null;
  }

  displayRouteInfo(routeInfo) {
    // Show the route info section
    document.getElementById("routeInfo").style.display = "block";

    // Update route summary
    document.getElementById("routeSummary").textContent = routeInfo.summary;

    // Update stats
    document.getElementById("totalDistance").textContent =
      routeInfo.distanceText;
    document.getElementById("totalDuration").textContent =
      routeInfo.durationText;
    document.getElementById("trafficCondition").textContent =
      routeInfo.trafficCondition;
    document.getElementById("trafficCondition").style.color =
      routeInfo.trafficColor;

    // Build steps
    const stepsContainer = document.getElementById("directionsSteps");
    stepsContainer.innerHTML = "";

    routeInfo.steps.forEach((step) => {
      const stepElement = document.createElement("div");
      stepElement.className = "direction-step";

      stepElement.innerHTML = `
                <div class="step-number">${step.index}</div>
                <div class="step-instruction">${step.instruction}</div>
                <div class="step-distance">${step.distance}</div>
            `;

      stepsContainer.appendChild(stepElement);
    });
  }

  clearRoute() {
    // Hide route info
    document.getElementById("routeInfo").style.display = "none";

    // Clear directions renderer
    const trafficService = new TrafficService();
    trafficService.clearRoute(this.map);

    // Clear any route markers
    this.clearRouteMarkers();
  }

  clearRouteMarkers() {
    // Clear any route-specific markers
    this.activeRouteMarkers.forEach((marker) => marker.setMap(null));
    this.activeRouteMarkers = [];

    // Close any open info windows
    if (this.currentInfoWindow) {
      this.currentInfoWindow.close();
      this.currentInfoWindow = null;
    }
  }

  startNavigation() {
    // In a real app, this would start turn-by-turn navigation
    // For this demo, we'll just zoom in on the route
    if (this.map) {
      this.map.setZoom(15);
      // Maybe implement a simulated navigation experience
      alert("Navigation started! Follow the blue route line on the map.");
    }
  }

  updateMapCenter(position) {
    if (this.map) {
      this.map.panTo(position);
      this.updateMarker(position);

      // If street view is active, update its position too
      if (this.isStreetViewActive && this.streetViewPanorama) {
        this.streetViewPanorama.setPosition(position);
      }
    }
  }

  updateMarker(position) {
    // Clear existing markers
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];

    // Add new marker that is draggable
    const marker = new google.maps.Marker({
      position: position,
      map: this.map,
      animation: google.maps.Animation.DROP,
      draggable: true, // Make the marker draggable
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#3498db",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    });

    this.markers.push(marker);

    // Add info window to the marker with dragging instructions
    const infoContent = `
            <div class="marker-info">
                <h3>Current Location</h3>
                <p>Lat: ${position.lat.toFixed(6)}</p>
                <p>Lng: ${position.lng.toFixed(6)}</p>
                <p class="drag-hint"><i class="fas fa-arrows-alt"></i> Drag this marker to any location</p>
            </div>
        `;

    const infoWindow = new google.maps.InfoWindow({
      content: infoContent,
    });

    // Show info window when marker is clicked
    marker.addListener("click", () => {
      // Close previous info window if one is open
      if (this.currentInfoWindow) {
        this.currentInfoWindow.close();
      }

      infoWindow.open(this.map, marker);
      this.currentInfoWindow = infoWindow;
    });

    // Update info window content while dragging
    marker.addListener("drag", () => {
      const newPosition = marker.getPosition();

      // Update info window content if it's open
      if (this.currentInfoWindow === infoWindow && infoWindow.getMap()) {
        infoWindow.setContent(`
                    <div class="marker-info">
                        <h3>New Location</h3>
                        <p>Lat: ${newPosition.lat().toFixed(6)}</p>
                        <p>Lng: ${newPosition.lng().toFixed(6)}</p>
                        <p class="drag-hint"><i class="fas fa-arrows-alt"></i> Release to set this location</p>
                    </div>
                `);
      }
    });

    // When marker drag ends, update info and reload data for new location
    marker.addListener("dragend", () => {
      const newPosition = marker.getPosition();
      const newPositionObj = {
        lat: newPosition.lat(),
        lng: newPosition.lng(),
      };

      // Update info window content
      if (this.currentInfoWindow === infoWindow && infoWindow.getMap()) {
        infoWindow.setContent(`
                    <div class="marker-info">
                        <h3>Updated Location</h3>
                        <p>Lat: ${newPositionObj.lat.toFixed(6)}</p>
                        <p>Lng: ${newPositionObj.lng.toFixed(6)}</p>
                        <p class="drag-hint"><i class="fas fa-check"></i> Location updated</p>
                    </div>
                `);
      }

      // Get address for new location
      this.getAddressFromCoordinates(newPositionObj)
        .then((address) => {
          // Update location in navigation inputs if navigation panel is open
          const startInput = document.getElementById("startLocation");
          if (startInput && startInput.value === "Current Location") {
            startInput.value = address || "Custom Location";
          }

          // Update weather and traffic info for the new location
          if (typeof updateWeatherInfo === "function") {
            updateWeatherInfo(newPositionObj);
          }

          if (typeof updateTrafficInfo === "function") {
            updateTrafficInfo(address || "Custom Location", newPositionObj);
          }

          // Show notification
          this.showLocationUpdateNotification(address || "Custom Location");
        })
        .catch((error) => {
          console.error("Error getting address:", error);
        });
    });
  }

  // Helper method to get address from coordinates using Google's Geocoder
  getAddressFromCoordinates(position) {
    return new Promise((resolve, reject) => {
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ location: position }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          reject(new Error("Geocoding failed: " + status));
        }
      });
    });
  }

  // Show a notification when location is updated
  showLocationUpdateNotification(locationName) {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = "map-notification fade-in";
    notification.innerHTML = `
            <div class="notification-title">Location Updated</div>
            <div class="notification-message">Now showing data for ${locationName}</div>
        `;

    // Add to document
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 3000);
  }

  getMapCenter() {
    if (this.map) {
      const center = this.map.getCenter();
      return {
        lat: center.lat(),
        lng: center.lng(),
      };
    }
    return null;
  }

  getMapStyles() {
    return [
      {
        featureType: "all",
        elementType: "labels.text.fill",
        stylers: [{ color: "#2c3e50" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#ffffff" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#f1c40f" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#3498db" }],
      },
      {
        featureType: "poi",
        elementType: "geometry",
        stylers: [{ color: "#2ecc71" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#9b59b6" }],
      },
    ];
  }
}
