import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Station } from '../types';
import { calculatePM25AQI } from '../lib/aqi';

interface StationMapProps {
  stations: Station[];
  selectedStationId?: string;
  onSelectStation: (stationId: string) => void;
}

export const StationMap: React.FC<StationMapProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Use OpenStreetMap tiles with archival paper filter
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
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
      el.style.border = isSelected ? '2px solid #1B1A17' : '1px solid #1B1A17';
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';
      el.style.boxShadow = isSelected ? '0 0 0 3px rgba(27, 26, 23, 0.25)' : 'none';
      el.style.transition = 'all 160ms ease';

      el.addEventListener('click', () => {
        onSelectStation(station.id);
      });

      const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 4px; color: #1B1A17;">
          <div style="font-weight: 600; margin-bottom: 2px;">${station.name}</div>
          <div style="color: #6B665C;">${station.agency} &middot; ${station.area}</div>
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
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          filter: 'sepia(0.18) contrast(0.96) brightness(0.98)',
        }}
      />

      {/* Cartographic Legend overlay */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          backgroundColor: 'rgba(244, 239, 230, 0.92)',
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
          {stations.length} CAAQMS STATIONS ACTIVE
        </div>
      </div>
    </div>
  );
};
