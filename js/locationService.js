/**
 * Location Service
 * Created by: Ashish-suman-sharma
 * Created on: 2025-02-22 09:50:06
 */

class LocationService {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.listeners = new Set();
    }

    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    resolve(this.currentPosition);
                },
                error => {
                    reject(this.handleLocationError(error));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        });
    }

    startWatching() {
        if (this.watchId) return;

        if (!navigator.geolocation) {
            console.error('Geolocation is not supported');
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            position => {
                this.currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                this.notifyListeners();
            },
            error => {
                console.error(this.handleLocationError(error));
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }

    stopWatching() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.currentPosition);
            } catch (error) {
                console.error('Error in location listener:', error);
            }
        });
    }

    handleLocationError(error) {
        switch(error.code) {
            case error.PERMISSION_DENIED:
                return new Error('Location permission denied');
            case error.POSITION_UNAVAILABLE:
                return new Error('Location information unavailable');
            case error.TIMEOUT:
                return new Error('Location request timed out');
            default:
                return new Error('Unknown location error');
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    formatDistance(distance) {
        if (distance < 1) {
            return `${Math.round(distance * 1000)} m`;
        }
        return `${distance.toFixed(1)} km`;
    }
}