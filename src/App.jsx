import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import StatsPanel from './components/StatsPanel';
import ImportExport from './components/ImportExport';
import FilterPanel from './components/FilterPanel';
import WalletTable from './components/WalletTable';
import { batchGetBalances } from './utils/bscApi';
import { exportSampleFile, exportToExcel, exportToCSV } from './utils/fileUtils';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.icon}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, total, errors, onCancel }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="progress-bar-wrap section-gap">
      <div className="progress-header">
        <span className="progress-label">
          ⏳ Đang load balance...
        </span>
        <span className="progress-count">{current} / {total} ({pct}%)</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between items-center mt-sm">
        {errors > 0
          ? <span className="progress-errors">⚠️ {errors} địa chỉ lỗi</span>
          : <span />
        }
        <button className="btn btn-danger btn-sm" onClick={onCancel}>
          ✕ Hủy
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [wallets, setWallets] = useState([]);           // all wallet rows
  const [labels, setLabels] = useState({});             // addr.lower() => label
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [filters, setFilters] = useState({});
  const [showFilter, setShowFilter] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [bnbPrice, setBnbPrice] = useState(null);
  const cancelRef = useRef(false);
  const toastIdRef = useRef(0);

  // ── Fetch BNB price ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
      .then(r => r.json())
      .then(d => setBnbPrice(parseFloat(d.price)))
      .catch(() => {});
  }, []);

  // ── Toast helpers ───────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info', icon = '💬') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Import handler ──────────────────────────────────────────────────────────
  const handleImport = useCallback(({ addresses, labels: importedLabels }) => {
    if (addresses.length === 0) {
      addToast('Không tìm thấy địa chỉ ví hợp lệ trong file', 'error', '❌');
      return;
    }
    // Deduplicate
    const seen = new Set();
    const unique = addresses.filter(a => {
      const lower = a.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    setWallets(unique.map(addr => ({
      address: addr,
      label: importedLabels[addr.toLowerCase()] || '',
      bnb: null, usdt: null, usdc: null, totalUsd: null,
      status: 'pending',
    })));
    setLabels(importedLabels);
    setSelectedIds(new Set());
    setSortConfig({ key: null, dir: 'desc' });
    setFilters({});
    addToast(`Đã import ${unique.length} địa chỉ ví`, 'success', '✅');
  }, [addToast]);

  // ── Load balance ────────────────────────────────────────────────────────────
  const handleLoadBalance = useCallback(async () => {
    if (wallets.length === 0) {
      addToast('Hãy import danh sách ví trước', 'warning', '⚠️');
      return;
    }

    cancelRef.current = false;
    setLoading(true);
    setProgress({ current: 0, total: wallets.length, errors: 0 });

    // Mark all as loading
    setWallets(prev => prev.map(w => ({ ...w, status: 'loading', bnb: null, usdt: null, usdc: null, totalUsd: null })));

    const addresses = wallets.map(w => w.address);
    let localErrors = 0;

    // FIX: callback now receives (completed, total, errCount, latestResult, latestIndex)
    // We update only the single wallet that just finished — no TDZ reference to outer `results`
    const { results: allResults } = await batchGetBalances(
      addresses,
      (completed, total, errCount, latestResult, latestIndex) => {
        if (cancelRef.current) return;
        localErrors = errCount;
        setProgress({ current: completed, total, errors: errCount });

        // Progressive update: only update the single row that just finished
        if (latestResult != null && latestIndex != null) {
          const r = latestResult;
          const totalUsd = (r.bnb || 0) * (bnbPrice || 0) + (r.usdt || 0) + (r.usdc || 0);
          setWallets(prev => {
            const updated = [...prev];
            if (updated[latestIndex]) {
              updated[latestIndex] = {
                ...updated[latestIndex],
                bnb: r.bnb,
                usdt: r.usdt,
                usdc: r.usdc,
                totalUsd,
                status: r.status,
                error: r.error,
              };
            }
            return updated;
          });
        }
      },
      5 // concurrency
    );

    if (!cancelRef.current) {
      // Final reconciliation pass with allResults (now safely resolved)
      setWallets(prev => prev.map((w, i) => {
        const r = allResults[i];
        if (!r) return w;
        const totalUsd = (r.bnb || 0) * (bnbPrice || 0) + (r.usdt || 0) + (r.usdc || 0);
        return { ...w, bnb: r.bnb, usdt: r.usdt, usdc: r.usdc, totalUsd, status: r.status, error: r.error };
      }));

      const successCount = allResults.filter(r => r && r.status === 'success').length;
      addToast(
        `Đã load ${successCount}/${allResults.length} ví${localErrors > 0 ? ` (${localErrors} lỗi)` : ''}`,
        localErrors > 0 ? 'warning' : 'success',
        localErrors > 0 ? '⚠️' : '✅'
      );
    } else {
      addToast('Đã hủy load balance', 'info', '🛑');
      setWallets(prev => prev.map(w =>
        w.status === 'loading' ? { ...w, status: 'pending' } : w
      ));
    }

    setLoading(false);
  }, [wallets, bnbPrice, addToast]);


  const handleCancel = () => {
    cancelRef.current = true;
  };

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  // ── Select ────────────────────────────────────────────────────────────────────
  const handleSelectId = useCallback((addr) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((addrs, select) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const addr of addrs) {
        if (select) next.add(addr);
        else next.delete(addr);
      }
      return next;
    });
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────
  const getExportData = () => {
    if (selectedIds.size > 0) {
      return wallets.filter(w => selectedIds.has(w.address));
    }
    return wallets.filter(w => w.status === 'success');
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) { addToast('Không có dữ liệu để export', 'warning', '⚠️'); return; }
    exportToExcel(data);
    addToast(`Đã export ${data.length} ví ra Excel`, 'success', '📊');
  };

  const handleExportCSV = () => {
    const data = getExportData();
    if (data.length === 0) { addToast('Không có dữ liệu để export', 'warning', '⚠️'); return; }
    exportToCSV(data);
    addToast(`Đã export ${data.length} ví ra CSV`, 'success', '📄');
  };

  const handleExportSample = (fmt) => {
    exportSampleFile(fmt);
    addToast(`Đã tải file mẫu ${fmt.toUpperCase()}`, 'info', '📋');
  };

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (!window.confirm('Xóa toàn bộ dữ liệu?')) return;
    setWallets([]);
    setLabels({});
    setSelectedIds(new Set());
    setFilters({});
    setSortConfig({ key: null, dir: 'desc' });
    addToast('Đã xóa toàn bộ dữ liệu', 'info', '🗑');
  };

  const loadedCount = wallets.filter(w => w.status === 'success' || w.status === 'error').length;
  const hasLoadedData = wallets.some(w => w.status === 'success');
  const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== undefined && v !== 'all').length;

  return (
    <div className="app-container">
      <Toast toasts={toasts} />

      {/* Header */}
      <Header walletCount={wallets.length} loadedCount={loadedCount} />

      {/* Stats */}
      <StatsPanel wallets={wallets} bnbPrice={bnbPrice} />

      {/* Import/Export Panel */}
      <ImportExport
        onImport={handleImport}
        onExportSample={handleExportSample}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        hasData={hasLoadedData}
        walletCount={selectedIds.size > 0 ? selectedIds.size : wallets.filter(w => w.status === 'success').length}
      />

      {/* Progress */}
      {loading && (
        <ProgressBar
          current={progress.current}
          total={progress.total}
          errors={progress.errors}
          onCancel={handleCancel}
        />
      )}

      {/* Action Bar */}
      {wallets.length > 0 && (
        <div className="action-bar section-gap">
          <div className="action-bar-left">
            {/* Load Balance */}
            <button
              className="btn btn-primary btn-lg"
              onClick={handleLoadBalance}
              disabled={loading}
              id="btn-load-balance"
            >
              {loading
                ? <><span className="btn-spinner" /> Đang load...</>
                : <><span>⚡</span> Load Balance</>
              }
            </button>

            {/* Filter toggle */}
            <button
              className={`btn btn-secondary ${showFilter ? '' : ''}`}
              onClick={() => setShowFilter(v => !v)}
              style={showFilter ? { borderColor: 'var(--bnb-gold)', color: 'var(--bnb-gold)' } : {}}
            >
              🔽 Filter
              {activeFilterCount > 0 && (
                <span className="badge badge-gold" style={{ marginLeft: 4 }}>{activeFilterCount}</span>
              )}
            </button>

            {/* Search input */}
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Tìm kiếm địa chỉ..."
                value={filters.search || ''}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>

          <div className="action-bar-right">
            {selectedIds.size > 0 && (
              <span className="selected-count-badge">✓ {selectedIds.size} đã chọn</span>
            )}
            {bnbPrice && (
              <div style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 12px',
                fontSize: '0.75rem',
                color: 'var(--bnb-gold)',
                fontFamily: 'var(--font-mono)',
              }}>
                BNB: ${bnbPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            )}
            <button className="btn btn-danger btn-sm" onClick={handleClear}>
              🗑 Xóa tất cả
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilter && wallets.length > 0 && (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters({})}
        />
      )}

      {/* Table */}
      <WalletTable
        wallets={wallets}
        filters={filters}
        sortConfig={sortConfig}
        onSort={handleSort}
        selectedIds={selectedIds}
        onSelectId={handleSelectId}
        onSelectAll={handleSelectAll}
        bnbPrice={bnbPrice}
      />

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: 'var(--space-xl) 0 var(--space-md)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: 'var(--space-lg)',
      }}>
        <div>BNB Wallet Balance Checker • BSC Mainnet</div>
        <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
          Dữ liệu được lấy trực tiếp từ blockchain • Không lưu trữ thông tin ví
        </div>
      </div>
    </div>
  );
}
