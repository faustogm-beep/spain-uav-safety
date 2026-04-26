import './style.css';
import L from 'leaflet';
import * as Esri from 'esri-leaflet';

// --- Configuration ---
const ENAIRE_URL = 'https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V1/FeatureServer';

interface RestrictionConfig {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

const LAYER_CONFIGS: Record<string, RestrictionConfig> = {
  '0': { id: 'infra', name: 'Infraestructura', color: '#8b5cf6', icon: 'M19 16v3M13 16v3M7 16v3M5 8h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM9 2v6M15 2v6', description: 'Protección de infraestructuras críticas o zonas sensibles.' },
  '2': { id: 'aero', name: 'Zonas Aeronáuticas', color: '#ef4444', icon: 'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-1.1.1-1.5.5l-.3.3c-.4.4-.5 1-.1 1.4L10 12l-4 4H4l-2 2v2l2-2h2l4-4 3.6 7.1c.4.4 1 .3 1.4-.1l.3-.3c.4-.4.6-1 .5-1.5z', description: 'CTR, Helipuertos o zonas de control de tráfico aéreo.' },
  '3': { id: 'urbano', name: 'Zona Urbana', color: '#facc15', icon: 'M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7', description: 'Zonas pobladas o núcleos urbanos (Uso de UAS restringido).' }
};

// --- Initialization ---
const map = L.map('map', {
  zoomControl: false,
  attributionControl: false
}).setView([40.4168, -3.7038], 10);

const baseMaps = {
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
  ortho: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
  light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
};

baseMaps.dark.addTo(map);

// Feature Layers (Visual only)
const layers: Record<string, any> = {};
Object.entries(LAYER_CONFIGS).forEach(([id, config]) => {
  layers[id] = Esri.featureLayer({
    url: `${ENAIRE_URL}/${id}`,
    style: () => ({
      color: config.color,
      weight: 1.5,
      fillOpacity: 0.12,
      dashArray: id === '3' ? '5, 5' : '' // Dash Urbano to differentiate
    })
  }).addTo(map);
});

// --- Core Interaction: Cumulative Restrictions ---
map.on('click', async (e: L.LeafletMouseEvent) => {
  const { lat, lng } = e.latlng;
  
  // Show loading state
  const listContainer = document.getElementById('restriction-list')!;
  listContainer.innerHTML = '<div class="empty-state">Consultando restricciones acumuladas...</div>';
  
  const results: any[] = [];
  
  try {
    // Spatial queries (Parallel for speed)
    const queries = Object.keys(LAYER_CONFIGS).map(layerId => {
      return new Promise((resolve) => {
        Esri.query({ url: `${ENAIRE_URL}/${layerId}` })
          .contains(e.latlng)
          .run((error, featureCollection) => {
            if (!error && featureCollection.features.length > 0) {
              featureCollection.features.forEach((f: any) => {
                results.push({ ...f, _layerId: layerId });
              });
            }
            resolve(true);
          });
      });
    });

    await Promise.all(queries);
    renderRestrictions(results, lat, lng);
    
  } catch (err) {
    console.error("Error querying layers:", err);
    listContainer.innerHTML = '<div class="empty-state">Error al consultar los datos.</div>';
  }
});

function renderRestrictions(features: any[], lat: number, lng: number) {
  const container = document.getElementById('restriction-list')!;
  const statusDot = document.getElementById('status-dot')!;
  const statusTitle = document.getElementById('status-title')!;
  const statusSub = document.getElementById('status-sub')!;

  if (features.length === 0) {
    container.innerHTML = '<div class="empty-state">No se han detectado restricciones directas en este punto. Procede con precaución (VLOS).</div>';
    statusDot.className = 'dot green';
    statusTitle.innerText = 'APTO PARA VUELO';
    statusSub.innerText = 'Sin restricciones detectadas.';
  } else {
    // Sort features: Aero first, then Urbano, then Infra
    const sorted = features.sort((a, b) => parseInt(b._layerId) - parseInt(a._layerId));
    
    container.innerHTML = sorted.map(f => {
      const config = LAYER_CONFIGS[f._layerId];
      const name = f.properties.NOMBRE || f.properties.LABEL || config.name;
      return `
        <div class="restriction-item" style="border-left: 4px solid ${config.color}">
          <svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="${config.color}" stroke-width="2">
            <path d="${config.icon}"></path>
          </svg>
          <div class="res-info">
            <h3>${name}</h3>
            <p>${config.description}</p>
          </div>
        </div>
      `;
    }).join('');

    // Update main status based on highest severity
    const hasAero = features.some(f => f._layerId === '2');
    const hasUrbano = features.some(f => f._layerId === '3');

    if (hasAero) {
      statusDot.className = 'dot red';
      statusTitle.innerText = 'VUELO RESTRINGIDO';
      statusSub.innerText = 'Coordinación obligatoria requerida.';
    } else if (hasUrbano) {
      statusDot.className = 'dot yellow';
      statusTitle.innerText = 'ZONA URBANA';
      statusSub.innerText = 'Cumplir con normativa de entornos urbanos.';
    } else {
      statusDot.className = 'dot yellow';
      statusTitle.innerText = 'PRECAUCIÓN';
      statusSub.innerText = 'Restricciones locales detectadas.';
    }
  }

  // Update weather for new location
  fetchWeather(lat, lng);
}

// --- Weather & UI Utils ---
async function fetchWeather(lat: number, lon: number) {
  const weatherInfo = document.getElementById('weather-info')!;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    const cur = data.current_weather;
    weatherInfo.innerHTML = `${cur.temperature}°C <span style="font-size: 0.8rem; opacity: 0.6;">${cur.windspeed} km/h</span>`;
  } catch (e) {
    weatherInfo.innerText = "--°C";
  }
}

// Layer Switcher
let activeLayerKey = 'dark';
document.getElementById('layer-btn')?.addEventListener('click', () => {
  const keys = Object.keys(baseMaps);
  const nextKey = keys[(keys.indexOf(activeLayerKey) + 1) % keys.length] as keyof typeof baseMaps;
  map.removeLayer(baseMaps[activeLayerKey as keyof typeof baseMaps]);
  baseMaps[nextKey].addTo(map);
  activeLayerKey = nextKey;
});

document.getElementById('locate-btn')?.addEventListener('click', () => map.locate({ setView: true, maxZoom: 15 }));
map.on('locationfound', (e) => {
  L.circleMarker(e.latlng, { radius: 8, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8 }).addTo(map);
  map.fire('click', { latlng: e.latlng } as any);
});

// Search
(document.getElementById('search-input') as HTMLInputElement)?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${(e.target as HTMLInputElement).value}, Spain`)
      .then(r => r.json())
      .then(res => {
        if (res.length > 0) {
          const loc = L.latLng(parseFloat(res[0].lat), parseFloat(res[0].lon));
          map.setView(loc, 14);
          map.fire('click', { latlng: loc } as any);
        }
      });
  }
});
