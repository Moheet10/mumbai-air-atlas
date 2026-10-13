import React from 'react';

export const ModelHonestyBox: React.FC = () => {
  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        backgroundColor: 'var(--paper-2)',
        padding: '24px',
        margin: '32px 0 48px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
            Model Scorecard &amp; Methodology Disclosure
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)', marginTop: '2px' }}>
            STATISTICAL INTEGRITY &middot; ZERO LEAKAGE EVALUATION
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
          TARGET: PM2.5 (µg/m³) &middot; SPLIT: CHRONOLOGICAL 80/20
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div style={{ borderLeft: '2px solid var(--ink)', paddingLeft: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            24-Hour Persistence Baseline
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', margin: '4px 0' }}>
            10.02 <span style={{ fontSize: '13px', fontWeight: 400 }}>µg/m³ MAE</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
            RMSE: 12.01 µg/m³ &middot; Lag-24h
          </div>
        </div>

        <div style={{ borderLeft: '2px solid var(--ink)', paddingLeft: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            1-Hour Persistence Baseline
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', margin: '4px 0' }}>
            3.60 <span style={{ fontSize: '13px', fontWeight: 400 }}>µg/m³ MAE</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
            RMSE: 4.44 µg/m³ &middot; Lag-1h
          </div>
        </div>

        <div style={{ borderLeft: '2px dashed var(--ink-2)', paddingLeft: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            Atlas LightGBM Regressor
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 500, color: 'var(--ink-2)', margin: '6px 0' }}>
            IN PROGRESS (WEEK 2)
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
            Training pipeline milestone pending
          </div>
        </div>
      </div>

      <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '15px', lineHeight: 1.5, color: 'var(--ink-2)', margin: 0 }}>
        <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>Evaluation rule:</strong> In accordance with our build plan, future atmospheric forecasts must strictly beat the 24-hour diurnal persistence baseline (MAE &le; 10.02 µg/m³) on a strictly held-out chronological test set. If our model fails to beat this baseline, we disclose the shortfall rather than fabricating model performance.
      </p>
    </div>
  );
};
