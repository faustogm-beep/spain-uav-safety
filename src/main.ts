import './style.css';
import L from 'leaflet';
import * as Esri from 'esri-leaflet';

// --- Global State & Configuration ---
const MAX_ALTITUDE = 120; // Standard UAS ceiling in Spain (meters AGL)

const SERVICES = {
  UAS: 'https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V1/FeatureServer',
  NATURAL: 'https://servais.enaire.es/insignia/rest/services/ENP/ENP_APP_Local_V4/MapServer',
  AERO_EXTRA: 'https://servais.enaire.es/insignia/rest/services/NSF/Drones_ZG_Aero_V3/MapServer'
};

interface RestrictionConfig {
  service: string;
  id: string;
  category: 'aero' | 'urbano' | 'infra' | 'natural' | 'seguridad' | 'foto';
  name: string;
  color: string;
  icon: string;
  action: { label: string; url: string; };
}

const LAYER_CONFIGS: Record<string, RestrictionConfig> = {
  // UAS Service
  'uas_0': { service: SERVICES.UAS, id: '0', category: 'infra', name: 'Infraestructura Crítica', color: '#9333ea', icon: 'M19 16v3M13 16v3M7 16v3M5 8h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', action: { label: 'Más info Sede Electrónica', url: 'https://sede.interior.gob.es/' } },
  'uas_2': { service: SERVICES.UAS, id: '2', category: 'aero', name: 'Control Aeronáutico', color: '#dc2626', icon: 'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-1.1.1-1.5.5l-.3.3c-.4.4-.5 1-.1 1.4L10 12l-4 4H4l-2 2v2l2-2h2l4-4 3.6 7.1c.4.4 1 .3 1.4-.1l.3-.3c.4-.4.6-1 .5-1.5z', action: { label: 'Coordinar con ENAIRE', url: 'https://planea.enaire.es/' } },
  'uas_3': { service: SERVICES.UAS, id: '3', category: 'urbano', name: 'Zona Urbana', color: '#eab308', icon: 'M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7', action: { label: 'Comunicación Ministerio', url: 'https://sede.interior.gob.es/portal/sede/tramites?codAgrupacion=Drones' } },
  'nat_1': { service: SERVICES.NATURAL, id: '1', category: 'natural', name: 'Zona ZEPA / Protegida', color: '#16a34a', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', action: { label: 'Ver normativa ambiental', url: 'https://www.miteco.gob.es/' } },
  'extra_3': { service: SERVICES.AERO_EXTRA, id: '3', category: 'foto', name: 'Restricción Fotográfica', color: '#ea580c', icon: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', action: { label: 'Permiso RVF', url: 'https://www.defensa.gob.es/' } },
  'extra_6': { service: SERVICES.AERO_EXTRA, id: '6', category: 'seguridad', name: 'Zona de Seguridad', color: '#2563eb', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', action: { label: 'Consultar helipuerto/AD', url: 'https://planea.enaire.es/' } }
};

// --- Initialization ---
const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([28.4636, -16.2518], 11); // Start in Tenerife (Complex area)

const baseMaps = {
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
  ortho: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
};
baseMaps.dark.addTo(map);

// Add visual layers with smart styling
// Add visual layers with smart styling and altitude filtering
Object.values(LAYER_CONFIGS).forEach((config) => {
  Esri.featureLayer({
    url: `${config.service}/${config.id}`,
    where: "Lower < 120 OR Lower IS NULL", 
    style: (f) => {
      const props = f?.properties || {};
      const name = (getFeatureProperty(props, ['name', 'nombre']) || '').toUpperCase();
      const type = (getFeatureProperty(props, ['type']) || '').toUpperCase();
      const isHidden = type.includes('TMA') || type.includes('UIR') || type.includes('FIR');
      
      let color = config.color;
      let weight = 2;
      let dashArray = '';

      // Professional Sub-coloring (Map Level)
      if (name.includes('HOSPITAL') || type.includes('HOSPITAL')) color = '#3b82f6'; // Blue
      else if (type.includes('HELI')) color = '#8b5cf6'; // Violet
      else if (type === 'CTR') { color = '#dc2626'; weight = 3; } // Thick Red
      else if (type === 'ATZ') { color = '#ef4444'; dashArray = '2, 4'; } // Dotted Red
      else if (type.includes('SECTOR') || type.includes('TIZ')) { color = '#f97316'; weight = 1; } // Orange Sectors
      
      if (config.category === 'urbano') dashArray = '5, 5';
      if (config.category === 'foto') { dashArray = '10, 10'; color = '#ea580c'; }

      return {
        color: color,
        weight: isHidden ? 0 : weight,
        fillOpacity: isHidden ? 0 : (config.category === 'natural' ? 0.05 : 0.015),
        dashArray: dashArray
      };
    }
  }).addTo(map);
});

// --- Core Interaction ---
map.on('click', async (e: L.LeafletMouseEvent) => {
  const listContainer = document.getElementById('restriction-list')!;
  listContainer.innerHTML = '<div class="empty-state">Consultando base de datos ENAIRE/AEMET...</div>';
  
  const results: any[] = [];
  const queries = Object.values(LAYER_CONFIGS).map((config) => {
    return new Promise((resolve) => {
      Esri.query({ url: `${config.service}/${config.id}` })
        .contains(e.latlng)
        .run((error, featureCollection) => {
          if (!error && featureCollection?.features.length > 0) {
            featureCollection.features.forEach((f: any) => {
              const lower = f.properties.Lower || 0;
              const type = (f.properties.Type || '').toUpperCase();
              // Filter out high-altitude TMAs/FIRs from the list too
              if (lower < MAX_ALTITUDE && !type.includes('TMA') && !type.includes('FIR')) {
                results.push({ ...f, _config: config });
              }
            });
          }
          resolve(true);
        });
    });
  });

  await Promise.all(queries);
  renderApp(results, e.latlng);
});

function renderApp(features: any[], latlng: L.LatLng) {
  const container = document.getElementById('restriction-list')!;
  
  // Use event delegation for clicking items
  container.onclick = (ev) => {
    const item = (ev.target as HTMLElement).closest('.restriction-item');
    if (item) item.classList.toggle('expanded');
  };

  if (features.length === 0) {
    container.innerHTML = '<div class="empty-state">Sin restricciones directas. Mantén VLOS y precaución.</div>';
    updateStatus('ok', 'Cielo Despejado', 'Sin restricciones detectadas.');
  } else {
    container.innerHTML = features.map((f, index) => {
      const config = f._config;
      const props = f.properties;
      const type = (getFeatureProperty(props, ['type']) || '').toUpperCase();
      const name = getFeatureProperty(props, ['name', 'nombre', 'label', 'identifier']) || config.name;
      const upperName = name.toUpperCase();
      
      // Dynamic sub-branding
      let subColor = config.color;
      let icon = config.icon;
      
      if (upperName.includes('HOSPITAL') || type.includes('HOSPITAL')) { subColor = '#3b82f6'; icon = 'M19 14l-7 7-7-7m14-4l-7 7-7-7'; }
      else if (type === 'CTR') subColor = '#dc2626';
      else if (type === 'ATZ') subColor = '#ef4444';
      else if (type.includes('SECTOR')) subColor = '#f97316';

      return `
        <div class="restriction-item" data-index="${index}" style="border-left: 4px solid ${subColor}">
          <div class="item-header">
            <svg class="res-icon" viewBox="0 0 24 24" fill="none" stroke="${subColor}" stroke-width="2">
              <path d="${icon}"></path>
            </svg>
            <div class="res-info">
              <h3>${name}</h3>
              <span class="cat-tag" style="background: ${subColor}22; color: ${subColor}">${type || config.category.toUpperCase()}</span>
            </div>
            <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M6 9l6 6 6-6"></path></svg>
          </div>
          <div class="item-details">
            <div class="detail-body">
              <p>${getFeatureProperty(props, ['description', 'desc_zg', 'reasons', 'message']) || 'Zona restringida por seguridad aérea u operativa.'}</p>
              <div class="meta-grid">
                <div><span>Base:</span> ${getFeatureProperty(props, ['lower']) || 0}m</div>
                <div><span>Techo:</span> ${getFeatureProperty(props, ['upper']) || 'UNL'}</div>
              </div>
              <a href="${config.action.url}" target="_blank" class="action-btn-link" style="background: ${subColor}">
                ${config.action.label}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"></path></svg>
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const topSev = features.find(f => f._config.category === 'aero') || features[0];
    updateStatus(topSev._config.category === 'aero' ? 'rest' : 'warn', 'Atención Requerida', `${features.length} zonas detectadas.`);
  }

  fetchWeather(latlng.lat, latlng.lng);
}

function updateStatus(type: 'ok' | 'warn' | 'rest', title: string, sub: string) {
  const dot = document.getElementById('status-dot')!;
  const t = document.getElementById('status-title')!;
  const s = document.getElementById('status-sub')!;
  dot.className = `dot ${type === 'ok' ? 'green' : (type === 'warn' ? 'yellow' : 'red')}`;
  t.innerText = title;
  s.innerText = sub;
}

function getFeatureProperty(props: any, keys: string[]): string | undefined {
  const lowerProps = Object.keys(props).reduce((a, k) => { a[k.toLowerCase()] = props[k]; return a; }, {} as any);
  for (const k of keys) { const v = lowerProps[k.toLowerCase()]; if (v && v !== 'Null') return v; }
  return undefined;
}

// --- Weather & UI Sync ---
async function fetchWeather(lat: number, lon: number) {
  const weatherInfo = document.getElementById('weather-info')!;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    const cur = data.current_weather;
    weatherInfo.innerHTML = `${cur.temperature}°C <span style="font-size: 0.8rem; opacity: 0.6;">${cur.windspeed} km/h</span>`;
  } catch (e) { weatherInfo.innerText = "--°C"; }
}

document.getElementById('layer-btn')?.addEventListener('click', () => {
  const keys = Object.keys(baseMaps);
  const nextKey = keys[(keys.indexOf(activeLayerKey) + 1) % keys.length] as keyof typeof baseMaps;
  map.removeLayer(baseMaps[activeLayerKey as keyof typeof baseMaps]);
  baseMaps[nextKey].addTo(map);
  activeLayerKey = nextKey;
});
let activeLayerKey = 'dark';

document.getElementById('locate-btn')?.addEventListener('click', () => map.locate({ setView: true, maxZoom: 15 }));
map.on('locationfound', (e) => map.fire('click', { latlng: e.latlng } as any));
