import { formatNumber, formatUSD } from '../utils/fileUtils';

export default function StatsPanel({ wallets, bnbPrice }) {
  const loaded = wallets.filter(w => w.status === 'success');
  const withBalance = loaded.filter(w => (w.bnb || 0) > 0 || (w.usdt || 0) > 0 || (w.usdc || 0) > 0);
  const totalBnb = loaded.reduce((s, w) => s + (w.bnb || 0), 0);
  const totalUsdt = loaded.reduce((s, w) => s + (w.usdt || 0), 0);
  const totalUsdc = loaded.reduce((s, w) => s + (w.usdc || 0), 0);
  const totalUsd = totalBnb * (bnbPrice || 0) + totalUsdt + totalUsdc;

  const stats = [
    {
      key: 'bnb',
      icon: '🟡',
      label: 'Tổng BNB',
      value: formatNumber(totalBnb, 4),
      sub: bnbPrice ? `≈ ${formatUSD(totalBnb * bnbPrice)}` : 'Giá BNB chưa tải',
      className: 'bnb',
    },
    {
      key: 'usdt',
      icon: '💚',
      label: 'Tổng USDT',
      value: formatNumber(totalUsdt, 2),
      sub: '≈ ' + formatUSD(totalUsdt),
      className: 'usdt',
    },
    {
      key: 'usdc',
      icon: '🔵',
      label: 'Tổng USDC',
      value: formatNumber(totalUsdc, 2),
      sub: '≈ ' + formatUSD(totalUsdc),
      className: 'usdc',
    },
    {
      key: 'total-usd',
      icon: '💰',
      label: 'Tổng USD (ước tính)',
      value: formatUSD(totalUsd),
      sub: `BNB + USDT + USDC`,
      className: 'total-usd',
    },
    {
      key: 'wallets',
      icon: '👛',
      label: 'Tổng số ví',
      value: wallets.length,
      sub: `${loaded.length} đã load`,
      className: 'wallets',
    },
    {
      key: 'active',
      icon: '✅',
      label: 'Ví có số dư',
      value: withBalance.length,
      sub: `${wallets.length - withBalance.length} ví trống`,
      className: 'active',
    },
  ];

  if (wallets.length === 0) return null;

  return (
    <div className="stats-grid section-gap">
      {stats.map(s => (
        <div key={s.key} className={`stat-card ${s.key}`}>
          <div className="stat-icon">{s.icon}</div>
          <div className="stat-label">{s.label}</div>
          <div className={`stat-value ${s.className}`}>{s.value}</div>
          <div className="stat-sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
