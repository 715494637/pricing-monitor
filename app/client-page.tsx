'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { PriceDisplay, PriceChange } from '@/lib/types';

interface Props {
  prices: PriceDisplay[];
  history: PriceChange[];
  error: string;
  fetchTime: string;
}

const VS: Record<string, string> = {
  Anthropic: 'vendor-anthropic',
  OpenAI: 'vendor-openai',
  Google: 'vendor-google',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const dateStr = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  if (diff === 0) return `今天 ${dateStr}`;
  if (diff === 1) return `昨天 ${dateStr}`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
function fmtP(v: number) {
  if (v >= 100) return `¥${v.toFixed(0)}`;
  if (v >= 10) return `¥${v.toFixed(1)}`;
  return `¥${v.toFixed(2)}`;
}
function pct(o: number, n: number) {
  if (!o) return '';
  const p = ((n - o) / o * 100);
  return p > 0 ? `+${p.toFixed(1)}%` : `${p.toFixed(1)}%`;
}

interface Batch {
  key: string;
  timestamp: string;
  date: string;
  time: string;
  changes: PriceChange[];
  priceChanges: PriceChange[];
  newModels: PriceChange[];
  removedModels: PriceChange[];
}

interface DateGroup {
  date: string;
  batches: Batch[];
  totalChanges: number;
  totalPriceChanges: number;
  totalNew: number;
  totalRemoved: number;
}

// Compatibility with legacy history shape
function norm(c: PriceChange): PriceChange {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = c as any;
  if (r.type) return c;
  if (r.field === 'new') return { modelName: r.modelName, vendorName: r.vendorName, type: 'new', inputPrice: r.newValue, outputPrice: r.newOutputValue ?? 0, timestamp: r.timestamp };
  if (r.field === 'removed') return { modelName: r.modelName, vendorName: r.vendorName, type: 'removed', inputPrice: r.oldValue, outputPrice: r.oldOutputValue ?? 0, timestamp: r.timestamp };
  if (r.field === 'input') return { modelName: r.modelName, vendorName: r.vendorName, type: 'price_change', oldInput: r.oldValue, newInput: r.newValue, timestamp: r.timestamp };
  return { modelName: r.modelName, vendorName: r.vendorName, type: 'price_change', oldOutput: r.oldValue, newOutput: r.newValue, timestamp: r.timestamp };
}

function buildDateGroups(history: PriceChange[]): DateGroup[] {
  const batchMap = new Map<string, PriceChange[]>();
  for (const c of history) {
    const ts = c.timestamp.substring(0, 19);
    if (!batchMap.has(ts)) batchMap.set(ts, []);
    batchMap.get(ts)!.push(c);
  }

  const batches: Batch[] = [];
  for (const [ts, changes] of batchMap) {
    batches.push({
      key: ts,
      timestamp: ts,
      date: fmtDate(changes[0].timestamp),
      time: fmtTime(changes[0].timestamp),
      changes,
      priceChanges: changes.filter(c => c.type === 'price_change'),
      newModels: changes.filter(c => c.type === 'new'),
      removedModels: changes.filter(c => c.type === 'removed'),
    });
  }

  const dateMap = new Map<string, Batch[]>();
  for (const b of batches) {
    if (!dateMap.has(b.date)) dateMap.set(b.date, []);
    dateMap.get(b.date)!.push(b);
  }

  const groups: DateGroup[] = [];
  for (const [date, dBatches] of dateMap) {
    const all = dBatches.flatMap(b => b.changes);
    groups.push({
      date,
      batches: dBatches,
      totalChanges: all.length,
      totalPriceChanges: all.filter(c => c.type === 'price_change').length,
      totalNew: all.filter(c => c.type === 'new').length,
      totalRemoved: all.filter(c => c.type === 'removed').length,
    });
  }
  return groups;
}

/* ====== Chevron icon ====== */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`chevron-icon ${open ? 'open' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function ClientPage({ prices, history, error, fetchTime }: Props) {
  const [page, setPage] = useState<'changes' | 'pricing'>('changes');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState('');

  // 30分钟探测倒计时
  useEffect(() => {
    const calcCountdown = () => {
      const lastFetch = new Date(fetchTime).getTime();
      const nextFetch = lastFetch + 30 * 60 * 1000; // 30分钟后
      const now = Date.now();
      const diff = nextFetch - now;

      if (diff <= 0) {
        setCountdown('即将探测');
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    calcCountdown();
    const timer = setInterval(calcCountdown, 1000);
    return () => clearInterval(timer);
  }, [fetchTime]);

  const vendors = useMemo(() => Array.from(new Set(prices.map(p => p.vendorName))).sort(), [prices]);
  const filtered = useMemo(() => prices.filter(p => {
    if (vendorFilter !== 'all' && p.vendorName !== vendorFilter) return false;
    if (search && !p.modelName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [prices, vendorFilter, search]);

  const normalized = useMemo(() => history.map(norm), [history]);
  const dateGroups = useMemo(() => buildDateGroups(normalized), [normalized]);
  const realChangeCount = useMemo(() => normalized.filter(c => c.type === 'price_change').length, [normalized]);

  const toggleDate = useCallback((date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-12">
          <div className="text-amber-500 text-lg font-medium mb-3">{error}</div>
          <div className="text-gray-400 text-sm">请先运行探测脚本或等待 GitHub Actions 自动执行</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 py-5">
      {/* ===== Header ===== */}
      <header className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">API 模型定价</h1>
          <p className="text-xs text-gray-400 mt-1 tracking-wide">
            {prices.length} 个模型 · ¥/百万Tokens
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span className="font-mono">{fmtDateTime(fetchTime)}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded">
            <span className="text-gray-500">下次</span>
            <span className="font-mono font-medium text-gray-600">{countdown}</span>
          </div>
        </div>
      </header>

      {/* ===== Nav ===== */}
      <nav className="flex items-center gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setPage('changes')}
          className={`tab-btn ${page === 'changes' ? 'active' : ''}`}
        >
          变更日志
          {realChangeCount > 0 && (
            <span className="ml-2 text-[11px] bg-red-50 text-red-500 rounded-full px-2 py-0.5 font-bold">
              {realChangeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setPage('pricing')}
          className={`tab-btn ${page === 'pricing' ? 'active' : ''}`}
        >
          全部定价
        </button>
      </nav>

      {/* ============================================================ */}
      {/* 变更日志                                                      */}
      {/* ============================================================ */}
      {page === 'changes' && (
        <div className="space-y-2 min-h-[60vh]">
          {dateGroups.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-sm font-medium">暂无变更记录</div>
              <div className="text-xs mt-1.5 text-gray-300">首次探测后，后续变动将在此显示</div>
            </div>
          ) : (
            dateGroups.map(group => {
              const open = expandedDates.has(group.date);
              return (
                <div key={group.date} className="card-premium">
                  {/* ---- 日期行（可点击） ---- */}
                  <button
                    onClick={() => toggleDate(group.date)}
                    className="date-header-btn"
                  >
                    <Chevron open={open} />
                    <span className="text-sm font-bold text-gray-800 min-w-[100px]">{group.date}</span>

                    {/* 统计标签 */}
                    <div className="flex items-center gap-2.5 flex-1">
                      {group.totalPriceChanges > 0 && (
                        <span className="stat-pill bg-amber-50 text-amber-600">
                          {group.totalPriceChanges} 调价
                        </span>
                      )}
                      {group.totalNew > 0 && (
                        <span className="stat-pill bg-blue-50 text-blue-600">
                          +{group.totalNew} 新增
                        </span>
                      )}
                      {group.totalRemoved > 0 && (
                        <span className="stat-pill bg-gray-100 text-gray-500">
                          -{group.totalRemoved} 移除
                        </span>
                      )}
                    </div>

                    {/* 探测次数 */}
                    <span className="text-xs text-gray-300 font-mono whitespace-nowrap">{group.batches.length}次</span>
                  </button>

                  {/* ---- 展开内容（动画） ---- */}
                  <div className={`expand-wrapper ${open ? 'open' : ''}`}>
                    <div className="expand-inner">
                      <div className="expand-content-fade border-t border-gray-100">
                        {group.batches.map((batch, bi) => (
                          <div key={batch.key} className={bi > 0 ? 'border-t border-gray-50' : ''}>
                            {/* 时间戳 */}
                            {group.batches.length > 1 && (
                              <div className="batch-divider">
                                <span className="text-xs font-medium text-gray-400 font-mono">{batch.time}</span>
                              </div>
                            )}

                            {/* 价格调整 - 紧凑单行布局 */}
                            {batch.priceChanges.length > 0 && (
                              <div className="px-4 py-2.5">
                                {batch.priceChanges.map((c, i) => {
                                  const inC = c.oldInput != null && c.newInput != null && c.oldInput !== c.newInput;
                                  const outC = c.oldOutput != null && c.newOutput != null && c.oldOutput !== c.newOutput;
                                  const inUp = (c.newInput ?? 0) > (c.oldInput ?? 0);
                                  const outUp = (c.newOutput ?? 0) > (c.oldOutput ?? 0);
                                  return (
                                    <div key={c.modelName + i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/30">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-semibold text-gray-800 truncate">{c.modelName}</span>
                                        <span className="text-xs text-gray-400">{c.vendorName}</span>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                                        {inC && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-gray-400">入</span>
                                            <span className="text-gray-400 line-through">{fmtP(c.oldInput!)}</span>
                                            <span className="text-gray-300">{'\u2192'}</span>
                                            <span className={`font-bold ${inUp ? 'text-red-500' : 'text-emerald-600'}`}>{fmtP(c.newInput!)}</span>
                                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${inUp ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                              {pct(c.oldInput!, c.newInput!)}
                                            </span>
                                          </div>
                                        )}
                                        {outC && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-gray-400">出</span>
                                            <span className="text-gray-400 line-through">{fmtP(c.oldOutput!)}</span>
                                            <span className="text-gray-300">{'\u2192'}</span>
                                            <span className={`font-bold ${outUp ? 'text-red-500' : 'text-emerald-600'}`}>{fmtP(c.newOutput!)}</span>
                                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${outUp ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                              {pct(c.oldOutput!, c.newOutput!)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 新增模型 - 紧凑网格 */}
                            {batch.newModels.length > 0 && (
                              <div className="px-4 py-2.5">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">+</span>
                                  <span className="text-xs font-bold text-blue-600">新增 {batch.newModels.length} 个</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  {batch.newModels.map((c, i) => (
                                    <div key={c.modelName + i} className="model-card model-card-new">
                                      <span className="text-xs font-medium text-gray-800 truncate">{c.modelName}</span>
                                      <span className="text-[11px] font-mono text-blue-600">{fmtP(c.inputPrice ?? 0)}/{fmtP(c.outputPrice ?? 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 移除模型 - 紧凑标签 */}
                            {batch.removedModels.length > 0 && (
                              <div className="px-4 py-2.5">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-4 h-4 rounded-full bg-gray-400 text-white text-[10px] flex items-center justify-center font-bold">-</span>
                                  <span className="text-xs font-bold text-gray-500">移除 {batch.removedModels.length} 个</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {batch.removedModels.map((c, i) => (
                                    <span key={c.modelName + i} className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded text-xs line-through border border-gray-100">{c.modelName}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 全部定价                                                      */}
      {/* ============================================================ */}
      {page === 'pricing' && (
        <div className="min-h-[60vh]">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setVendorFilter('all')} className={`filter-chip ${vendorFilter === 'all' ? 'active' : 'inactive'}`}>
                全部 ({prices.length})
              </button>
              {vendors.map(v => {
                const cnt = prices.filter(p => p.vendorName === v).length;
                return (
                  <button key={v} onClick={() => setVendorFilter(v)} className={`filter-chip ${vendorFilter === v ? 'active' : 'inactive'}`}>
                    {v} ({cnt})
                  </button>
                );
              })}
            </div>
            <input type="text" placeholder="搜索模型..." value={search} onChange={e => setSearch(e.target.value)}
              className="search-input ml-auto w-40" />
          </div>

          <div className="card-premium">
            <div className="overflow-x-auto">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>模型名称</th>
                    <th>供应商</th>
                    <th className="text-right">输入 ¥/M</th>
                    <th className="text-right">输出 ¥/M</th>
                    <th className="text-right">比率</th>
                    <th>端点</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.modelName}>
                      <td className="font-semibold text-gray-900">{p.modelName}</td>
                      <td><span className={`vendor-badge ${VS[p.vendorName] || 'vendor-default'}`}>{p.vendorName}</span></td>
                      <td className="text-right price-cell text-blue-600">{fmtP(p.inputPrice)}</td>
                      <td className="text-right price-cell text-purple-600">{fmtP(p.outputPrice)}</td>
                      <td className="text-right text-gray-400 text-xs font-mono">{(p.outputPrice / p.inputPrice).toFixed(1)}x</td>
                      <td>
                        <div className="flex gap-1.5">
                          {p.endpoints.map(e => (<span key={e} className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-xs border border-gray-100">{e}</span>))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="text-center py-16 text-gray-400 text-sm">没有匹配的模型</div>}
          </div>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-gray-300 pb-6">
        数据来源：new2.882111.xyz · GitHub Actions 每30分钟自动探测
      </footer>
    </div>
  );
}
