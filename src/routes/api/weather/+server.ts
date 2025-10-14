import type { RequestHandler } from './$types';
import Parser from 'rss-parser';
import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';

let apiKey = env.PUBLIC_WEATHER_API;
let geminiKey = env.PUBLIC_GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: geminiKey });

const rssParser = new Parser<newsItem>({
    customFields: {
        item: ['source']
    }
});
// open the data.json file

type newsItem = {
    title: string;
    link: string;
    pubDate: string;
    source: { url: string; title: string };
};

export const GET: RequestHandler = async ({ fetch, url, setHeaders }) => {
    let location = url.searchParams.get('location') || 'Guwahati'; // Default location

    let lat: number;
    let lon: number;
    let current;
    let hourly;
    let air;
    let posts;

    try {
        const res = await fetch(
            `http://api.openweathermap.org/geo/1.0/direct?q=${location}&limit=1&appid=${apiKey}`
        );
        const data = await res.json();
        if (data && data.length > 0) {
            lat = data[0].lat;
            lon = data[0].lon;
        } else {
            error(500, `No location data found for ${location}`);
        }
    } catch (e) {
        error(500, `Failed to fetch location data: ${e}`);
    }

    try {
        if (lat && lon) {
            const weatherRes = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
            );
            if (weatherRes.ok) {
                current = await weatherRes.json();
            } else {
                error(500, `Failed to fetch weather data: ${weatherRes.statusText}`);
            }
        }
    } catch (e) {
        error(500, `Failed to fetch weather data: ${e}`);
    }
    try {
        if (lat && lon) {
            const hourlyRes = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?units=metric&lat=${lat}&lon=${lon}&appid=${apiKey}`
            );
            if (hourlyRes.ok) {
                hourly = await hourlyRes.json();
            } else {
                error(500, `Failed to fetch hourly weather data: ${hourlyRes.statusText}`);
            }
        }
    } catch (e) {
        error(500, `Failed to fetch hourly weather data: ${e}`);
    }
    try {
        if (lat && lon) {
            const airRes = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
            );
            if (airRes.ok) {
                air = await airRes.json();
            } else {
                error(500, `Failed to fetch air quality data: ${airRes.statusText}`);
            }
        }
    } catch (e) {
        error(500, `Failed to fetch air quality data: ${e}`);
    }

    console.log('Fetching news for location:', location);
    posts = await rssParser.parseURL(
        `https://news.google.com/rss/headlines/section/geo/${location}`
    );

    setHeaders({
        // Cache for 15 minutes (900 seconds)
        'Cache-Control': 'public, max-age=900'
    });

    return new Response(JSON.stringify({ current, hourly, air, posts }));
};
