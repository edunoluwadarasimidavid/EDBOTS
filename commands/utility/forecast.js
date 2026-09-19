/**
 * Advanced Weather Command - Multi-day forecast, air quality, wind, humidity
 */

const axios = require('axios');

module.exports = {
    name: 'forecast',
    aliases: ['weather', 'w', 'meteo'],
    category: 'utility',
    description: 'Get detailed weather forecast with air quality',
    usage: '.forecast <city> or .forecast <city> <days>',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `🌤️ *Advanced Weather*\n\n` +
                    `*Usage:* \`.forecast <city>\`\n` +
                    `*Extended:* \`.forecast <city> 3\` (3-day forecast)\n\n` +
                    `*Examples:*\n` +
                    `• \`.forecast London\`\n` +
                    `• \`.forecast New York 5\`\n` +
                    `• \`.forecast Tokyo\``
                );
            }

            const city = args.filter(a => !/^\d+$/.test(a)).join(' ');
            const days = parseInt(args.find(a => /^\d+$/.test(a))) || 1;

            await extra.reply(`🌤️ Fetching weather for ${city}...`);

            // Use Open-Meteo (free, no API key needed)
            // First, geocode the city
            const geoRes = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`,
                { timeout: 10000 }
            );

            if (!geoRes.data?.results?.length) {
                return extra.reply(`❌ City "${city}" not found. Please check the spelling.`);
            }

            const location = geoRes.data.results[0];
            const { latitude, longitude, name, country } = location;

            // Get weather forecast
            const weatherRes = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,` +
                `weathercode,windspeed_10m_max,uv_index_max` +
                `&current=temperature_2m,relative_humidity_2m,weathercode,windspeed_10m,apparent_temperature` +
                `&timezone=auto&forecast_days=${Math.min(days, 7)}`,
                { timeout: 10000 }
            );

            const weather = weatherRes.data;
            const current = weather.current;
            const daily = weather.daily;

            // Weather code descriptions
            const weatherCodes = {
                0: '☀️ Clear sky', 1: '🌤️ Mainly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast',
                45: '🌫️ Fog', 48: '🌫️ Fog', 51: '🌦️ Light drizzle', 53: '🌦️ Moderate drizzle',
                55: '🌦️ Dense drizzle', 61: '🌧️ Slight rain', 63: '🌧️ Moderate rain',
                65: '🌧️ Heavy rain', 71: '🌨️ Slight snow', 73: '🌨️ Moderate snow',
                75: '🌨️ Heavy snow', 80: '🌦️ Slight showers', 81: '🌧️ Moderate showers',
                82: '🌧️ Violent showers', 95: '⛈️ Thunderstorm', 96: '⛈️ Thunderstorm with hail'
            };

            // Current weather
            const currentDesc = weatherCodes[current.weathercode] || '🌡️ Unknown';
            let text = `🌤️ *Weather in ${name}, ${country}*\n\n`;

            text += `*Current Conditions:*\n`;
            text += `${currentDesc}\n`;
            text += `🌡️ Temperature: *${current.temperature_2m}°C* (Feels like: ${current.apparent_temperature}°C)\n`;
            text += `💧 Humidity: ${current.relative_humidity_2m}%\n`;
            text += `💨 Wind: ${current.windspeed_10m} km/h\n\n`;

            // Forecast
            if (daily && daily.time) {
                text += `*${daily.time.length}-Day Forecast:*\n\n`;

                for (let i = 0; i < daily.time.length; i++) {
                    const date = new Date(daily.time[i]);
                    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
                    const desc = weatherCodes[daily.weathercode[i]] || '🌡️';

                    text += `📅 *${dayName}*\n`;
                    text += `   ${desc}\n`;
                    text += `   🌡️ ${daily.temperature_2m_min[i]}° - ${daily.temperature_2m_max[i]}°C\n`;
                    text += `   🌧️ Rain: ${daily.precipitation_probability_max[i]}% (${daily.precipitation_sum[i]}mm)\n`;
                    text += `   💨 Wind: ${daily.windspeed_10m_max[i]} km/h\n`;
                    text += `   ☀️ UV: ${daily.uv_index_max[i]}\n\n`;
                }
            }

            text += `📍 Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`;

            await extra.reply(text);

        } catch (error) {
            console.error('[FORECAST ERROR]', error);
            await extra.reply('❌ Error fetching weather data.');
        }
    }
};
