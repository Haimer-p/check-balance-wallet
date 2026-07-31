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
    symbol: 'USDT',
  },
  USDC: {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    symbol: 'USDC',
  },
};

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

let currentProvider = null;
let currentRpcIndex = 0;

function getProvider() {
  if (!currentProvider) {
    currentProvider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
  }
  return currentProvider;
}

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  currentProvider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
  return currentProvider;
}

export function getCurrentRpc() {
  return RPC_ENDPOINTS[currentRpcIndex];
}

async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(getProvider());
    } catch (err) {
      if (i < retries - 1) {
        rotateRpc();
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      } else {
        throw err;
      }
    }
  }
}

export async function getWalletBalance(address) {
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid address');
  }

  const [bnbBalance, usdtBalance, usdcBalance] = await Promise.all([
    withRetry(async (provider) => {
      const bal = await provider.getBalance(address);
      return parseFloat(ethers.formatEther(bal));
    }),
    withRetry(async (provider) => {
      const contract = new ethers.Contract(TOKENS.USDT.address, ERC20_ABI, provider);
      const bal = await contract.balanceOf(address);
      return parseFloat(ethers.formatUnits(bal, TOKENS.USDT.decimals));
    }),
    withRetry(async (provider) => {
      const contract = new ethers.Contract(TOKENS.USDC.address, ERC20_ABI, provider);
      const bal = await contract.balanceOf(address);
      return parseFloat(ethers.formatUnits(bal, TOKENS.USDC.decimals));
    }),
  ]);

  return { bnb: bnbBalance, usdt: usdtBalance, usdc: usdcBalance };
}

// Batch load with concurrency control
export async function batchGetBalances(addresses, onProgress, concurrency = 5) {
  const results = [];
  const errors = [];
  let completed = 0;

  // Process in chunks
  for (let i = 0; i < addresses.length; i += concurrency) {
    const chunk = addresses.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (addr) => {
        try {
          const bal = await getWalletBalance(addr.trim());
          return { address: addr.trim(), ...bal, status: 'success' };
        } catch (err) {
          return { address: addr.trim(), bnb: 0, usdt: 0, usdc: 0, status: 'error', error: err.message };
        }
      })
    );

    for (const result of chunkResults) {
      completed++;
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.status === 'error') errors.push(result.value.address);
      } else {
        const addr = chunk[results.length % chunk.length];
        results.push({ address: addr, bnb: 0, usdt: 0, usdc: 0, status: 'error' });
        errors.push(addr);
      }
      if (onProgress) onProgress(completed, addresses.length, errors.length);
    }

    // Small delay between chunks to avoid rate limiting
    if (i + concurrency < addresses.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return { results, errors };
}
