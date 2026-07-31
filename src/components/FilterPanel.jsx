export default function FilterPanel({ filters, onChange, onReset }) {
  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="filter-panel section-gap">
      {/* Search */}
      <div className="filter-group" style={{ gridColumn: 'span 2' }}>
        <label className="filter-label">🔍 Tìm kiếm địa chỉ / label</label>
        <input
          className="filter-input"
          placeholder="0x... hoặc tên ví"
          value={filters.search || ''}
          onChange={e => handleChange('search', e.target.value)}
        />
      </div>

      {/* BNB range */}
      <div className="filter-group">
        <label className="filter-label bnb">🟡 BNB từ - đến</label>
        <div className="filter-range">
          <input
            className="filter-input"
            type="number"
            placeholder="Min"
            min="0"
            value={filters.bnbMin ?? ''}
            onChange={e => handleChange('bnbMin', e.target.value)}
          />
          <span className="filter-separator">—</span>
          <input
            className="filter-input"
            type="number"
            placeholder="Max"
            min="0"
            value={filters.bnbMax ?? ''}
            onChange={e => handleChange('bnbMax', e.target.value)}
          />
        </div>
      </div>

      {/* USDT range */}
      <div className="filter-group">
        <label className="filter-label usdt">💚 USDT từ - đến</label>
        <div className="filter-range">
          <input
            className="filter-input"
            type="number"
            placeholder="Min"
            min="0"
            value={filters.usdtMin ?? ''}
            onChange={e => handleChange('usdtMin', e.target.value)}
          />
          <span className="filter-separator">—</span>
          <input
            className="filter-input"
            type="number"
            placeholder="Max"
            min="0"
            value={filters.usdtMax ?? ''}
            onChange={e => handleChange('usdtMax', e.target.value)}
          />
        </div>
      </div>

      {/* USDC range */}
      <div className="filter-group">
        <label className="filter-label usdc">🔵 USDC từ - đến</label>
        <div className="filter-range">
          <input
            className="filter-input"
            type="number"
            placeholder="Min"
            min="0"
            value={filters.usdcMin ?? ''}
            onChange={e => handleChange('usdcMin', e.target.value)}
          />
          <span className="filter-separator">—</span>
          <input
            className="filter-input"
            type="number"
            placeholder="Max"
            min="0"
            value={filters.usdcMax ?? ''}
            onChange={e => handleChange('usdcMax', e.target.value)}
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="filter-group">
        <label className="filter-label">📊 Trạng thái</label>
        <select
          className="filter-select"
          value={filters.status || 'all'}
          onChange={e => handleChange('status', e.target.value)}
        >
          <option value="all">Tất cả</option>
          <option value="has_balance">Có số dư</option>
          <option value="empty">Ví trống</option>
          <option value="success">Load thành công</option>
          <option value="error">Lỗi</option>
          <option value="pending">Chưa load</option>
        </select>
      </div>

      {/* Total USD range */}
      <div className="filter-group">
        <label className="filter-label" style={{ color: '#f472b6' }}>💰 Tổng USD từ - đến</label>
        <div className="filter-range">
          <input
            className="filter-input"
            type="number"
            placeholder="Min $"
            min="0"
            value={filters.totalUsdMin ?? ''}
            onChange={e => handleChange('totalUsdMin', e.target.value)}
          />
          <span className="filter-separator">—</span>
          <input
            className="filter-input"
            type="number"
            placeholder="Max $"
            min="0"
            value={filters.totalUsdMax ?? ''}
            onChange={e => handleChange('totalUsdMax', e.target.value)}
          />
        </div>
      </div>

      {/* Reset */}
      <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
        <label className="filter-label">&nbsp;</label>
        <button className="btn btn-danger btn-sm" onClick={onReset}>
          🗑 Xóa filter
        </button>
      </div>
    </div>
  );
}
