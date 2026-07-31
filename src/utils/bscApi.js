import { ethers } from 'ethers';

// BSC RPC endpoints (fallback list)
const RPC_ENDPOINTS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.defibit.io',
];

// Token contracts on BSC
const TOKENS = {
  USDT: {
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
  },
  USDC: {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
  },
};

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

// ── Singleton provider with max listeners fix ────────────────────────────────
let _provider = null;
let currentRpcIndex = 0;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
    // Fix MaxListenersExceededWarning
    if (_provider._websocket) _provider._websocket.setMaxListeners(50);
  }
  return _provider;
}

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  _provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
  return _provider;
}

export function getCurrentRpc() {
  return RPC_ENDPOINTS[currentRpcIndex];
}

async function withRetry(fn, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn(getProvider());
    } catch (err) {
      if (attempt < retries - 1) {
        rotateRpc();
        await sleep(400 * (attempt + 1));
      } else {
        throw err;
      }
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function getWalletBalance(address) {
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid address');
  }

  const provider = getProvider();

  const [bnbRaw, usdtRaw, usdcRaw] = await Promise.all([
    withRetry(p => p.getBalance(address)),
    withRetry(p => new ethers.Contract(TOKENS.USDT.address, ERC20_ABI, p).balanceOf(address)),
    withRetry(p => new ethers.Contract(TOKENS.USDC.address, ERC20_ABI, p).balanceOf(address)),
  ]);

  void provider; // keep reference to avoid lint warning

  return {
    bnb: parseFloat(ethers.formatEther(bnbRaw)),
    usdt: parseFloat(ethers.formatUnits(usdtRaw, 18)),
    usdc: parseFloat(ethers.formatUnits(usdcRaw, 18)),
  };
}

/**
 * Batch load balances with concurrency control.
 * onProgress(completed, total, errorCount, latestResult, latestIndex)
 * - latestResult: the result object just completed
 * - latestIndex:  its index in the original addresses array
 */
export async function batchGetBalances(addresses, onProgress, concurrency = 5) {
  const allResults = new Array(addresses.length).fill(null);
  const errors = [];
  let completed = 0;

  for (let chunkStart = 0; chunkStart < addresses.length; chunkStart += concurrency) {
    const chunk = addresses.slice(chunkStart, chunkStart + concurrency);

    // Run chunk in parallel, preserving index
    const chunkPromises = chunk.map((addr, offsetIdx) => {
      const globalIdx = chunkStart + offsetIdx;
      return (async () => {
        try {
          const bal = await getWalletBalance(addr.trim());
          return { index: globalIdx, address: addr.trim(), ...bal, status: 'success' };
        } catch (err) {
          return { index: globalIdx, address: addr.trim(), bnb: 0, usdt: 0, usdc: 0, status: 'error', error: err.message };
        }
      })();
    });

    const chunkResults = await Promise.allSettled(chunkPromises);

    for (const settled of chunkResults) {
      completed++;
      const result = settled.status === 'fulfilled'
        ? settled.value
        : { index: chunkStart, address: '', bnb: 0, usdt: 0, usdc: 0, status: 'error' };

      allResults[result.index] = result;
      if (result.status === 'error') errors.push(result.address);

      // Pass the individual result directly — no TDZ risk
      if (onProgress) {
        onProgress(completed, addresses.length, errors.length, result, result.index);
      }
    }

    // Brief pause between chunks to avoid rate limiting
    if (chunkStart + concurrency < addresses.length) {
      await sleep(150);
    }
  }

  return { results: allResults, errors };
}
