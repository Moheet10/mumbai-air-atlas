import React from 'react';
import type { CurrentConditionsResponse } from '../types';
import { calculatePM25AQI, getWindCompass } from '../lib/aqi';
import { CountUp } from './CountUp';
import { BlurText } from './BlurText';
import { Thermometer, Droplets, Wind } from 'lucide-react';
import { AtmosphericAura } from './AtmosphericAura';

interface HeroAQIProps {
  data: CurrentConditionsResponse | null;
  loading: boolean;
  theme?: 'light' | 'dark';
}

export const HeroAQI: React.FC<HeroAQIProps> = ({ data, loading, theme = 'light' }) => {
  if (loading || !data) {
    return (
      <section style={{ padding: '64px 0 40px', borderBottom: '1px solid var(--rule)' }}>
        <div className="container">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)', marginBottom: '12px', letterSpacing: '0.08em' }}>
            MEASURING ATMOSPHERIC DENSITY...
          </div>
          <div style={{ height: '96px', width: '240px', backgroundColor: 'var(--paper-2)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }} />
          <div style={{ height: '24px', width: '480px', backgroundColor: 'var(--paper-2)', borderRadius: 'var(--radius-sm)' }} />
        </div>
      </section>
    );
  }

  const isSnapshot = data.data_mode === 'snapshot';
  const isSample = data.data_mode === 'sample' || data.primary_pm25.is_sample;
  const pm25 = data.primary_pm25.value ?? 45.0;
  const pm10 = data.other_pollutants.find((p) => p.parameter === 'pm10')?.value;
  const { aqi, category } = calculatePM25AQI(pm25);
  const locationName = data.selected_station ? data.selected_station.name : data.location_name;
  const windDir = getWindCompass(data.weather.wind_direction_deg);

  // Position along 0-500 scale
  const gaugePercent = Math.min(100, Math.max(0, (aqi / 500) * 100));

  // Generate plain, dry, editorial sentence
  const summarySentence = isSnapshot
    ? `${locationName} recorded PM2.5 at ${pm25.toFixed(1)} µg/m³ with ${data.weather.temperature_c.toFixed(1)}°C and ${data.weather.wind_speed_kmh.toFixed(1)} km/h winds from the ${windDir}, placing particulate density in the ${category.label} sub-index band (frozen snapshot archive as of 14 Oct 2026).`
    : isSample
    ? `${locationName} simulated PM2.5 baseline at ${pm25.toFixed(1)} µg/m³ with ${data.weather.temperature_c.toFixed(1)}°C and ${data.weather.wind_speed_kmh.toFixed(1)} km/h winds from the ${windDir}, placing local air in the ${category.label} sub-index band (official CPCB AQI requires 24h average).`
    : `${locationName} reported PM2.5 at ${pm25.toFixed(1)} µg/m³ with ${data.weather.temperature_c.toFixed(1)}°C and ${data.weather.wind_speed_kmh.toFixed(1)} km/h winds from the ${windDir}, placing current particulate density in the ${category.label} sub-index band (official CPCB AQI requires 24h average).`;

  return (
    <section
      style={{
        position: 'relative',
        padding: '52px 0 44px',
        borderBottom: '1px solid var(--rule)',
        overflow: 'hidden',
      }}
    >
      {/* Editorial Atmospheric Gradient Aura (Rich golden amber aura matching the photo) */}
      <AtmosphericAura
        color={theme === 'dark' && category.label === 'Moderate' ? '#ECC254' : category.colorHex}
        theme={theme}
        position="top-right"
        secondaryPosition="center-left"
        hasWash={true}
      />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Editorial Sub-label & Provenance Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '3px',
                background: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              ISSUE № 01
            </span>
            <span>&middot;</span>
            <span>MUMBAI IN PARTICULATE</span>
            <span>&middot;</span>
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
              {locationName.toUpperCase()}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--ink-2)',
              letterSpacing: '0.04em',
            }}
          >
            DATA PROVENANCE:{' '}
            <span
              style={{
                fontWeight: 600,
                color: 'var(--ink)',
                paddingBottom: '1px',
                borderBottom: '1px solid var(--ink)',
              }}
            >
              {isSnapshot
                ? 'FROZEN ARCHIVE SNAPSHOT (14 OCT 2026)'
                : isSample
                ? 'SYNTHETIC BASELINE (DEMO MODE)'
                : data.primary_pm25.provenance === 'observed'
                ? 'PHYSICAL GROUND SENSOR (OPENAQ)'
                : 'COPERNICUS CAMS MODEL GRID'}
            </span>
          </div>
        </div>

        {/* Hero AQI Presentation Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px',
            alignItems: 'center',
            marginBottom: '28px',
          }}
        >
          {/* Left Hero AQI Number & Category */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px', flexWrap: 'wrap' }}>
            <div
              className="data-num"
              style={{
                fontSize: '96px',
                lineHeight: 0.9,
                fontWeight: 500,
                letterSpacing: '-0.04em',
                color: 'var(--ink)',
              }}
            >
              <CountUp to={aqi} from={0} duration={1.2} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: category.colorHex,
                    boxShadow: theme === 'dark'
                      ? `0 0 14px ${category.colorHex}, 0 0 24px ${category.colorHex}66`
                      : `0 1px 4px rgba(27, 26, 23, 0.28), 0 0 10px ${category.colorHex}99`,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-editorial)',
                    fontSize: '34px',
                    fontWeight: 500,
                    lineHeight: 1,
                    color: 'var(--ink)',
                  }}
                >
                  {category.label}
                </span>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--ink-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span>CPCB SUB-INDEX</span>
                <span>&middot;</span>
                <span>
                  PM2.5: <strong style={{ color: 'var(--ink)' }}>{pm25.toFixed(1)} µg/m³</strong>
                </span>
                {pm10 != null && (
                  <>
                    <span>&middot;</span>
                    <span>
                      PM10: <strong style={{ color: 'var(--ink)' }}>{pm10.toFixed(1)} µg/m³</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: CPCB AQI Spectrum Bar with Position Needle */}
          <div
            className="atlas-card"
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--paper-2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                marginBottom: '10px',
                color: 'var(--ink-2)',
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                CPCB AQI SPECTRUM TRACK
              </span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                {aqi} / 500 &middot; {category.label.toUpperCase()}
              </span>
            </div>

            {/* Continuous multi-segment spectrum bar */}
            <div style={{ position: 'relative', margin: '14px 0 8px', paddingTop: '10px' }}>
              {/* Needle indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: '-4px',
                  left: `${gaugePercent}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: 'left 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: category.colorHex,
                    border: '2px solid var(--paper)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}
                />
                <div
                  style={{
                    width: '2px',
                    height: '12px',
                    backgroundColor: 'var(--ink)',
                  }}
                />
              </div>

              {/* Spectrum Track with 6 CPCB category bands */}
              <div
                style={{
                  display: 'flex',
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  gap: '2px',
                  backgroundColor: 'var(--paper)',
                }}
              >
                {/* 0-50 Good (10%) */}
                <div style={{ flex: '50', backgroundColor: 'var(--aqi-good)' }} title="Good (0–50)" />
                {/* 51-100 Satisfactory (10%) */}
                <div style={{ flex: '50', backgroundColor: 'var(--aqi-satisfactory)' }} title="Satisfactory (51–100)" />
                {/* 101-200 Moderate (20%) */}
                <div style={{ flex: '100', backgroundColor: 'var(--aqi-moderate)' }} title="Moderate (101–200)" />
                {/* 201-300 Poor (20%) */}
                <div style={{ flex: '100', backgroundColor: 'var(--aqi-poor)' }} title="Poor (201–300)" />
                {/* 301-400 Very Poor (20%) */}
                <div style={{ flex: '100', backgroundColor: 'var(--aqi-very-poor)' }} title="Very Poor (301–400)" />
                {/* 401-500 Severe (20%) */}
                <div style={{ flex: '100', backgroundColor: 'var(--aqi-severe)' }} title="Severe (401–500)" />
              </div>

              {/* Breakpoint labels */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--ink-2)',
                  marginTop: '6px',
                }}
              >
                <span>0</span>
                <span>50</span>
                <span>100</span>
                <span>200</span>
                <span>300</span>
                <span>400</span>
                <span>500+</span>
              </div>
            </div>

            {/* Quick Surface Conditions Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Thermometer size={14} style={{ color: 'var(--ink-2)' }} />
                <span>
                  <strong style={{ color: 'var(--ink)' }}>{data.weather.temperature_c.toFixed(1)}°C</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Droplets size={14} style={{ color: 'var(--ink-2)' }} />
                <span>
                  <strong style={{ color: 'var(--ink)' }}>{data.weather.relative_humidity_pct.toFixed(0)}%</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wind size={14} style={{ color: 'var(--ink-2)' }} />
                <span>
                  <strong style={{ color: 'var(--ink)' }}>
                    {data.weather.wind_speed_kmh.toFixed(1)} km/h {windDir}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial summary paragraph */}
        <p
          style={{
            fontFamily: 'var(--font-editorial)',
            fontSize: '22px',
            lineHeight: 1.45,
            maxWidth: '72ch',
            color: 'var(--ink)',
            marginBottom: '16px',
          }}
        >
          <BlurText text={summarySentence} />
        </p>

        {/* Timestamp & Source Line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--ink-2)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {isSample ? 'SAMPLE TIMESTAMP:' : 'RECORDED AT:'}{' '}
            <strong style={{ color: 'var(--ink)' }}>{data.primary_pm25.timestamp_local}</strong>
          </span>
          <span>&middot;</span>
          <span>
            SENSOR SOURCE: <strong style={{ color: 'var(--ink)' }}>{data.primary_pm25.source_name}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};

