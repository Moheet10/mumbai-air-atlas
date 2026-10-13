import type { CurrentConditionsResponse } from '../types';
import { calculatePM25AQI, getWindCompass } from '../lib/aqi';

interface HeroAQIProps {
  data: CurrentConditionsResponse | null;
  loading: boolean;
}

export const HeroAQI: React.FC<HeroAQIProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <section style={{ padding: '64px 0 40px', borderBottom: '1px solid var(--rule)' }}>
        <div className="container">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)', marginBottom: '8px' }}>
            MEASURING ATMOSPHERIC DENSITY...
          </div>
          <div style={{ height: '88px', width: '200px', backgroundColor: 'var(--paper-2)', marginBottom: '16px' }} />
          <div style={{ height: '24px', width: '450px', backgroundColor: 'var(--paper-2)' }} />
        </div>
      </section>
    );
  }

  const pm25 = data.primary_pm25.value ?? 45.0;
  const { aqi, category } = calculatePM25AQI(pm25);
  const locationName = data.selected_station ? data.selected_station.name : data.location_name;
  const windDir = getWindCompass(data.weather.wind_direction_deg);

  // Generate plain, dry, editorial sentence
  const summarySentence = `${locationName} recorded PM2.5 at ${pm25.toFixed(1)} µg/m³ with ${data.weather.temperature_c.toFixed(1)}°C and ${data.weather.wind_speed_kmh.toFixed(1)} km/h winds from the ${windDir}, placing local air in the ${category.label} band.`;

  return (
    <section style={{ padding: '56px 0 40px', borderBottom: '1px solid var(--rule)' }}>
      <div className="container">
        {/* Editorial Sub-label & Provenance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
            ISSUE № 01 &middot; MUMBAI IN PARTICULATE &middot; {locationName.toUpperCase()}
          </div>
          
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)' }}>
            DATA ORIGIN:{' '}
            <span style={{ fontWeight: 600, borderBottom: '1px solid var(--ink)' }}>
              {data.primary_pm25.provenance === 'observed'
                ? 'PHYSICAL GROUND SENSOR (OPENAQ)'
                : data.primary_pm25.provenance === 'observed_sample'
                ? 'CAAQMS MONITOR (CALIBRATED FIELD BASELINE)'
                : 'COPERNICUS CAMS MODEL GRID'}
            </span>
          </div>
        </div>

        {/* Hero Number & Category */}
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '24px', marginBottom: '16px' }}>
          <div
            className="data-num"
            style={{
              fontSize: '88px',
              lineHeight: 0.95,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
            }}
          >
            {aqi}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  backgroundColor: category.colorHex,
                  border: '1px solid var(--ink)',
                }}
              />
              <span style={{ fontFamily: 'var(--font-editorial)', fontSize: '32px', fontWeight: 500, color: 'var(--ink)' }}>
                {category.label}
              </span>
            </div>
            
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--ink-2)', marginTop: '4px' }}>
              INDIAN CPCB AQI &middot; PM2.5: {pm25.toFixed(1)} µg/m³ &middot; PM10:{' '}
              {data.other_pollutants.find(p => p.parameter === 'pm10')?.value?.toFixed(1) ?? '—'} µg/m³
            </div>
          </div>
        </div>

        {/* Plain-English summary & timestamp */}
        <p
          style={{
            fontFamily: 'var(--font-editorial)',
            fontSize: '22px',
            lineHeight: 1.4,
            maxWidth: '68ch',
            color: 'var(--ink)',
            marginBottom: '16px',
          }}
        >
          {summarySentence}
        </p>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)' }}>
          OBSERVED AT {data.primary_pm25.timestamp_local} &middot; SOURCE: {data.primary_pm25.source_name}
        </div>
      </div>
    </section>
  );
};
