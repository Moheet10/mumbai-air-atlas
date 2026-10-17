export interface AQICategory {
  label: string;
  colorVar: string;
  colorHex: string;
  min: number;
  max: number;
}

export const CPCB_CATEGORIES: AQICategory[] = [
  { label: 'Good', colorVar: 'var(--aqi-good)', colorHex: '#4C8C6B', min: 0, max: 50 },
  { label: 'Satisfactory', colorVar: 'var(--aqi-satisfactory)', colorHex: '#A3B56A', min: 51, max: 100 },
  { label: 'Moderate', colorVar: 'var(--aqi-moderate)', colorHex: '#E0B341', min: 101, max: 200 },
  { label: 'Poor', colorVar: 'var(--aqi-poor)', colorHex: '#D9772B', min: 201, max: 300 },
  { label: 'Very Poor', colorVar: 'var(--aqi-very-poor)', colorHex: '#B53A2D', min: 301, max: 400 },
  { label: 'Severe', colorVar: 'var(--aqi-severe)', colorHex: '#6E1F2B', min: 401, max: 500 },
];

/**
 * Calculates CPCB Sub-Index for PM2.5 (24-hour concentration in µg/m³)
 * Breakpoints defined by Central Pollution Control Board (CPCB) India:
 * 0 - 30 -> 0 - 50 (Good)
 * 31 - 60 -> 51 - 100 (Satisfactory)
 * 61 - 90 -> 101 - 200 (Moderate)
 * 91 - 120 -> 201 - 300 (Poor)
 * 121 - 250 -> 301 - 400 (Very Poor)
 * 250+ -> 401 - 500 (Severe)
 */
export function calculatePM25AQI(pm25: number): { aqi: number; category: AQICategory } {
  let aqi: number;

  if (pm25 <= 30) {
    aqi = Math.round((50 / 30) * pm25);
  } else if (pm25 <= 60) {
    aqi = Math.round(51 + ((100 - 51) / (60 - 31)) * (pm25 - 31));
  } else if (pm25 <= 90) {
    aqi = Math.round(101 + ((200 - 101) / (90 - 61)) * (pm25 - 61));
  } else if (pm25 <= 120) {
    aqi = Math.round(201 + ((300 - 201) / (120 - 91)) * (pm25 - 91));
  } else if (pm25 <= 250) {
    aqi = Math.round(301 + ((400 - 301) / (250 - 121)) * (pm25 - 121));
  } else {
    aqi = Math.min(500, Math.round(401 + ((500 - 401) / (350 - 250)) * (pm25 - 250)));
  }

  const category = getAQICategory(aqi);
  return { aqi, category };
}

export function getAQICategory(aqi: number): AQICategory {
  if (aqi <= 50) return CPCB_CATEGORIES[0];
  if (aqi <= 100) return CPCB_CATEGORIES[1];
  if (aqi <= 200) return CPCB_CATEGORIES[2];
  if (aqi <= 300) return CPCB_CATEGORIES[3];
  if (aqi <= 400) return CPCB_CATEGORIES[4];
  return CPCB_CATEGORIES[5];
}

export function getWindCompass(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return directions[index];
}
