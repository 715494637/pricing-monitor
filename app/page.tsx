import { fetchPricing, transformPricing, diffPricing } from '@/lib/pricing';
import { PriceDisplay, PriceChange } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';
import ClientPage from './client-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getHistory(): Promise<PriceChange[]> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'history.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveSnapshot(prices: PriceDisplay[]) {
  const dir = path.join(process.cwd(), 'data');
  try { await fs.mkdir(dir, { recursive: true }); } catch {}

  let oldPrices: PriceDisplay[] = [];
  try {
    const raw = await fs.readFile(path.join(dir, 'latest.json'), 'utf-8');
    const old = JSON.parse(raw);
    oldPrices = old.prices || [];
  } catch {}

  const changes = diffPricing(oldPrices, prices);

  await fs.writeFile(
    path.join(dir, 'latest.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), prices }, null, 2)
  );

  if (changes.length > 0) {
    let history: PriceChange[] = [];
    try {
      const raw = await fs.readFile(path.join(dir, 'history.json'), 'utf-8');
      history = JSON.parse(raw);
    } catch {}
    const updated = [...changes, ...history].slice(0, 500);
    await fs.writeFile(path.join(dir, 'history.json'), JSON.stringify(updated, null, 2));
  }
}

export default async function Home() {
  let prices: PriceDisplay[] = [];
  let history: PriceChange[] = [];
  let error = '';
  const fetchTime = new Date().toISOString();

  try {
    const apiData = await fetchPricing();
    prices = transformPricing(apiData);
    await saveSnapshot(prices);
    history = await getHistory();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : 'Failed to fetch pricing data';
  }

  return (
    <ClientPage
      prices={prices}
      history={history}
      error={error}
      fetchTime={fetchTime}
    />
  );
}
