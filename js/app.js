/**
 * Main Application Logic
 * Created by: Ashish-suman-sharma
 * Created on: 2025-02-22 09:45:18
 * Updated on: 2025-04-19
 */

let map;
let mapHandler;
let weatherService;
let locationService;
let trafficService;
let autocomplete;
let navigationActive = false;
let directionsService;
let directionsRenderer;
let activeRouteMarkers = [];
let currentTravelMode = google.maps.TravelMode.DRIVING;

function initApp() {
  // Initialize services
  weatherService = new WeatherService("4fcc35193c1dc2049be0ab65a20f3d4e");
  locationService = new LocationService();
  mapHandler = new MapHandler();
  trafficService = new TrafficService();

  // Initialize Google Maps directions services
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: false,
    polylineOptions: {
      strokeColor: "#3498db",
      strokeWeight: 5,
      strokeOpacity: 0.7,
    },
  });

  // Setup search autocomplete
  setupSearchAutocomplete();

  // Setup event listeners
  document
    .getElementById("recenter-btn")
    .addEventListener("click", handleRecenter);
  document.getElementById("refreshBtn").addEventListener("click", refreshData);

  // Setup navigation event listeners
  document
    .getElementById("navigation-btn")
    .addEventListener("click", toggleNavigationPanel);
  document
    .getElementById("mapViewBtn")
    .addEventListener("click", () => toggleStreetView(false));
  document
    .getElementById("streetViewBtn")
    .addEventListener("click", () => toggleStreetView(true));
  document
    .getElementById("layers-btn")
    .addEventListener("click", toggleMapLayers);
  document
    .getElementById("calculateRouteBtn")
    .addEventListener("click", calculateRoute);
  document
    .getElementById("clearRouteBtn")
    .addEventListener("click", clearRoute);
  document
    .getElementById("startNavigationBtn")
    .addEventListener("click", startNavigation);

  // Setup route input autocompletes
  setupRouteAutocompletes();

  // Setup transportation options
  setupTransportationOptions();

  // Hide loader
  document.getElementById("loader").style.display = "none";

  // Get initial location
  locationService
    .getCurrentPosition()
    .then((position) => {
      mapHandler.initMap(position);
      // Set the map for the directions renderer
      directionsRenderer.setMap(mapHandler.map);
      updateWeatherInfo(position);
      updateTrafficInfo("Current Location", position); // Pass coordinates
    })
    .catch((error) => {
      console.error("Error getting location:", error);
      // Use default location
      const defaultPosition = { lat: 40.7128, lng: -74.006 };
      mapHandler.initMap(defaultPosition);
      // Set the map for the directions renderer
      directionsRenderer.setMap(mapHandler.map);
      updateWeatherInfo(defaultPosition);
      updateTrafficInfo("New York", defaultPosition); // Pass coordinates with name
    });
}

// Set up autocomplete for navigation inputs
function setupRouteAutocompletes() {
  const startInput = document.getElementById("startLocation");
  const endInput = document.getElementById("endLocation");

  if (startInput && endInput) {
    const startAutocomplete = new google.maps.places.Autocomplete(startInput, {
      types: ["geocode", "establishment"],
    });

    const endAutocomplete = new google.maps.places.Autocomplete(endInput, {
      types: ["geocode", "establishment"],
    });

    // Store autocomplete objects on the inputs for later access
    startInput.autocomplete = startAutocomplete;
    endInput.autocomplete = endAutocomplete;
  }
}

// A completely new function to handle navigation panel toggle
function toggleNavigationPanel() {
  const navigationSection = document.getElementById("navigationSection");
  const navButton = document.getElementById("navigation-btn");

  // Force display to block regardless of current state
  if (window.getComputedStyle(navigationSection).display === "none") {
    navigationSection.style.display = "block";
    navButton.classList.add("active");

    // Pre-fill the start location with "Current Location"
    const startInput = document.getElementById("startLocation");
    if (startInput && startInput.value === "") {
      startInput.value = "Current Location";
    }

    // Make sure autocomplete is set up for the inputs
    setupRouteAutocompletes();

    console.log("Navigation panel opened");
  } else {
    navigationSection.style.display = "none";
    navButton.classList.remove("active");
    console.log("Navigation panel closed");
  }
}

