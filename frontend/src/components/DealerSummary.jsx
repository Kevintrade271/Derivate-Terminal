export default function DealerSummary({ gexData, dexData, vcData }) {
  if (!gexData && !dexData && !vcData) {
    return (
      <div className="card">
        <div className="card-title"><span className="dot amber" /> Dealer Positioning</div>
        <div className="loading-container" style={{ padding: '24px' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Dealer Gamma',
      value: gexData?.total_gex,
      unit: 'B$',
      longShort: gexData?.total_gex >= 0 ? 'LONG' : 'SHORT',
      color: gexData?.total_gex >= 0 ? '#00e676' : '#ff1744',
      bgColor: gexData?.total_gex >= 0 ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)',
      description: gexData?.total_gex >= 0 ? 'Mean-reversion (dealers venden rallies, compran dips)' : 'Amplificación (dealers amplifican movimientos)',
    },
    {
      label: 'Dealer Delta',
      value: dexData?.total_dex,
      unit: 'B$',
      longShort: dexData?.total_dex >= 0 ? 'LONG' : 'SHORT',
      color: dexData?.total_dex >= 0 ? '#00e676' : '#ff1744',
      bgColor: dexData?.total_dex >= 0 ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)',
      description: dexData?.total_dex >= 0 ? 'Dealers necesitan vender para cubrir' : 'Dealers necesitan comprar para cubrir',
    },
    {
      label: 'Net Vanna',
      value: vcData?.total_vanna,
      unit: 'B$',
      longShort: vcData?.total_vanna >= 0 ? 'POSITIVO' : 'NEGATIVO',
      color: vcData?.total_vanna >= 0 ? '#b388ff' : '#7c4dff',
      bgColor: vcData?.total_vanna >= 0 ? 'rgba(179,136,255,0.08)' : 'rgba(124,77,255,0.08)',
      description: vcData?.total_vanna >= 0 ? 'IV↓ → dealers compran subyacente' : 'IV↑ → dealers venden subyacente',
    },
    {
      label: 'Net Charm',
      value: vcData?.total_charm,
      unit: 'B$',
      longShort: vcData?.total_charm >= 0 ? 'POSITIVO' : 'NEGATIVO',
      color: vcData?.total_charm >= 0 ? '#ff80ab' : '#f50057',
      bgColor: vcData?.total_charm >= 0 ? 'rgba(255,128,171,0.08)' : 'rgba(245,0,87,0.08)',
      description: vcData?.total_charm >= 0 ? 'Theta decay → dealers compran' : 'Theta decay → dealers venden',
    },
  ];

  return (
    <div className="card fade-in" id="dealer-summary-card">
      <div className="card-title"><span className="dot amber" /> Dealer Positioning Summary</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px',
            background: m.bgColor,
            borderRadius: '8px',
            borderLeft: `3px solid ${m.color}`,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px',
              }}>
                {m.label}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                {m.description}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: m.color, marginBottom: '2px',
                padding: '2px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
              }}>
                {m.longShort}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                color: 'var(--text-bright)',
              }}>
                {m.value != null ? (m.value >= 0 ? '+' : '') + m.value.toFixed(2) : '—'} {m.unit}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
