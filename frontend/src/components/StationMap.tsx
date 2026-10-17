import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Station } from '../types';
import { calculatePM25AQI } from '../lib/aqi';

// Configure MapLibre GL worker for Vite bundler
maplibregl.setWorkerUrl(workerUrl);

interface StationMapProps {
  stations: Station[];
  selectedStationId?: string;
  onSelectStation: (stationId: string) => void;
  theme?: 'light' | 'dark';
  isSample?: boolean;
}

export const StationMap: React.FC<StationMapProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  theme = 'light',
  isSample = true,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  const getStyleUrl = (currentTheme: 'light' | 'dark') => {
    return currentTheme === 'dark'
      ? 'https://tiles.openfreemap.org/styles/dark'
      : 'https://tiles.openfreemap.org/styles/positron';
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // High-performance vector tiles via OpenFreeMap (no API key required, no watermarks, full vector fidelity)
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: getStyleUrl(theme),
      center: [72.8777, 19.0760], // Greater Mumbai
      zoom: 10.4,
      maxZoom: 15,
      minZoom: 8,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map style when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(getStyleUrl(theme));
  }, [theme]);

  // Update markers when stations or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    stations.forEach((station) => {
      const pm25 = station.latest_pm25 ?? 40;
      const { category } = calculatePM25AQI(pm25);
      const isSelected = station.id === selectedStationId;

      const el = document.createElement('div');
      el.className = 'station-marker';
      el.style.width = isSelected ? '18px' : '12px';
      el.style.height = isSelected ? '18px' : '12px';
      el.style.backgroundColor = category.colorHex;
      el.style.border = isSelected ? '2px solid var(--ink)' : '1px solid var(--ink)';
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';
      el.style.boxShadow = isSelected ? '0 0 0 3px color-mix(in srgb, var(--ink) 25%, transparent)' : 'none';
      el.style.transition = 'all 160ms ease';

      el.addEventListener('click', () => {
        onSelectStation(station.id);
      });

      const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 4px; color: var(--ink);">
          <div style="font-weight: 600; margin-bottom: 2px;">${station.name}</div>
          <div style="color: var(--ink-2);">${station.agency} &middot; ${station.area}</div>
          <div style="margin-top: 4px; font-size: 12px; font-weight: 500;">PM2.5: ${pm25.toFixed(1)} µg/m³ (${category.label})</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.coordinates.longitude, station.coordinates.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current[station.id] = marker;
    });
  }, [stations, selectedStationId, onSelectStation]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px', backgroundColor: 'var(--paper-2)' }}>
      {/* Clean native vector cartography without CSS filter hacks or watermarks */}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* Cartographic Legend overlay */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          backgroundColor: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--ink)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>
          MUMBAI MONITORING GRID
        </div>
        <div style={{ color: 'var(--ink-2)' }}>
          {isSample
            ? `${stations.length} SAMPLE FIELD NODES`
            : `${stations.length} ACTIVE STATIONS`}
        </div>
      </div>
    </div>
  );
};