function toggleStreetView(showStreetView) {
  mapHandler.toggleStreetView(showStreetView);
}

function toggleMapLayers() {
  mapHandler.toggleMapLayers();
}

function calculateRoute() {
  const startInput = document.getElementById("startLocation");
  const endInput = document.getElementById("endLocation");

  if (!startInput || !endInput) {
    console.error("Route inputs not found");
    return;
  }

  // Show loading state
  document.getElementById("calculateRouteBtn").disabled = true;
  document.getElementById("calculateRouteBtn").innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Calculating...';

  // Determine start point (use current location if indicated)
  let start;
  if (
    startInput.value.trim() === "" ||
    startInput.value.toLowerCase() === "current location"
  ) {
    start = mapHandler.getMapCenter();
  } else {
    const startPlace = startInput.autocomplete
      ? startInput.autocomplete.getPlace()
      : null;
    if (startPlace && startPlace.geometry) {
      start = startPlace.geometry.location;
    } else {
      // Try geocoding the input text
      geocodeAddress(startInput.value)
        .then((location) => {
          if (location) {
            performRouteCalculation(location, null);
          } else {
            alert(
              "Could not find the start location. Please try a different address."
            );
            resetRouteButton();
          }
        })
        .catch(() => {
          alert(
            "Could not find the start location. Please try a different address."
          );
          resetRouteButton();
        });
      return;
    }
  }

  // Get end location
  if (endInput.value.trim() === "") {
    alert("Please enter a destination");
    resetRouteButton();
    return;
  }

  const endPlace = endInput.autocomplete
    ? endInput.autocomplete.getPlace()
    : null;
  let end;

  if (endPlace && endPlace.geometry) {
    end = endPlace.geometry.location;
    performRouteCalculation(start, end);
  } else {
    // Try geocoding the input text
    geocodeAddress(endInput.value)
      .then((location) => {
        if (location) {
          performRouteCalculation(start, location);
        } else {
          alert(
            "Could not find the destination. Please try a different address."
          );
          resetRouteButton();
        }
      })
      .catch(() => {
        alert(
          "Could not find the destination. Please try a different address."
        );
        resetRouteButton();
      });
  }
}

function performRouteCalculation(start, end) {
  if (!start || !end) {
    resetRouteButton();
    return;
  }

  const routeRequest = {
    origin: start,
    destination: end,
    travelMode: currentTravelMode,
    drivingOptions: {
      departureTime: new Date(),
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    },
    provideRouteAlternatives: true,
  };

  directionsRenderer.setMap(mapHandler.map);

  directionsService.route(routeRequest, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsRenderer.setDirections(result);
      displayRouteDetails(result);
      navigationActive = true;
    } else {
      alert("Could not calculate route: " + status);
    }
    resetRouteButton();
  });
}

function displayRouteDetails(routeResult) {
  const route = routeResult.routes[0];
  const leg = route.legs[0];

  // Show the route info section
  document.getElementById("routeInfo").style.display = "block";

  // Update route summary
  const summary = `From ${leg.start_address.split(",")[0]} to ${
    leg.end_address.split(",")[0]
  }`;
  document.getElementById("routeSummary").textContent = summary;

  // Update stats
  document.getElementById("totalDistance").textContent = leg.distance.text;
  document.getElementById("totalDuration").textContent = leg.duration_in_traffic
    ? leg.duration_in_traffic.text
    : leg.duration.text;

  // Determine traffic condition based on traffic vs normal duration ratio
  let trafficCondition = "Normal";
  let trafficColor = "#4CAF50";

  if (leg.duration_in_traffic && leg.duration) {
    const ratio = leg.duration_in_traffic.value / leg.duration.value;

    if (ratio < 1.1) {
      trafficCondition = "Low";
      trafficColor = "#4CAF50"; // Green
    } else if (ratio < 1.3) {
      trafficCondition = "Moderate";
      trafficColor = "#FFC107"; // Yellow
    } else if (ratio < 1.6) {
      trafficCondition = "High";
      trafficColor = "#FF9800"; // Orange
    } else {
      trafficCondition = "Severe";
      trafficColor = "#F44336"; // Red
    }
  }

  document.getElementById("trafficCondition").textContent = trafficCondition;
  document.getElementById("trafficCondition").style.color = trafficColor;

  // Build steps
  const stepsContainer = document.getElementById("directionsSteps");
  stepsContainer.innerHTML = "";

  leg.steps.forEach((step, index) => {
    // Remove HTML tags from instructions
    const instruction = step.instructions.replace(/<[^>]*>/g, "");

    const stepElement = document.createElement("div");
    stepElement.className = "direction-step";

    stepElement.innerHTML = `
      <div class="step-number">${index + 1}</div>
      <div class="step-instruction">${instruction}</div>
      <div class="step-distance">${step.distance.text}</div>
    `;

    stepsContainer.appendChild(stepElement);
  });
}

