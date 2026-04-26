import './style.css';
import L from 'leaflet';
import * as Esri from 'esri-leaflet';

// Constants for ENAIRE Layers
const ENAIRE_REST_URL = 'https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V1/FeatureServer';
const LAYERS = {
  INFRA: '0',     // ZGUAS_Infraestructuras
  AERO: '2',      // ZGUAS_Aero
  URBANO: '3'     // ZGUAS_Urbano
};

// State
let currentLat = 40.4168;
let currentLon = -3.7038;

// Initialize Map
const map = L.map('map', {
  zoomControl: false,
  attributionControl: false
}).setView([currentLat, currentLon], 10);

// Base Layers
const baseMaps = {
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
  ortho: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
  light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
};

baseMaps.dark.addTo(map);

// ENAIRE Feature Layers (with performance optimization)
const uasAero = Esri.featureLayer({
  url: `${ENAIRE_REST_URL}/${LAYERS.AERO}`,
  style: () => ({ color: '#ff4d4d', weight: 1.5, fillOpacity: 0.15 }),
  simplifyFactor: 0.5,
  precision: 5
}).addTo(map);

const uasUrbano = Esri.featureLayer({
  url: `${ENAIRE_REST_URL}/${LAYERS.URBANO}`,
  style: () => ({ color: '#ffd93d', weight: 1.2, fillOpacity: 0.1 }),
  simplifyFactor: 0.5,
  precision: 5
}).addTo(map);

const uasInfra = Esri.featureLayer({
  url: `${ENAIRE_REST_URL}/${LAYERS.INFRA}`,
  style: () => ({ color: '#ff7b7b', weight: 2, fillOpacity: 0.3 }),
}).addTo(map);

// Interaction Logic
uasAero.on('click', (e: L.LeafletMouseEvent) => handleFeatureClick(e, 'Zona Aeronáutica'));
uasUrbano.on('click', (e: L.LeafletMouseEvent) => handleFeatureClick(e, 'Zona Urbana'));
uasInfra.on('click', (e: L.LeafletMouseEvent) => handleFeatureClick(e, 'Infraestructura Crítica'));

function handleFeatureClick(e: L.LeafletMouseEvent, type: string) {
  const props = e.layer.feature.properties;
  const name = props.NOMBRE || props.LABEL || type;
  
  L.popup()
    .setLatLng(e.latlng)
    .setContent(`<div style="color:#000"><b>${name}</b><br><small>${type}</small></div>`)
    .openOn(map);

  updateAppStatus('rest', `Restricción en esta zona: ${name}`);
}

// UI Controls
function updateAppStatus(type: 'ok' | 'warn' | 'rest', message: string) {
  const dot = document.getElementById('status-dot')!;
  const title = document.getElementById('status-title')!;
  const sub = document.getElementById('status-sub')!;

  dot.className = `dot ${type === 'ok' ? 'green' : (type === 'warn' ? 'yellow' : 'red')}`;
  title.innerText = type === 'ok' ? 'APTO PARA VUELO' : (type === 'warn' ? 'PRECAUCIÓN' : 'VUELO RESTRINGIDO');
  sub.innerText = message;
}

// Layer Toggle Logic
let activeLayerKey = 'dark';
document.getElementById('layer-btn')?.addEventListener('click', () => {
  const keys = Object.keys(baseMaps);
  const nextIdx = (keys.indexOf(activeLayerKey) + 1) % keys.length;
  const nextKey = keys[nextIdx] as keyof typeof baseMaps;
  
  map.removeLayer(baseMaps[activeLayerKey as keyof typeof baseMaps]);
  baseMaps[nextKey].addTo(map);
  activeLayerKey = nextKey;
});

// Locate Me
document.getElementById('locate-btn')?.addEventListener('click', () => {
  map.locate({ setView: true, maxZoom: 15 });
});

map.on('locationfound', (e) => {
  L.circleMarker(e.latlng, { radius: 8, color: '#7bd0ff', fillColor: '#7bd0ff', fillOpacity: 0.8 }).addTo(map);
  fetchWeather(e.latlng.lat, e.latlng.lng);
});

// Search functionality
const searchInput = document.getElementById('search-input') as HTMLInputElement;
searchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}, Spain`)
      .then(r => r.json())
      .then(results => {
        if (results.length > 0) {
          const { lat, lon } = results[0];
          map.setView([lat, lon], 14);
          fetchWeather(parseFloat(lat), parseFloat(lon));
        }
      });
  }
});

// Weather Logic (AEMET Proxy Guidance)
async function fetchWeather(lat: number, lon: number) {
  const weatherInfo = document.getElementById('weather-info')!;
  weatherInfo.innerText = "Cargando...";

  try {
    // In a real app, we'd use a serverless function to talk to AEMET SDK 
    // For this prototype, we guide the user or use a public forecast API like OpenMeteo for immediate feedback
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    const cur = data.current_weather;
    
    weatherInfo.innerHTML = `${cur.temperature}°C <span style="font-size: 0.8rem; opacity: 0.6;">${cur.windspeed} km/h</span>`;
    
    if (cur.windspeed > 20) {
        document.getElementById('weather-alert')!.innerText = "⚠️ Viento fuerte detectado";
        updateAppStatus('warn', "Condiciones meteorológicas adversas.");
    } else {
        document.getElementById('weather-alert')!.innerText = "Viento seguro < 20km/h";
    }
  } catch (e) {
    weatherInfo.innerText = "--°C";
  }
}

// Pro Assistant Placeholder
document.getElementById('pro-assistant-btn')?.addEventListener('click', () => {
    alert("Pro Assistant: ¿Deseas preparar la comunicación previa para el Ministerio del Interior en esta zona? (Función Pro)");
});

// Cloud Sync Placeholder
document.getElementById('login-drive')?.addEventListener('click', () => {
    alert("Google Drive: Conectando con tu cuenta para sincronizar el libro de vuelo...");
});
