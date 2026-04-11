import fs from 'fs/promises';
import path from 'path';
import { PriceDisplay, PriceChange } from '@/lib/types';
import ClientPage from './client-page';

// ISR: 每5分钟重新生成
export const revalidate = 300;

async function readDataFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const snapshot = await readDataFile<{ timestamp: string; prices: PriceDisplay[] } | null>('latest.json', null);
  const history = await readDataFile<PriceChange[]>('history.json', []);

  const prices = snapshot?.prices || [];

  return (
    <ClientPage
      prices={prices}
      history={history}
      error={prices.length === 0 ? '暂无数据，等待首次探测...' : ''}
    />
  );
}
