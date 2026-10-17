import React, { useState } from 'react';
import type { ModelMetricsData, PooledForwardChainingRow, SpatialHoldoutRow } from '../types';

interface ModelHonestyBoxProps {
  metrics?: ModelMetricsData | null;
}

const DEFAULT_POOLED: PooledForwardChainingRow[] = [
  { lead_hours: 1, n_samples: 132880, mae_model: 5.00, mae_persistence: 5.37, mae_blend: 7.74, mae_cams_bias: 11.25, coverage_overall_pct: 78.7, top_decile_n: 13327, top_decile_mae_model: 17.83, top_decile_mae_persistence: 18.36, top_decile_mae_blend: 21.99, top_decile_mae_cams_bias: 29.04, top_decile_coverage_pct: 71.1 },
  { lead_hours: 6, n_samples: 127734, mae_model: 9.56, mae_persistence: 12.17, mae_blend: 13.99, mae_cams_bias: 12.37, coverage_overall_pct: 77.7, top_decile_n: 12821, top_decile_mae_model: 32.25, top_decile_mae_persistence: 34.45, top_decile_mae_blend: 38.93, top_decile_mae_cams_bias: 32.03, top_decile_coverage_pct: 58.3 },
  { lead_hours: 12, n_samples: 125188, mae_model: 10.60, mae_persistence: 13.98, mae_blend: 15.61, mae_cams_bias: 12.95, coverage_overall_pct: 76.8, top_decile_n: 12567, top_decile_mae_model: 35.77, top_decile_mae_persistence: 38.31, top_decile_mae_blend: 43.34, top_decile_mae_cams_bias: 33.55, top_decile_coverage_pct: 52.4 },
  { lead_hours: 24, n_samples: 122904, mae_model: 10.38, mae_persistence: 11.95, mae_blend: 14.39, mae_cams_bias: 13.82, coverage_overall_pct: 77.0, top_decile_n: 12348, top_decile_mae_model: 35.22, top_decile_mae_persistence: 34.29, top_decile_mae_blend: 39.54, top_decile_mae_cams_bias: 35.56, top_decile_coverage_pct: 56.4 },
  { lead_hours: 48, n_samples: 119698, mae_model: 11.55, mae_persistence: 14.10, mae_blend: 16.27, mae_cams_bias: 14.82, coverage_overall_pct: 76.0, top_decile_n: 12030, top_decile_mae_model: 38.82, top_decile_mae_persistence: 37.92, top_decile_mae_blend: 43.90, top_decile_mae_cams_bias: 35.82, top_decile_coverage_pct: 50.7 },
];

const DEFAULT_SPATIAL: SpatialHoldoutRow[] = [
  { lead_hours: 1, held_out_sites: ['bkc', 'worli', 'deonar'], n_samples: 7886, mae_model: 3.57, mae_without_cams: 3.56, mae_persistence: 3.77, mae_blend: 6.08, mae_cams_bias: 6.19, best_baseline: 'persistence', diff_vs_best_baseline: -0.21, ci_95_diff: [-0.25, -0.17], coverage_overall_pct: 71.0, top_decile_mae_model: 7.91, top_decile_mae_persistence: 7.68, top_decile_mae_blend: 9.09, top_decile_mae_cams_bias: 17.39, top_decile_coverage_pct: 63.3 },
  { lead_hours: 6, held_out_sites: ['bkc', 'worli', 'deonar'], n_samples: 7514, mae_model: 5.92, mae_without_cams: 5.92, mae_persistence: 7.55, mae_blend: 10.37, mae_cams_bias: 6.69, best_baseline: 'cams_bias', diff_vs_best_baseline: -0.77, ci_95_diff: [-1.28, -0.34], coverage_overall_pct: 71.4, top_decile_mae_model: 17.06, top_decile_mae_persistence: 17.92, top_decile_mae_blend: 16.56, top_decile_mae_cams_bias: 18.76, top_decile_coverage_pct: 51.9 },
  { lead_hours: 12, held_out_sites: ['bkc', 'worli', 'deonar'], n_samples: 7293, mae_model: 5.95, mae_without_cams: 6.01, mae_persistence: 7.81, mae_blend: 11.43, mae_cams_bias: 6.74, best_baseline: 'cams_bias', diff_vs_best_baseline: -0.80, ci_95_diff: [-1.18, -0.40], coverage_overall_pct: 74.6, top_decile_mae_model: 17.80, top_decile_mae_persistence: 19.14, top_decile_mae_blend: 17.67, top_decile_mae_cams_bias: 17.72, top_decile_coverage_pct: 52.2 },
  { lead_hours: 24, held_out_sites: ['bkc', 'worli', 'deonar'], n_samples: 7123, mae_model: 5.76, mae_without_cams: 5.93, mae_persistence: 6.39, mae_blend: 10.19, mae_cams_bias: 7.28, best_baseline: 'persistence', diff_vs_best_baseline: -0.64, ci_95_diff: [-0.94, -0.38], coverage_overall_pct: 77.0, top_decile_mae_model: 17.01, top_decile_mae_persistence: 17.72, top_decile_mae_blend: 16.30, top_decile_mae_cams_bias: 19.87, top_decile_coverage_pct: 59.0 },
  { lead_hours: 48, held_out_sites: ['bkc', 'worli', 'deonar'], n_samples: 6887, mae_model: 6.48, mae_without_cams: 6.77, mae_persistence: 7.52, mae_blend: 11.87, mae_cams_bias: 7.80, best_baseline: 'persistence', diff_vs_best_baseline: -1.04, ci_95_diff: [-1.51, -0.54], coverage_overall_pct: 74.7, top_decile_mae_model: 18.92, top_decile_mae_persistence: 22.06, top_decile_mae_blend: 19.07, top_decile_mae_cams_bias: 20.25, top_decile_coverage_pct: 55.8 },
];

