import { useState, useCallback } from 'react';
import { parseImportFile } from '../utils/fileUtils';

export default function ImportExport({
  onImport,
  onExportSample,
  onExportExcel,
  onExportCSV,
  hasData,
  walletCount,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await parseImportFile(file);
      setFileInfo({ name: file.name, count: result.addresses.length });
      onImport(result);
    } catch (err) {
      alert('Lỗi đọc file: ' + err.message);
    } finally {
      setImporting(false);
    }
  }, [onImport]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="glass-card section-gap">
      <div className="glass-card-body">
        <div className="io-panel">
          {/* IMPORT */}
          <div>
            <div className="io-section-title">
              <span>📥</span> Import Địa Chỉ Ví
            </div>
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleChange}
                id="file-import"
              />
              <div className="drop-icon">
                {importing ? '⏳' : dragOver ? '🎯' : '📂'}
              </div>
              <div className="drop-text">
                {importing ? 'Đang đọc file...' : 'Kéo thả file vào đây'}
              </div>
              <div className="drop-hint">hoặc click để chọn file • CSV, XLSX, TXT</div>
            </div>

            {fileInfo && (
              <div className="file-info-badge">
                <span>✅</span>
                <span>{fileInfo.name}</span>
                <span className="badge badge-gold">{fileInfo.count} địa chỉ</span>
              </div>
            )}

            <div className="mt-sm" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Định dạng hỗ trợ:</strong><br />
              • Cột <code style={{ color: 'var(--bnb-gold)', fontSize: '0.7rem' }}>Wallet Address</code> (CSV/Excel)<br />
              • Danh sách địa chỉ thô (TXT, mỗi dòng 1 địa chỉ)<br />
              • Có thể thêm cột <code style={{ color: 'var(--bnb-gold)', fontSize: '0.7rem' }}>Label</code> tùy chọn
            </div>
          </div>

          {/* DIVIDER */}
          <div className="io-divider">⟷</div>

          {/* EXPORT */}
          <div>
            <div className="io-section-title">
              <span>📤</span> Export File
            </div>
            <div className="export-buttons">
              {/* Sample files */}
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📋 File mẫu (tải về để import)
                </div>
                <div className="flex gap-sm flex-wrap">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onExportSample('csv')}
                    title="Tải file CSV mẫu"
                  >
                    📄 Mẫu CSV
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onExportSample('xlsx')}
                    title="Tải file Excel mẫu"
                  >
                    📊 Mẫu XLSX
                  </button>
                </div>
              </div>

              {/* Export results */}
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💾 Export kết quả ({walletCount} ví)
                </div>
                <div className="flex gap-sm flex-wrap">
                  <button
                    className="btn btn-success"
                    onClick={onExportExcel}
                    disabled={!hasData}
                    title="Export ra Excel với formatting đẹp"
                  >
                    📊 Excel (.xlsx)
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={onExportCSV}
                    disabled={!hasData}
                    title="Export ra CSV"
                  >
                    📄 CSV
                  </button>
                </div>
                {!hasData && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Load balance trước để export kết quả
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
