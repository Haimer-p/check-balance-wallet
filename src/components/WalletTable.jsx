import { useState, useMemo, useCallback } from 'react';
import { formatNumber, shortenAddress } from '../utils/fileUtils';

const PAGE_SIZES = [25, 50, 100, 200];

const BSC_SCAN = 'https://bscscan.com/address/';

export default function WalletTable({
  wallets,
  filters,
  sortConfig,
  onSort,
  selectedIds,
  onSelectId,
  onSelectAll,
  bnbPrice,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedAddr, setCopiedAddr] = useState(null);

  // ── Apply filters ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...wallets];

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(w =>
        w.address.toLowerCase().includes(q) ||
        (w.label || '').toLowerCase().includes(q)
      );
    }

    // BNB range
    if (filters.bnbMin !== '' && filters.bnbMin !== undefined) {
      data = data.filter(w => (w.bnb || 0) >= parseFloat(filters.bnbMin));
    }
    if (filters.bnbMax !== '' && filters.bnbMax !== undefined) {
      data = data.filter(w => (w.bnb || 0) <= parseFloat(filters.bnbMax));
    }

    // USDT range
    if (filters.usdtMin !== '' && filters.usdtMin !== undefined) {
      data = data.filter(w => (w.usdt || 0) >= parseFloat(filters.usdtMin));
    }
    if (filters.usdtMax !== '' && filters.usdtMax !== undefined) {
      data = data.filter(w => (w.usdt || 0) <= parseFloat(filters.usdtMax));
    }

    // USDC range
    if (filters.usdcMin !== '' && filters.usdcMin !== undefined) {
      data = data.filter(w => (w.usdc || 0) >= parseFloat(filters.usdcMin));
    }
    if (filters.usdcMax !== '' && filters.usdcMax !== undefined) {
      data = data.filter(w => (w.usdc || 0) <= parseFloat(filters.usdcMax));
    }

    // Total USD range
    if (filters.totalUsdMin !== '' && filters.totalUsdMin !== undefined) {
      data = data.filter(w => (w.totalUsd || 0) >= parseFloat(filters.totalUsdMin));
    }
    if (filters.totalUsdMax !== '' && filters.totalUsdMax !== undefined) {
      data = data.filter(w => (w.totalUsd || 0) <= parseFloat(filters.totalUsdMax));
    }

    // Status
    if (filters.status && filters.status !== 'all') {
      data = data.filter(w => {
        const hasBalance = (w.bnb || 0) > 0 || (w.usdt || 0) > 0 || (w.usdc || 0) > 0;
        switch (filters.status) {
          case 'has_balance': return hasBalance;
          case 'empty': return w.status === 'success' && !hasBalance;
          case 'success': return w.status === 'success';
          case 'error': return w.status === 'error';
          case 'pending': return !w.status || w.status === 'pending';
          default: return true;
        }
      });
    }

    return data;
  }, [wallets, filters]);

  // ── Sort ─────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal = a[sortConfig.key] ?? 0;
      let bVal = b[sortConfig.key] ?? 0;
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  // ── Paginate ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  // ── Page controls ──────────────────────────────────────────────────────
  const handlePageSize = (e) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  const handleSort = (key) => {
    onSort(key);
    setPage(1);
  };

  // ── Copy address ──────────────────────────────────────────────────────
  const copyAddress = useCallback((addr) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 1500);
    });
  }, []);

  // ── Select all on current page ────────────────────────────────────────
  const allPageSelected = paginated.length > 0 && paginated.every(w => selectedIds.has(w.address));
  const handleSelectPage = () => {
    if (allPageSelected) {
      onSelectAll(paginated.map(w => w.address), false);
    } else {
      onSelectAll(paginated.map(w => w.address), true);
    }
  };

  // ── Render sort icon ──────────────────────────────────────────────────
  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <span className="th-sort-icon">⇅</span>;
    return <span className="th-sort-icon">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── Status badge ──────────────────────────────────────────────────────
  const StatusBadge = ({ wallet }) => {
    if (!wallet.status || wallet.status === 'pending') {
      return <span className="status-badge loading">⏳ Pending</span>;
    }
    if (wallet.status === 'loading') {
      return <span className="status-badge loading">⏳ Loading</span>;
    }
    if (wallet.status === 'error') {
      return <span className="status-badge error" title={wallet.error}>❌ Lỗi</span>;
    }
    const hasBalance = (wallet.bnb || 0) > 0 || (wallet.usdt || 0) > 0 || (wallet.usdc || 0) > 0;
    return hasBalance
      ? <span className="status-badge active">✅ Có dư</span>
      : <span className="status-badge empty">⭕ Trống</span>;
  };

  if (wallets.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="empty-icon">👛</div>
          <div className="empty-title">Chưa có dữ liệu</div>
          <div className="empty-desc">Import file địa chỉ ví để bắt đầu</div>
        </div>
      </div>
    );
  }

  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <div className="table-container">
      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Hiển thị <strong style={{ color: 'var(--text-primary)' }}>{sorted.length}</strong>/{wallets.length} ví
          </span>
          {selectedIds.size > 0 && (
            <span className="selected-count-badge">✓ {selectedIds.size} đã chọn</span>
          )}
        </div>
        <div className="flex items-center gap-sm">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mỗi trang:</span>
          <select className="page-size-select" value={pageSize} onChange={handlePageSize}>
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="wallet-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  className="row-check"
                  checked={allPageSelected}
                  onChange={handleSelectPage}
                  title="Chọn tất cả trang này"
                />
              </th>
              <th className="row-index">#</th>
              <th
                className={`th-sortable ${sortConfig.key === 'address' ? 'active' : ''}`}
                onClick={() => handleSort('address')}
              >
                Địa Chỉ Ví <SortIcon col="address" />
              </th>
              <th
                className={`th-sortable ${sortConfig.key === 'label' ? 'active' : ''}`}
                onClick={() => handleSort('label')}
                style={{ minWidth: 120 }}
              >
                Label <SortIcon col="label" />
              </th>
              <th
                className={`th-sortable ${sortConfig.key === 'bnb' ? 'active' : ''}`}
                onClick={() => handleSort('bnb')}
                style={{ textAlign: 'right' }}
              >
                BNB <SortIcon col="bnb" />
              </th>
              <th
                className={`th-sortable ${sortConfig.key === 'usdt' ? 'active' : ''}`}
                onClick={() => handleSort('usdt')}
                style={{ textAlign: 'right' }}
              >
                USDT <SortIcon col="usdt" />
              </th>
              <th
                className={`th-sortable ${sortConfig.key === 'usdc' ? 'active' : ''}`}
                onClick={() => handleSort('usdc')}
                style={{ textAlign: 'right' }}
              >
                USDC <SortIcon col="usdc" />
              </th>
              <th
                className={`th-sortable ${sortConfig.key === 'totalUsd' ? 'active' : ''}`}
                onClick={() => handleSort('totalUsd')}
                style={{ textAlign: 'right' }}
              >
                Tổng USD <SortIcon col="totalUsd" />
              </th>
              <th>Trạng Thái</th>
              <th style={{ textAlign: 'center' }}>BSCScan</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((wallet, idx) => {
              const globalIdx = (safePage - 1) * pageSize + idx + 1;
              const hasBalance = (wallet.bnb || 0) > 0 || (wallet.usdt || 0) > 0 || (wallet.usdc || 0) > 0;
              const isSelected = selectedIds.has(wallet.address);

              return (
                <tr
                  key={wallet.address}
                  className={hasBalance ? 'has-balance' : ''}
                  style={isSelected ? { background: 'rgba(240,185,11,0.06)' } : {}}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="row-check"
                      checked={isSelected}
                      onChange={() => onSelectId(wallet.address)}
                    />
                  </td>
                  <td className="row-index">{globalIdx}</td>
                  <td>
                    <div className="addr-cell">
                      <span className="addr-short">{shortenAddress(wallet.address, 8, 6)}</span>
                      <button
                        className="addr-copy-btn"
                        onClick={() => copyAddress(wallet.address)}
                        title="Copy địa chỉ đầy đủ"
                      >
                        {copiedAddr === wallet.address ? '✅' : '📋'}
                      </button>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {wallet.label || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className={`balance-cell bnb ${(wallet.bnb || 0) === 0 ? 'zero' : ''}`}>
                    {wallet.status === 'loading'
                      ? <div className="skeleton" style={{ width: 60, marginLeft: 'auto' }} />
                      : formatNumber(wallet.bnb, 6)}
                  </td>
                  <td className={`balance-cell usdt ${(wallet.usdt || 0) === 0 ? 'zero' : ''}`}>
                    {wallet.status === 'loading'
                      ? <div className="skeleton" style={{ width: 60, marginLeft: 'auto' }} />
                      : formatNumber(wallet.usdt, 2)}
                  </td>
                  <td className={`balance-cell usdc ${(wallet.usdc || 0) === 0 ? 'zero' : ''}`}>
                    {wallet.status === 'loading'
                      ? <div className="skeleton" style={{ width: 60, marginLeft: 'auto' }} />
                      : formatNumber(wallet.usdc, 2)}
                  </td>
                  <td className={`balance-cell total ${(wallet.totalUsd || 0) === 0 ? 'zero' : ''}`}>
                    {wallet.status === 'loading'
                      ? <div className="skeleton" style={{ width: 70, marginLeft: 'auto' }} />
                      : wallet.totalUsd ? `$${formatNumber(wallet.totalUsd, 2)}` : '—'}
                  </td>
                  <td>
                    <StatusBadge wallet={wallet} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <a
                      href={`${BSC_SCAN}${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--bnb-gold)', fontSize: '1rem', textDecoration: 'none' }}
                      title="Xem trên BSCScan"
                    >
                      🔗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <div className="pagination-info">
          Trang <strong>{safePage}</strong> / {totalPages} •{' '}
          Hiển thị {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}{' '}
          trong {sorted.length} kết quả
        </div>
        <div className="pagination-controls">
          <button className="page-btn" onClick={() => setPage(1)} disabled={safePage === 1} title="Trang đầu">«</button>
          <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} title="Trang trước">‹</button>

          {pageNumbers.map((p, i) =>
            p === '...'
              ? <span key={`ellipsis-${i}`} className="page-btn" style={{ cursor: 'default', opacity: 0.4 }}>…</span>
              : <button
                  key={p}
                  className={`page-btn ${p === safePage ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >{p}</button>
          )}

          <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} title="Trang sau">›</button>
          <button className="page-btn" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} title="Trang cuối">»</button>
        </div>
      </div>
    </div>
  );
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}
