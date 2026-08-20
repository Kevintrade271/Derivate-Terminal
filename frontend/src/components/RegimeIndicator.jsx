export default function RegimeIndicator({ regime }) {
  const isPositive = regime === 'POSITIVE';

  return (
    <div className={`regime-badge ${isPositive ? 'positive' : 'negative'}`}>
      <span className="pulse-dot" />
      {isPositive ? 'POSITIVE γ' : 'NEGATIVE γ'}
    </div>
  );
}
