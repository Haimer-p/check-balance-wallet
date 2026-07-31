import { getCurrentRpc } from '../utils/bscApi';

export default function Header({ walletCount, loadedCount }) {
  return (
    <header className="app-header section-gap">
      <div className="header-brand">
        <div className="header-logo">🔑</div>
        <div>
          <div className="header-title">BNB Wallet Balance Checker</div>
          <div className="header-subtitle">Kiểm tra số dư BNB · USDT · USDC trên BNB Chain</div>
        </div>
      </div>

      <div className="flex items-center gap-md flex-wrap">
        {walletCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}>
            <span>👛</span>
            <span><strong style={{ color: 'var(--text-primary)' }}>{loadedCount}</strong> / {walletCount} ví</span>
          </div>
        )}

        <div className="header-network-badge">
          <div className="network-dot" />
          <span>BNB Chain (BSC)</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
        }}>
          <div className="rpc-dot" />
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {getCurrentRpc().replace('https://', '').split('/')[0]}
          </span>
        </div>
      </div>
    </header>
  );
}
