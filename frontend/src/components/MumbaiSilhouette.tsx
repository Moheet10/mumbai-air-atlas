import React from 'react';

interface MumbaiSilhouetteProps {
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Editorial Mumbai Coastal Silhouette
 * 
 * Features iconic coastal Mumbai landmarks along the Arabian Sea:
 * - Bandra-Worli Sea Link cable-stayed diamond towers, stay cables & viaduct
 * - Gateway of India Indo-Saracenic arch & turrets
 * - South Mumbai / Lower Parel skyline towers & Malabar Hill coastal ridge
 * 
 * In Day mode: Darkened, crisp ink silhouette grounded against paper.
 * In Night mode: Lightened, luminous silhouette with glowing cable stays & aviation warning beacons.
 */
export const MumbaiSilhouette: React.FC<MumbaiSilhouetteProps> = ({
  theme = 'light',
  className = '',
  style = {},
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '130px',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 1440 130"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <defs>
          {/* Subtle vertical fade so silhouette dissolves upwards into atmospheric air */}
          <linearGradient id="silhouetteGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity={isDark ? 0.05 : 0.04} />
            <stop offset="60%" stopColor="var(--ink)" stopOpacity={isDark ? 0.16 : 0.12} />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity={isDark ? 0.24 : 0.18} />
          </linearGradient>

          {/* Water reflection subtle gradient */}
          <linearGradient id="waterlineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? 'rgba(255, 245, 220, 0.25)' : 'rgba(27, 26, 23, 0.20)'} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* --- Background Layer: Distant Malabar Hill Ridge & Coastal Headland --- */}
        <path
          d="M0,130 L0,105 Q120,95 240,108 T480,102 T720,112 T960,100 T1200,106 T1440,98 L1440,130 Z"
          fill="var(--ink)"
          opacity={isDark ? 0.08 : 0.06}
        />

        {/* --- Midground Layer: Mumbai Skyline (Gateway, Towers, Lower Parel) --- */}
        <path
          d={`
            M0,130
            L0,118
            L40,118 L40,95 L65,95 L65,118
            L85,118 L85,82 L110,82 L110,118
            L130,118 L130,65 L155,65 L155,118
            L175,118 L175,88 L200,88 L200,118
            L220,118 L220,102 L245,102 L245,118
            /* Gateway of India Landmark (X: 280-340) */
            L275,118 L275,92 L285,92 L285,84 L290,84 L290,92 L295,92
            L295,80 Q305,74 315,80 L315,92
            L320,92 L320,84 L325,84 L325,92 L335,92 L335,118
            /* Coastal Commercial High-Rises */
            L355,118 L355,70 L375,70 L375,58 L390,58 L390,70 L400,70 L400,118
            L420,118 L420,85 L445,85 L445,118
            L470,118 L470,62 L485,62 L485,50 L495,50 L495,62 L510,62 L510,118
            L535,118 L535,94 L560,94 L560,118
            /* Viaduct approach */
            L590,118 L590,108 L650,108 L650,118
            /* Right Side Coastal Towers (Worli / Mahim coast) */
            L1080,118 L1080,88 L1110,88 L1110,118
            L1130,118 L1130,55 L1155,55 L1155,42 L1165,42 L1165,55 L1180,55 L1180,118
            L1200,118 L1200,75 L1225,75 L1225,118
            L1250,118 L1250,60 L1270,60 L1270,118
            L1295,118 L1295,92 L1320,92 L1320,118
            L1340,118 L1340,78 L1365,78 L1365,118
            L1385,118 L1385,98 L1440,98
            L1440,130 Z
          `}
          fill="url(#silhouetteGrad)"
        />

        {/* --- Foreground Layer: Iconic Bandra-Worli Sea Link Bridge --- */}
        {/* Viaduct Bridge Deck (curves across Mahim Bay X: 640 to 1080) */}
        <path
          d="M620,118 L1080,118 L1080,122 L620,122 Z"
          fill="var(--ink)"
          opacity={isDark ? 0.35 : 0.28}
        />

        {/* Bridge Piers under deck */}
        {[660, 710, 760, 810, 860, 910, 960, 1010, 1060].map((x) => (
          <rect
            key={x}
            x={x - 2.5}
            y={122}
            width={5}
            height={8}
            fill="var(--ink)"
            opacity={isDark ? 0.40 : 0.32}
          />
        ))}

        {/* Cable-Stayed Diamond Pylon Tower 1 (X: 785) */}
        <polygon
          points="782,122 787,22 789,22 794,122"
          fill="var(--ink)"
          opacity={isDark ? 0.50 : 0.42}
        />
        {/* Tower 1 Crossbeam */}
        <rect
          x={778}
          y={62}
          width={20}
          height={3}
          fill="var(--ink)"
          opacity={isDark ? 0.55 : 0.45}
        />

        {/* Cable-Stayed Diamond Pylon Tower 2 (X: 935) */}
        <polygon
          points="932,122 937,28 939,28 944,122"
          fill="var(--ink)"
          opacity={isDark ? 0.50 : 0.42}
        />
        {/* Tower 2 Crossbeam */}
        <rect
          x={928}
          y={66}
          width={20}
          height={3}
          fill="var(--ink)"
          opacity={isDark ? 0.55 : 0.45}
        />

        {/* Tower 1 Cable Stays (Fan Array radiating from pylon top to bridge deck) */}
        {[
          { x: 710, y: 118 },
          { x: 735, y: 118 },
          { x: 760, y: 118 },
          { x: 810, y: 118 },
          { x: 835, y: 118 },
          { x: 860, y: 118 },
        ].map((anchor, i) => (
          <line
            key={`t1-cable-${i}`}
            x1={788}
            y1={26 + i * 4}
            x2={anchor.x}
            y2={anchor.y}
            stroke={isDark ? 'rgba(255, 245, 220, 0.40)' : 'var(--ink)'}
            strokeWidth={0.8}
            opacity={isDark ? 0.45 : 0.26}
          />
        ))}

        {/* Tower 2 Cable Stays (Fan Array) */}
        {[
          { x: 865, y: 118 },
          { x: 890, y: 118 },
          { x: 915, y: 118 },
          { x: 960, y: 118 },
          { x: 985, y: 118 },
          { x: 1010, y: 118 },
        ].map((anchor, i) => (
          <line
            key={`t2-cable-${i}`}
            x1={938}
            y1={32 + i * 4}
            x2={anchor.x}
            y2={anchor.y}
            stroke={isDark ? 'rgba(255, 245, 220, 0.40)' : 'var(--ink)'}
            strokeWidth={0.8}
            opacity={isDark ? 0.45 : 0.26}
          />
        ))}

        {/* Night-Only Luminous Aviation Warning Beacons (Red LED atop Sea Link Towers & Tallest High-Rises) */}
        {isDark && (
          <g>
            {/* Tower 1 Top Beacon */}
            <circle cx={788} cy={22} r={2} fill="#FF5252" />
            <circle cx={788} cy={22} r={4} fill="#FF5252" opacity={0.4} />
            {/* Tower 2 Top Beacon */}
            <circle cx={938} cy={28} r={2} fill="#FF5252" />
            <circle cx={938} cy={28} r={4} fill="#FF5252" opacity={0.4} />
            {/* High-Rise Antenna Lights */}
            <circle cx={490} cy={48} r={1.5} fill="#FFE082" opacity={0.9} />
            <circle cx={1160} cy={40} r={1.5} fill="#FFE082" opacity={0.9} />
            {/* Bridge deck amber traffic pulse line */}
            <line
              x1={640}
              y1={118}
              x2={1080}
              y2={118}
              stroke="#FFE082"
              strokeWidth={0.8}
              opacity={0.35}
            />
          </g>
        )}

        {/* Hairline Sea Waterline at bottom */}
        <line
          x1={0}
          y1={129}
          x2={1440}
          y2={129}
          stroke="var(--rule)"
          strokeWidth={1}
          opacity={isDark ? 0.7 : 0.6}
        />
      </svg>
    </div>
  );
};

export default MumbaiSilhouette;