export const ModelHonestyBox: React.FC<ModelHonestyBoxProps> = ({ metrics }) => {
  const [activeTab, setActiveTab] = useState<'pooled' | 'spatial' | 'live'>('pooled');

  const pooledRows = metrics?.pooled_forward_chaining || DEFAULT_POOLED;
  const spatialRows = metrics?.spatial_holdout || DEFAULT_SPATIAL;

  const verdictText =
    metrics?.evaluation_verdict?.honest_statement ||
    'The station model beats persistence and CAMS+bias across all horizons (1h to 48h) in forward chaining across 4 chronological folds and maintains skill on strictly held-out spatial sites (BKC, Worli, Deonar). In the top-10% pollution tail, error increases to 32–39 µg/m³ and interval coverage drops to 51–58%, reflecting the fundamental difficulty of extreme episodic spikes.';

  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        backgroundColor: 'var(--paper-2)',
        padding: '24px',
        margin: '32px 0 48px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
            Station Model Benchmark Scorecard
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)', marginTop: '2px' }}>
            24 PHYSICAL CAAQMS GROUND STATIONS &middot; WHOLE-CALENDAR-DAY BLOCK BOOTSTRAP &middot; 80% PREDICTION INTERVALS
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          <button
            onClick={() => setActiveTab('pooled')}
            className="editorial-btn"
            style={{
              fontWeight: activeTab === 'pooled' ? 600 : 400,
              borderBottom: activeTab === 'pooled' ? '2px solid var(--ink)' : '1px solid var(--rule)',
            }}
          >
            POOLED FORWARD CHAINING
          </button>
          <button
            onClick={() => setActiveTab('spatial')}
            className="editorial-btn"
            style={{
              fontWeight: activeTab === 'spatial' ? 600 : 400,
              borderBottom: activeTab === 'spatial' ? '2px solid var(--ink)' : '1px solid var(--rule)',
            }}
          >
            CLEAN SPATIAL HOLDOUT
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className="editorial-btn"
            style={{
              fontWeight: activeTab === 'live' ? 600 : 400,
              borderBottom: activeTab === 'live' ? '2px solid var(--ink)' : '1px solid var(--rule)',
            }}
          >
            LIVE LOGGED RECORD
          </button>
        </div>
      </div>

      {activeTab === 'pooled' ? (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '12px' }}>
            FORWARD-CHAINING POOLED OVER 4 CHRONOLOGICAL FOLDS (POST-MONSOON, WINTER, PRE-MONSOON, MONSOON) &middot; TOTAL N = 132,880 PER-STATION HOURS
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)', textAlign: 'left', color: 'var(--ink-2)', fontSize: '11px' }}>
                  <th style={{ padding: '8px 4px' }}>LEAD HORIZON</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>TEST N</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>STATION MODEL</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>PERSISTENCE</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>DIURNAL BLEND</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>CAMS + 24H BIAS</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>80% INTERVAL COV</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>VERDICT</th>
                </tr>
              </thead>
              <tbody>
                {pooledRows.map((row) => {
                  const beatsPersist = row.mae_model < row.mae_persistence;
                  const beatsCams = row.mae_model < row.mae_cams_bias;
                  return (
                    <React.Fragment key={row.lead_hours}>
                      <tr style={{ borderBottom: '1px solid var(--rule)', backgroundColor: 'var(--paper)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>+{row.lead_hours}-Hour Ahead (t+{row.lead_hours})</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.n_samples.toLocaleString()}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{row.mae_model.toFixed(2)} µg/m³</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.mae_persistence.toFixed(2)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.mae_blend.toFixed(2)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.mae_cams_bias.toFixed(2)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{row.coverage_overall_pct.toFixed(1)}%</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, borderBottom: '1px solid var(--ink)' }}>
                            {beatsPersist && beatsCams ? 'MODEL WINS' : 'COMPETITIVE'}
                          </span>
                        </td>
                      </tr>
                      {/* Top-10% Tail Degradation Row */}
                      <tr style={{ borderBottom: '1px dashed var(--rule)', fontSize: '11px', color: 'var(--ink-2)', backgroundColor: 'var(--paper-2)' }}>
                        <td colSpan={2} style={{ padding: '5px 8px', fontStyle: 'italic' }}>
                          ↳ Top-10% Tail Pollution (N = {row.top_decile_n.toLocaleString()}):
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                          {row.top_decile_mae_model.toFixed(2)} µg/m³
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                          {row.top_decile_mae_persistence.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                          {row.top_decile_mae_blend.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                          {row.top_decile_mae_cams_bias.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'right', color: row.top_decile_coverage_pct < 60 ? '#D32F2F' : 'var(--ink)' }}>
                          {row.top_decile_coverage_pct.toFixed(1)}% cov
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'right', fontStyle: 'italic' }}>
                          {row.top_decile_mae_model <= row.top_decile_mae_persistence ? 'Ties / Beats Persist' : 'Tail Degradation'}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'spatial' ? (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '12px' }}>
            CLEAN SPATIAL HOLDOUT &middot; TRAINED STRICTLY PRIOR TO TEST WINDOW ON NON-HELD-OUT SITES &middot; TESTED ON BKC, WORLI, DEONAR (JUN 1 – SEP 30, 2026)
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)', textAlign: 'left', color: 'var(--ink-2)', fontSize: '11px' }}>
                  <th style={{ padding: '8px 4px' }}>LEAD HORIZON</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>TEST N</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>STATION MODEL</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>NO CAMS(t+h)</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>PERSISTENCE</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>CAMS + 24H BIAS</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Δ vs BEST BASE [95% CI]</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>80% COV</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>TOP-10% MAE</th>
                </tr>
              </thead>
              <tbody>
                {spatialRows.map((row) => (
                  <tr key={row.lead_hours} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>+{row.lead_hours}-Hour Ahead (t+{row.lead_hours})</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.n_samples.toLocaleString()}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{row.mae_model.toFixed(2)} µg/m³</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.mae_without_cams.toFixed(2)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{row.mae_persistence.toFixed(2)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.mae_cams_bias.toFixed(2)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>
                      {row.diff_vs_best_baseline > 0 ? `+${row.diff_vs_best_baseline.toFixed(2)}` : row.diff_vs_best_baseline.toFixed(2)} [{row.ci_95_diff[0].toFixed(2)}, {row.ci_95_diff[1].toFixed(2)}]
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{row.coverage_overall_pct.toFixed(1)}%</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>{row.top_decile_mae_model.toFixed(2)} ({row.top_decile_coverage_pct.toFixed(0)}% cov)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '12px' }}>
            LIVE TELEMETRY LOG BUFFER &middot; CONTINUOUSLY COMMITTED TO <code>data</code> BRANCH &middot; SCORED OUT-OF-SAMPLE UPON SENSOR ARRIVAL
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ink)', textAlign: 'left', color: 'var(--ink-2)', fontSize: '11px' }}>
                  <th style={{ padding: '8px 4px' }}>LEAD HORIZON</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>VERIFIED ARRIVALS (N)</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>STATION MODEL MAE</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>CAMS ENSEMBLE MAE</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {[1, 6, 12, 24, 48].map((h) => (
                  <tr key={h} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>+{h}-Hour Ahead (t+{h})</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>
                      {metrics?.live_record?.horizons?.[h]?.n ?? 'Collecting'}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>
                      {metrics?.live_record?.horizons?.[h]?.mae_atlas ? `${metrics.live_record.horizons[h].mae_atlas} µg/m³` : '—'}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>
                      {metrics?.live_record?.horizons?.[h]?.mae_cams ? `${metrics.live_record.horizons[h].mae_cams} µg/m³` : '—'}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--ink-2)' }}>
                      {metrics?.live_record?.horizons?.[h]?.n > 0 ? 'VERIFIED' : 'PENDING MATURITY'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', backgroundColor: 'var(--paper)', padding: '12px', border: '1px dashed var(--rule)', marginBottom: '16px' }}>
            <strong>Out-of-Sample Telemetry Buffer:</strong> Forecast runs are logged each time predictions are issued to <code>forecast_log.csv</code> on branch <code>data</code>. When future telemetry arrives, mature horizons are evaluated out-of-sample. No simulated or manufactured numbers are displayed.
          </div>
        </div>
      )}

      {/* Disclosures */}
      <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '16px', marginTop: '8px' }}>
        <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '14px', lineHeight: 1.5, color: 'var(--ink-2)', margin: '0 0 8px 0' }}>
          <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>Empirical Verdict:</strong> {verdictText}
        </p>
        <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '13px', lineHeight: 1.45, color: 'var(--ink-2)', margin: 0 }}>
          <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>Data Limitations:</strong> Due to a CPCB/MPCB historical data hiatus in OpenAQ between Nov 1, 2022 and Feb 17, 2025, exactly ONE continuous winter (2025–2026) exists for multi-station evaluation. At inference time, weather covariates are drawn from operational NWP forecasts (Open-Meteo) rather than reanalysis.
        </p>
      </div>
    </div>
  );
};