function resetRouteButton() {
  const button = document.getElementById("calculateRouteBtn");
  if (button) {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-directions"></i> Get Directions';
  }
}

function clearRoute() {
  // Hide route info
  document.getElementById("routeInfo").style.display = "none";

  // Clear directions renderer
  if (directionsRenderer) {
    directionsRenderer.setMap(null);
  }

  // Clear any route markers
  clearRouteMarkers();

  navigationActive = false;
}

function clearRouteMarkers() {
  // Clear any route-specific markers
  activeRouteMarkers.forEach((marker) => marker.setMap(null));
  activeRouteMarkers = [];
}

function startNavigation() {
  if (!navigationActive) {
    alert("Please calculate a route first");
    return;
  }

  // Create a more immersive navigation experience
  const map = mapHandler.map;
  if (map) {
    // Zoom in to the start of the route
    const route = directionsRenderer.getDirections().routes[0];
    const leg = route.legs[0];
    const firstStep = leg.steps[0];

    map.setZoom(16);
    map.panTo(firstStep.start_location);

    // Show navigation starting notification
    showNotification(
      "Navigation Started",
      "Follow the blue line on the map. Your first instruction is: " +
        firstStep.instructions.replace(/<[^>]*>/g, "")
    );

    // Update the button to indicate navigation is active
    const navButton = document.getElementById("startNavigationBtn");
    navButton.innerHTML = '<i class="fas fa-pause"></i> Pause';
    navButton.classList.add("active");

    // In a real app, this would initiate turn-by-turn voice guidance
    // For this demo we'll just simulate being at different points on the route
    simulateNavigation(route);
  }
}

// Simulate moving along the route
function simulateNavigation(route) {
  const leg = route.legs[0];
  let stepIndex = 0;
  let pointIndex = 0;

  // Extract all path points from the route for smooth movement
  const pathCoordinates = [];
  leg.steps.forEach((step) => {
    const points = google.maps.geometry.encoding.decodePath(
      step.polyline.points
    );
    pathCoordinates.push(...points);
  });

  // Create a vehicle marker that will move along the route
  const vehicleMarker = new google.maps.Marker({
    position: pathCoordinates[0],
    map: mapHandler.map,
    icon: {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 6,
      fillColor: "#3498db",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      rotation: 0, // Will be updated as the vehicle moves
    },
    title: "Your Vehicle",
  });

  activeRouteMarkers.push(vehicleMarker);

  // Simulate movement along the route
  const moveAlongRoute = setInterval(() => {
    if (pointIndex < pathCoordinates.length - 1) {
      pointIndex++;

      // Move the vehicle marker
      const position = pathCoordinates[pointIndex];
      vehicleMarker.setPosition(position);

      // Calculate heading between points for vehicle rotation
      if (pointIndex > 0) {
        const heading = google.maps.geometry.spherical.computeHeading(
          pathCoordinates[pointIndex - 1],
          pathCoordinates[pointIndex]
        );

        // Update marker icon rotation
        vehicleMarker.setIcon({
          ...vehicleMarker.getIcon(),
          rotation: heading,
        });
      }

      // Pan the map to follow the vehicle
      mapHandler.map.panTo(position);

      // Check if we've reached a new step in the directions
      if (pointIndex % 20 === 0 && stepIndex < leg.steps.length - 1) {
        stepIndex++;

        // Update the active step in the directions list
        updateActiveDirectionStep(stepIndex);

        // Show the next instruction
        const instruction = leg.steps[stepIndex].instructions.replace(
          /<[^>]*>/g,
          ""
        );
        showNotification("Next Direction", instruction);
      }

      // Update distance and ETA
      updateNavigationStatus(pointIndex, pathCoordinates.length, leg);
    } else {
      // Reached destination
      clearInterval(moveAlongRoute);
      showNotification(
        "Destination Reached",
        "You have arrived at your destination!"
      );

      // Reset navigation UI
      const navButton = document.getElementById("startNavigationBtn");
      navButton.innerHTML = '<i class="fas fa-play"></i> Start';
      navButton.classList.remove("active");
    }
  }, 300); // Move every 300ms for the simulation
}

