/**
 * Traffic Service
 * Created by: GitHub Copilot
 * Updated on: 2025-04-19
 */

class TrafficService {
  constructor() {
    this.trafficLevels = ["Low", "Moderate", "High", "Severe"];
    this.roadConditions = [
      "Clear",
      "Wet",
      "Construction",
      "Accident",
      "Roadwork",
    ];
    this.trafficLayer = null;
    this.directionsService = null;
    this.directionsRenderer = null;
    this.cachedResults = new Map();
    this.travelTimes = {
      Low: { min: 5, max: 15 },
      Moderate: { min: 15, max: 25 },
      High: { min: 20, max: 35 },
      Severe: { min: 30, max: 60 },
    };
    this.currentRoute = null;
  }

  /**
   * Initialize Google Maps services needed for traffic data
   */
  initialize() {
    // Initialize Google services if not already done
    if (!this.directionsService && google && google.maps) {
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#3498db",
          strokeWeight: 5,
          strokeOpacity: 0.7,
        },
      });
      this.trafficLayer = new google.maps.TrafficLayer();
    }
  }

  /**
   * Get traffic data for a location using Google Maps API
   * @param {string} location - Location name
   * @param {Object} coords - Location coordinates {lat, lng}
   * @returns {Promise<Object>} - Traffic data object
   */
  async getTrafficStatus(location, coords) {
    this.initialize();

    // Return cached result if available (cache for 5 minutes)
    const cacheKey = location || `${coords.lat},${coords.lng}`;
    const cachedData = this.cachedResults.get(cacheKey);
    const now = Date.now();

    if (cachedData && now - cachedData.timestamp < 5 * 60 * 1000) {
      return cachedData.data;
    }

    try {
      // Get nearby places to use as destinations for traffic analysis
      const nearbyRoads = await this.getNearbyRoads(coords);

      // Calculate overall traffic level based on nearby roads
      const { level, travelTime } = await this.calculateTrafficLevel(
        coords,
        nearbyRoads
      );

      // Get likely road condition based on weather and traffic
      const condition = await this.predictRoadCondition(coords, level);

      const result = {
        location: location || "Current Location",
        level: level,
        condition: condition,
        travelTime: travelTime,
        timestamp: new Date().toISOString(),
        nearbyRoads: nearbyRoads,
        congestionColor: this.getCongestionColor(level),
      };

      // Cache the result
      this.cachedResults.set(cacheKey, {
        timestamp: now,
        data: result,
      });

      return result;
    } catch (error) {
      console.error("Error getting real traffic data:", error);
      // Fallback to deterministic "random" data if API fails
      return this.getSimulatedTrafficStatus(location);
    }
  }

  /**
   * Show or hide traffic layer on the map
   * @param {Object} map - Google Maps map object
   * @param {boolean} show - Whether to show or hide the traffic layer
   */
  toggleTrafficLayer(map, show) {
    this.initialize();
    if (show) {
      this.trafficLayer.setMap(map);
    } else {
      this.trafficLayer.setMap(null);
    }
  }

  /**
   * Calculate route between two points
   * @param {Object} origin - Origin coordinates or place
   * @param {Object} destination - Destination coordinates or place
   * @param {Object} map - Google Maps map object
   * @returns {Promise<Object>} - Route information
   */
  calculateRoute(origin, destination, map) {
    this.initialize();

    return new Promise((resolve, reject) => {
      // Set up directions renderer on map
      this.directionsRenderer.setMap(map);

      const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
        provideRouteAlternatives: true,
      };

      this.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          // Display the route on the map
          this.directionsRenderer.setDirections(result);
          this.currentRoute = result;

          // Extract route information
          const route = result.routes[0];
          const leg = route.legs[0];

          // Calculate distance in km
          const distanceKm = (leg.distance.value / 1000).toFixed(1);

          // Calculate duration considering traffic
          const durationMinutes = Math.ceil(
            leg.duration_in_traffic
              ? leg.duration_in_traffic.value / 60
              : leg.duration.value / 60
          );

          // Determine traffic condition based on the ratio of duration_in_traffic to duration
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

          // Extract turn-by-turn directions
          const steps = leg.steps.map((step, index) => {
            // Remove HTML tags from instructions
            const instruction = step.instructions.replace(/<[^>]*>/g, "");

            return {
              index: index + 1,
              instruction: instruction,
              distance: step.distance.text,
              duration: step.duration.text,
            };
          });

          // Create route summary
          const summary = `From ${leg.start_address.split(",")[0]} to ${
            leg.end_address.split(",")[0]
          }`;

          const routeInfo = {
            summary: summary,
            distance: distanceKm,
            distanceText: leg.distance.text,
            duration: durationMinutes,
            durationText: leg.duration_in_traffic
              ? leg.duration_in_traffic.text
              : leg.duration.text,
            startAddress: leg.start_address,
            endAddress: leg.end_address,
            trafficCondition: trafficCondition,
            trafficColor: trafficColor,
            steps: steps,
          };

          resolve(routeInfo);
        } else {
          reject(new Error(`Route calculation failed: ${status}`));
        }
      });
    });
  }

  /**
   * Clear the current route from the map
   * @param {Object} map - Google Maps map object
   */
  clearRoute(map) {
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
      this.currentRoute = null;

      // Reset the renderer with the map
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#3498db",
          strokeWeight: 5,
          strokeOpacity: 0.7,
        },
      });
    }
  }

  /**
   * Get nearby roads with their traffic conditions
   * @param {Object} coords - Location coordinates {lat, lng}
   * @returns {Promise<Array>} - Array of nearby roads with traffic info
   */
  async getNearbyRoads(coords) {
    return new Promise((resolve) => {
      // Default roads in case API fails or is unavailable
      const fallbackRoads = [
        { name: "Main Street", distance: "0.5 km" },
        { name: "Broadway Ave", distance: "1.2 km" },
        { name: "Park Road", distance: "0.8 km" },
      ];

      if (
        !this.directionsService ||
        !google ||
        !google.maps ||
        !google.maps.places
      ) {
        // Resolve with fallback data if services aren't available
        resolve(this.addTrafficToRoads(fallbackRoads));
        return;
      }

      try {
        // Use Places API to find nearby roads
        const placesService = new google.maps.places.PlacesService(
          document.createElement("div")
        );

        placesService.nearbySearch(
          {
            location: coords,
            radius: 2000,
            type: ["route"],
          },
          (results, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              results.length > 0
            ) {
              // Process real roads data
              const roads = results.slice(0, 5).map((place) => ({
                name: place.name,
                distance:
                  this.calculateDistance(coords, place.geometry.location) +
                  " km",
                placeId: place.place_id,
              }));

              // Add traffic info to roads
              resolve(this.addTrafficToRoads(roads));
            } else {
              // Fallback to default roads
              resolve(this.addTrafficToRoads(fallbackRoads));
            }
          }
        );
      } catch (error) {
        console.error("Error fetching nearby roads:", error);
        resolve(this.addTrafficToRoads(fallbackRoads));
      }
    });
  }

  /**
   * Add traffic information to road data
   * @param {Array} roads - Roads data
   * @returns {Array} - Roads with traffic data
   */
  addTrafficToRoads(roads) {
    return roads.map((road) => {
      // Create a traffic level based on the road name to ensure consistency
      const seed = this.hashString(road.name);
      const trafficLevel = this.getSeededItem(this.trafficLevels, seed);

      return {
        ...road,
        trafficLevel: trafficLevel,
        color: this.getCongestionColor(trafficLevel),
      };
    });
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(coords1, coords2) {
    // Convert to proper lat/lng objects if needed
    const loc1 = coords1.lat
      ? coords1
      : { lat: coords1.lat(), lng: coords1.lng() };
    const loc2 = coords2.lat
      ? coords2
      : { lat: coords2.lat(), lng: coords2.lng() };

    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(loc2.lat - loc1.lat);
    const dLon = this.toRadians(loc2.lng - loc1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.lat)) *
        Math.cos(this.toRadians(loc2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance.toFixed(1);
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Calculate traffic level using Directions API
   * @param {Object} origin - Origin coordinates {lat, lng}
   * @param {Array} roads - Nearby roads
   * @returns {Promise<Object>} - Traffic level assessment
   */
  async calculateTrafficLevel(origin, roads) {
    return new Promise((resolve) => {
      if (!this.directionsService || roads.length === 0) {
        // Fallback to moderate traffic if no API
        resolve({ level: "Moderate", travelTime: 20 });
        return;
      }

      // Sample a couple of roads to check traffic
      const sampleRoad = roads[0];

      // Use directions API with traffic model
      const request = {
        origin: origin,
        destination: origin, // Use same point to just get traffic info
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      };

      this.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          // Extract duration in traffic vs duration without traffic
          const route = result.routes[0];
          const leg = route.legs[0];

          const durationValue = leg.duration.value; // in seconds
          const durationInTraffic = leg.duration_in_traffic
            ? leg.duration_in_traffic.value
            : durationValue;

          // Calculate traffic ratio
          const trafficRatio = durationInTraffic / durationValue;

          // Determine traffic level
          let level;
          if (trafficRatio < 1.1) level = "Low";
          else if (trafficRatio < 1.3) level = "Moderate";
          else if (trafficRatio < 1.6) level = "High";
          else level = "Severe";

          // Estimate travel time (minutes)
          const travelTime = Math.ceil(durationInTraffic / 60);

          resolve({ level, travelTime });
        } else {
          console.warn(
            "Directions service failed, using road data for traffic level"
          );
          // Use the roads we already have to estimate overall traffic
          const trafficCounts = roads.reduce((counts, road) => {
            counts[road.trafficLevel] = (counts[road.trafficLevel] || 0) + 1;
            return counts;
          }, {});

          // Find the most common traffic level
          let maxCount = 0;
          let level = "Moderate"; // Default

          for (const [trafficLevel, count] of Object.entries(trafficCounts)) {
            if (count > maxCount) {
              maxCount = count;
              level = trafficLevel;
            }
          }

          // Calculate average travel time based on the level
          const range = this.travelTimes[level];
          const travelTime = Math.floor((range.min + range.max) / 2);

          resolve({ level, travelTime });
        }
      });
    });
  }

  /**
   * Predict road conditions based on traffic and weather
   * @param {Object} coords - Coordinates
   * @param {String} trafficLevel - Traffic level
   * @returns {Promise<String>} - Road condition
   */
  async predictRoadCondition(coords, trafficLevel) {
    // In a real app, we would incorporate weather data here
    // For now, use a simplified model based on traffic

    // Map traffic levels to likely conditions
    const conditions = {
      Low: ["Clear", "Clear", "Clear", "Wet"],
      Moderate: ["Clear", "Clear", "Wet", "Roadwork"],
      High: ["Clear", "Wet", "Construction", "Roadwork"],
      Severe: ["Wet", "Construction", "Accident", "Roadwork"],
    };

    // Select a condition based on traffic level with some randomness
    const possibleConditions =
      conditions[trafficLevel] || conditions["Moderate"];
    const index = Math.floor(Math.random() * possibleConditions.length);

    return possibleConditions[index];
  }

  /**
   * Get a color representing traffic congestion level
   */
  getCongestionColor(level) {
    const colors = {
      Low: "#4CAF50", // Green
      Moderate: "#FFC107", // Yellow
      High: "#FF9800", // Orange
      Severe: "#F44336", // Red
    };
    return colors[level] || "#4CAF50";
  }

  /**
   * Generate simulated traffic data for a location
   * This method is public so it can be called directly when needed for immediate display
   * @param {string} location - Location name
   * @returns {Object} - Simulated traffic data object
   */
  getSimulatedTrafficStatus(location) {
    // Create seed from location name to keep results consistent for same location
    const seed = this.hashString(location || "Unknown");

    // Use the seed to get deterministic but seemingly random values
    const trafficLevel = this.getSeededItem(this.trafficLevels, seed);
    const roadCondition = this.getSeededItem(this.roadConditions, seed + 1);

    // Calculate travel time based on traffic level
    const range = this.travelTimes[trafficLevel];
    const travelTime = this.getSeededRandomInRange(
      range.min,
      range.max,
      seed + 2
    );

    // Generate nearby road status (deterministic but seems random)
    const nearbyRoads = this.generateNearbyRoads(seed);

    return {
      location: location || "Current Location",
      level: trafficLevel,
      condition: roadCondition,
      travelTime: travelTime,
      timestamp: new Date().toISOString(),
      nearbyRoads: nearbyRoads,
      congestionColor: this.getCongestionColor(trafficLevel),
      isSimulated: true,
    };
  }

  /**
   * Generate info about nearby roads with traffic conditions
   * Used as fallback when the real API fails
   */
  generateNearbyRoads(seed) {
    const roads = [
      { name: "Main Street", distance: "0.5 km" },
      { name: "Broadway Ave", distance: "1.2 km" },
      { name: "Park Road", distance: "0.8 km" },
      { name: "Highway 101", distance: "2.3 km" },
      { name: "Central Avenue", distance: "1.7 km" },
    ];

    // Select 2-3 random roads
    const numRoads = this.getSeededRandomInRange(2, 3, seed);
    const selectedRoads = [];

    for (let i = 0; i < numRoads; i++) {
      const roadIndex = this.getSeededRandomInRange(
        0,
        roads.length - 1,
        seed + i * 10
      );
      const road = roads[roadIndex];
      const trafficLevel = this.getSeededItem(
        this.trafficLevels,
        seed + i * 20
      );

      selectedRoads.push({
        name: road.name,
        distance: road.distance,
        trafficLevel: trafficLevel,
        color: this.getCongestionColor(trafficLevel),
      });
    }

    return selectedRoads;
  }

  /**
   * Simple hash function to convert a string to a number
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get a deterministic "random" item from an array using a seed
   */
  getSeededItem(array, seed) {
    const index = seed % array.length;
    return array[index];
  }

  /**
   * Get a deterministic "random" number in a range using a seed
   */
  getSeededRandomInRange(min, max, seed) {
    const random = ((seed * 9301 + 49297) % 233280) / 233280;
    return Math.floor(min + random * (max - min + 1));
  }
}
