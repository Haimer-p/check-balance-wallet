import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// ─── SAMPLE FILE ────────────────────────────────────────────────────────────

export function exportSampleFile(format = 'csv') {
  const sampleData = [
    { 'Wallet Address': '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', 'Label': 'Ví mẫu 1' },
  ];

  if (format === 'csv') {
    const csv = Papa.unparse(sampleData);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'sample_wallets.csv');
  } else {
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [{ wch: 45 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wallets');
    XLSX.writeFile(wb, 'sample_wallets.xlsx');
  }
}

// ─── IMPORT FILE ─────────────────────────────────────────────────────────────

export function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const addresses = extractAddresses(results.data);
          if (addresses.length === 0) {
            // Try no-header mode (plain list)
            Papa.parse(file, {
              header: false,
              skipEmptyLines: true,
              complete: (r2) => {
                const addrs = r2.data
                  .flat()
                  .map(v => String(v).trim())
                  .filter(v => isValidAddress(v));
                resolve({ addresses: addrs, labels: {}, raw: r2.data });
              },
              error: reject,
            });
          } else {
            const { addrs, labels } = extractAddressesWithLabels(results.data);
            resolve({ addresses: addrs, labels, raw: results.data });
          }
        },
        error: reject,
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (data.length === 0) {
            // Try raw mode
            const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            const addrs = raw.flat().map(v => String(v).trim()).filter(isValidAddress);
            resolve({ addresses: addrs, labels: {}, raw });
          } else {
            const { addrs, labels } = extractAddressesWithLabels(data);
            resolve({ addresses: addrs, labels, raw: data });
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(isValidAddress);
        resolve({ addresses: lines, labels: {}, raw: [] });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    } else {
      reject(new Error('Unsupported file format. Please use CSV, XLSX, or TXT.'));
    }
  });
}

function extractAddresses(data) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0] || {});
  const addrKey = keys.find(k =>
    /address|wallet|addr|ví|vi/i.test(k)
  ) || keys[0];
  return data
    .map(row => String(row[addrKey] || '').trim())
    .filter(isValidAddress);
}

function extractAddressesWithLabels(data) {
  if (!data || data.length === 0) return { addrs: [], labels: {} };
  const keys = Object.keys(data[0] || {});
  const addrKey = keys.find(k => /address|wallet|addr|ví|vi/i.test(k)) || keys[0];
  const labelKey = keys.find(k => /label|name|note|tên|ten|tag/i.test(k));

  const addrs = [];
  const labels = {};
  for (const row of data) {
    const addr = String(row[addrKey] || '').trim();
    if (isValidAddress(addr)) {
      addrs.push(addr);
      if (labelKey && row[labelKey]) {
        labels[addr.toLowerCase()] = String(row[labelKey]).trim();
      }
    }
  }
  return { addrs, labels };
}

function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ─── EXPORT EXCEL ─────────────────────────────────────────────────────────────

export function exportToExcel(wallets, filename = 'wallet_balances') {
  const rows = wallets.map((w, i) => ({
    '#': i + 1,
    'Wallet Address': w.address,
    'Label': w.label || '',
    'BNB Balance': w.bnb ?? 0,
    'USDT Balance': w.usdt ?? 0,
    'USDC Balance': w.usdc ?? 0,
    'Total USD (est.)': w.totalUsd ?? 0,
    'Status': w.status === 'success' ? (hasBalance(w) ? 'Has Balance' : 'Empty') : 'Error',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // #
    { wch: 45 },  // Address
    { wch: 20 },  // Label
    { wch: 18 },  // BNB
    { wch: 18 },  // USDT
    { wch: 18 },  // USDC
    { wch: 18 },  // Total
    { wch: 12 },  // Status
  ];

  // Style header row
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1A1A2E' } },
      alignment: { horizontal: 'center' },
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wallet Balances');

  // Summary sheet
  const totalBnb = wallets.reduce((s, w) => s + (w.bnb || 0), 0);
  const totalUsdt = wallets.reduce((s, w) => s + (w.usdt || 0), 0);
  const totalUsdc = wallets.reduce((s, w) => s + (w.usdc || 0), 0);
  const withBalance = wallets.filter(hasBalance).length;

  const summaryData = [
    { 'Metric': 'Total Wallets', 'Value': wallets.length },
    { 'Metric': 'Wallets with Balance', 'Value': withBalance },
    { 'Metric': 'Empty Wallets', 'Value': wallets.length - withBalance },
    { 'Metric': 'Total BNB', 'Value': totalBnb.toFixed(6) },
    { 'Metric': 'Total USDT', 'Value': totalUsdt.toFixed(2) },
    { 'Metric': 'Total USDC', 'Value': totalUsdc.toFixed(2) },
    { 'Metric': 'Export Date', 'Value': new Date().toLocaleString('vi-VN') },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  XLSX.writeFile(wb, `${filename}_${formatDateForFile()}.xlsx`);
}

export function exportToCSV(wallets) {
  const rows = wallets.map((w, i) => ({
    '#': i + 1,
    'Wallet Address': w.address,
    'Label': w.label || '',
    'BNB': w.bnb ?? 0,
    'USDT': w.usdt ?? 0,
    'USDC': w.usdc ?? 0,
    'Total USD': w.totalUsd ?? 0,
    'Status': w.status === 'success' ? (hasBalance(w) ? 'Has Balance' : 'Empty') : 'Error',
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `wallet_balances_${formatDateForFile()}.csv`);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function hasBalance(w) {
  return (w.bnb || 0) > 0 || (w.usdt || 0) > 0 || (w.usdc || 0) > 0;
}

function formatDateForFile() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ADDRESS UTILS ──────────────────────────────────────────────────────────

export function shortenAddress(addr, start = 6, end = 4) {
  if (!addr) return '';
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export function formatNumber(num, decimals = 4) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num === 0) return '0';
  if (num < 0.0001 && num > 0) return '< 0.0001';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatUSD(num) {
  if (!num) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