function updateActiveDirectionStep(activeIndex) {
  const steps = document.querySelectorAll(".direction-step");

  steps.forEach((step, index) => {
    if (index === activeIndex) {
      step.classList.add("active-step");
      // Scroll this step into view
      step.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      step.classList.remove("active-step");
    }
  });
}

function updateNavigationStatus(currentPoint, totalPoints, leg) {
  // Calculate approximate progress
  const progress = currentPoint / totalPoints;
  const remainingDistance = Math.round(
    ((1 - progress) * leg.distance.value) / 1000
  ); // in km
  const remainingTime = Math.round(((1 - progress) * leg.duration.value) / 60); // in minutes

  // Update the UI with remaining distance and time
  document.getElementById("totalDistance").textContent =
    remainingDistance + " km";
  document.getElementById("totalDuration").textContent = remainingTime + " min";
}

function showNotification(title, message) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "map-notification fade-in";
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 5000);
}

// Geocoding function to convert address to coordinates
function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        resolve(results[0].geometry.location);
      } else {
        reject(new Error("Geocoding failed: " + status));
      }
    });
  });
}

function setupSearchAutocomplete() {
  const input = document.getElementById("search-input");
  const searchSuggestions = document.getElementById("search-suggestions");

  autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["geocode"],
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (place.geometry) {
      const position = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      mapHandler.updateMapCenter(position);
      updateWeatherInfo(position);
      updateTrafficInfo(place.name || place.formatted_address, position); // Pass coordinates with name
    }
  });
}

function handleRecenter() {
  locationService
    .getCurrentPosition()
    .then((position) => {
      mapHandler.updateMapCenter(position);
      updateWeatherInfo(position);
      updateTrafficInfo("Current Location", position); // Pass coordinates
    })
    .catch((error) => console.error("Error getting current location:", error));
}

async function updateWeatherInfo(position) {
  try {
    const weatherInfo = await weatherService.getCurrentWeather(
      position.lat,
      position.lng
    );
    const weatherElement = document.getElementById("weatherInfo");
    weatherElement.innerHTML = `
            <div class="weather-data fade-in">
                <div class="temperature">${weatherInfo.temperature}°C</div>
                <div class="description">${weatherInfo.description}</div>
                <div class="details">
                    <span><i class="fas fa-tint"></i> ${weatherInfo.humidity}%</span>
                    <span><i class="fas fa-wind"></i> ${weatherInfo.windSpeed} m/s</span>
                </div>
                <div class="location"><i class="fas fa-map-marker-alt"></i> ${weatherInfo.location}</div>
            </div>
        `;

    // Use the location name from weather data for traffic if available
    if (weatherInfo.location) {
      updateTrafficInfo(weatherInfo.location, position); // Pass coordinates with name
    }
  } catch (error) {
    console.error("Error updating weather:", error);
  }
}

