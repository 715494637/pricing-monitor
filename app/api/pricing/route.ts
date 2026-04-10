import { NextResponse } from 'next/server';
import { fetchPricing, transformPricing, diffPricing } from '@/lib/pricing';
import { PriceDisplay, PriceChange, PriceSnapshot } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'latest.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    await ensureDataDir();

    const apiData = await fetchPricing();
    const newPrices = transformPricing(apiData);

    // Read previous snapshot
    const prevSnapshot = await readJSON<PriceSnapshot | null>(SNAPSHOT_FILE, null);
    const prevHistory = await readJSON<PriceChange[]>(HISTORY_FILE, []);

    // Compute diff
    let newChanges: PriceChange[] = [];
    if (prevSnapshot) {
      newChanges = diffPricing(prevSnapshot.prices, newPrices);
    }

    // Save new snapshot
    const snapshot: PriceSnapshot = {
      timestamp: new Date().toISOString(),
      prices: newPrices,
    };
    await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));

    // Append changes to history (keep last 500)
    if (newChanges.length > 0) {
      const updatedHistory = [...newChanges, ...prevHistory].slice(0, 500);
      await fs.writeFile(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
    }

    return NextResponse.json({
      success: true,
      snapshot,
      changes: newChanges,
      totalHistoryCount: prevHistory.length + newChanges.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
