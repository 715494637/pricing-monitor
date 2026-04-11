/**
 * 定价探测脚本
 * 由 GitHub Actions 定时执行
 * 抓取最新定价 → 对比差异 → 写入 data/ 目录
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://new2.882111.xyz/api/pricing';
const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'latest.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const PRICE_MULTIPLIER = 2;

async function fetchPricing() {
  const res = await fetch(API_URL, {
    headers: {
      'accept': 'application/json',
      'cache-control': 'no-store',
      'new-api-user': '1',
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function transformPricing(data) {
  const vendorMap = new Map(data.vendors.map(v => [v.id, v]));

  return data.data
    .map(m => {
      const vendor = vendorMap.get(m.vendor_id);
      const inputPrice = +(m.model_ratio * PRICE_MULTIPLIER).toFixed(4);
      const outputPrice = +(m.model_ratio * m.completion_ratio * PRICE_MULTIPLIER).toFixed(4);

      return {
        modelName: m.model_name,
        vendorName: vendor?.name || 'Unknown',
        vendorIcon: m.icon || vendor?.icon || '',
        inputPrice,
        outputPrice,
        modelRatio: m.model_ratio,
        completionRatio: m.completion_ratio,
        endpoints: m.supported_endpoint_types,
      };
    })
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.modelName.localeCompare(b.modelName));
}

/**
 * 对比新旧定价，生成变更记录
 * 每个模型最多一条记录，包含完整的输入+输出价格变化
 */
function diffPricing(oldPrices, newPrices) {
  const changes = [];
  const now = new Date().toISOString();
  const oldMap = new Map(oldPrices.map(p => [p.modelName, p]));
  const newMap = new Map(newPrices.map(p => [p.modelName, p]));

  for (const [name, np] of newMap) {
    const op = oldMap.get(name);
    if (!op) {
      // 新增模型
      changes.push({
        modelName: name,
        vendorName: np.vendorName,
        type: 'new',
        inputPrice: np.inputPrice,
        outputPrice: np.outputPrice,
        timestamp: now,
      });
      continue;
    }
    // 价格变动 — 输入或输出任一变化都记录，且包含完整新旧价格
    if (op.inputPrice !== np.inputPrice || op.outputPrice !== np.outputPrice) {
      changes.push({
        modelName: name,
        vendorName: np.vendorName,
        type: 'price_change',
        oldInput: op.inputPrice,
        newInput: np.inputPrice,
        oldOutput: op.outputPrice,
        newOutput: np.outputPrice,
        timestamp: now,
      });
    }
  }

  // 移除的模型
  for (const [name, op] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        modelName: name,
        vendorName: op.vendorName,
        type: 'removed',
        inputPrice: op.inputPrice,
        outputPrice: op.outputPrice,
        timestamp: now,
      });
    }
  }

  return changes;
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] 开始探测定价...`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const apiData = await fetchPricing();
  const newPrices = transformPricing(apiData);
  console.log(`获取到 ${newPrices.length} 个模型`);

  const prevSnapshot = readJSON(SNAPSHOT_FILE, null);

  let newChanges = [];
  if (prevSnapshot && prevSnapshot.prices) {
    newChanges = diffPricing(prevSnapshot.prices, newPrices);
  }

  // Save snapshot
  const snapshot = {
    timestamp: new Date().toISOString(),
    prices: newPrices,
  };
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
  console.log('快照已保存');

  // Append to history
  const history = readJSON(HISTORY_FILE, []);
  if (newChanges.length > 0) {
    const updated = [...newChanges, ...history].slice(0, 1000);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(updated, null, 2));
    console.log(`发现 ${newChanges.length} 项变更:`);
    newChanges.forEach(c => {
      if (c.type === 'new') {
        console.log(`  + 新增: ${c.modelName} (${c.vendorName}) 输入¥${c.inputPrice}/M 输出¥${c.outputPrice}/M`);
      } else if (c.type === 'removed') {
        console.log(`  - 移除: ${c.modelName} (${c.vendorName})`);
      } else {
        const parts = [];
        if (c.oldInput !== c.newInput) parts.push(`输入 ¥${c.oldInput} → ¥${c.newInput}`);
        if (c.oldOutput !== c.newOutput) parts.push(`输出 ¥${c.oldOutput} → ¥${c.newOutput}`);
        console.log(`  ~ ${c.modelName}: ${parts.join(', ')}`);
      }
    });
  } else {
    console.log('无价格变动');
    if (!fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
    }
  }

  const hasChanges = newChanges.length > 0 || !prevSnapshot;
  console.log(`\nhas_changes=${hasChanges}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_changes=${hasChanges}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `change_count=${newChanges.length}\n`);
  }
}

main().catch(err => {
  console.error('探测失败:', err.message);
  process.exit(1);
});