async function updateTrafficInfo(locationName, coords) {
  try {
    // Show loading indicator
    const trafficElement = document.getElementById("trafficInfo");
    trafficElement.innerHTML = `<div class="loading-indicator"><i class="fas fa-sync fa-spin"></i> Loading traffic data...</div>`;

    // Immediately show simulated data while real data loads
    const simulatedData =
      trafficService.getSimulatedTrafficStatus(locationName);
    displayTrafficInfo(simulatedData, true);

    // Try to get real traffic data in the background
    trafficService
      .getTrafficStatus(locationName, coords)
      .then((realTrafficInfo) => {
        // Once real data is loaded, update the display
        displayTrafficInfo(realTrafficInfo, false);
      })
      .catch((error) => {
        console.error("Error getting real traffic data:", error);
        // Keep showing the simulated data that's already displayed
      });
  } catch (error) {
    console.error("Error updating traffic:", error);
    const trafficElement = document.getElementById("trafficInfo");
    trafficElement.innerHTML = `<div class="error-message">Error loading traffic data</div>`;
  }
}

// Helper function to display traffic information
function displayTrafficInfo(trafficInfo, isLoading) {
  const trafficElement = document.getElementById("trafficInfo");

  // Create HTML for nearby roads
  let nearbyRoadsHTML = "";
  trafficInfo.nearbyRoads.forEach((road) => {
    nearbyRoadsHTML += `
              <div class="nearby-road">
                  <span class="road-name">${road.name}</span>
                  <span class="road-distance">${road.distance}</span>
                  <span class="traffic-indicator" style="background-color: ${road.color};">${road.trafficLevel}</span>
              </div>
          `;
  });

  // Add indicator based on data source
  const dataSourceIndicator = trafficInfo.isSimulated
    ? `<div class="data-source"><i class="fas fa-info-circle"></i> Using simulated data${
        isLoading ? ", loading real data..." : ""
      }</div>`
    : `<div class="data-source"><i class="fas fa-info-circle"></i> Using real-time data</div>`;

  trafficElement.innerHTML = `
          <div class="traffic-data fade-in">
              <div class="traffic-status">
                  <span class="status-indicator" style="background-color: ${trafficInfo.congestionColor};"></span>
                  <span class="status-text">${trafficInfo.level} Traffic</span>
              </div>
              <div class="traffic-details">
                  <div class="detail-item">
                      <i class="fas fa-road"></i> 
                      <span>Road conditions: ${trafficInfo.condition}</span>
                  </div>
                  <div class="detail-item">
                      <i class="fas fa-clock"></i> 
                      <span>Est. travel time: ${trafficInfo.travelTime} min</span>
                  </div>
              </div>
              <div class="nearby-roads-title">Nearby roads:</div>
              <div class="nearby-roads">
                  ${nearbyRoadsHTML}
              </div>
              ${dataSourceIndicator}
          </div>
      `;
}

async function refreshData() {
  const currentCenter = mapHandler.getMapCenter();
  await updateWeatherInfo(currentCenter);
  await updateTrafficInfo("Current Location", currentCenter); // Explicitly refresh traffic with coords
}

// Setup transportation mode selection
function setupTransportationOptions() {
  const transportOptions = document.querySelectorAll(".transport-option");

  transportOptions.forEach((option) => {
    option.addEventListener("click", function () {
      // Remove active class from all options
      transportOptions.forEach((opt) => opt.classList.remove("active"));

      // Add active class to selected option
      this.classList.add("active");

      // Set current travel mode
      const mode = this.getAttribute("data-mode");
      currentTravelMode = google.maps.TravelMode[mode];

      // If we already have a route calculated, recalculate with new mode
      if (navigationActive && directionsRenderer.getDirections()) {
        calculateRoute();
      }
    });
  });
}

// Initialize when Google Maps API is loaded
window.initApp = initApp;

// Add error handling for Google Maps API loading
window.gm_authFailure = function () {
  console.error("Google Maps API authentication failed");
  alert("Google Maps API authentication failed. Please check your API key.");
};

// Add a function to reset the state
function resetApp() {
  document.getElementById("weatherInfo").innerHTML = "";
  document.getElementById("trafficInfo").innerHTML = "";
  mapHandler = null;
  weatherService = null;
  locationService = null;
  trafficService = null;
  autocomplete = null;
  directionsService = null;
  directionsRenderer = null;
  activeRouteMarkers = [];
  initApp();
}

// Add event listener for page refresh
window.addEventListener("load", initApp);
window.addEventListener("beforeunload", resetApp);
