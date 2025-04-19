/**
 * Weather Service
 * Created by: Ashish-suman-sharma
 * Created on: 2025-02-22 09:50:06
 */

class WeatherService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    }

    async getCurrentWeather(lat, lng) {
        try {
            const response = await fetch(
                `${this.baseUrl}/weather?lat=${lat}&lon=${lng}&appid=${this.apiKey}&units=metric`
            );

            if (!response.ok) {
                throw new Error('Weather API request failed');
            }

            const data = await response.json();
            
            return {
                temperature: Math.round(data.main.temp),
                description: this.capitalizeFirstLetter(data.weather[0].description),
                humidity: data.main.humidity,
                windSpeed: data.wind.speed,
                icon: data.weather[0].icon,
                timestamp: new Date().toISOString(),
                location: data.name
            };
        } catch (error) {
            console.error('Error fetching weather:', error);
            throw error;
        }
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    getWeatherIcon(iconCode) {
        const iconMap = {
            '01d': 'sun',
            '01n': 'moon',
            '02d': 'cloud-sun',
            '02n': 'cloud-moon',
            '03d': 'cloud',
            '03n': 'cloud',
            '04d': 'cloud',
            '04n': 'cloud',
            '09d': 'cloud-showers-heavy',
            '09n': 'cloud-showers-heavy',
            '10d': 'cloud-rain',
            '10n': 'cloud-rain',
            '11d': 'bolt',
            '11n': 'bolt',
            '13d': 'snowflake',
            '13n': 'snowflake',
            '50d': 'smog',
            '50n': 'smog'
        };

        return iconMap[iconCode] || 'question';
    }
}