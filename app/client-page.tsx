'use client';

import { useState, useMemo } from 'react';
import { PriceDisplay, PriceChange } from '@/lib/types';

interface Props {
  prices: PriceDisplay[];
  history: PriceChange[];
  error: string;
  fetchTime: string;
}

const VENDOR_STYLE: Record<string, string> = {
  Anthropic: 'vendor-anthropic',
  OpenAI: 'vendor-openai',
  Google: 'vendor-google',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatPrice(v: number) {
  return v < 10 ? `¥${v.toFixed(2)}` : `¥${v.toFixed(0)}`;
}

export default function ClientPage({ prices, history, error, fetchTime }: Props) {
  const [tab, setTab] = useState<'pricing' | 'changes'>('pricing');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const vendors = useMemo(() => {
    const set = new Set(prices.map(p => p.vendorName));
    return Array.from(set).sort();
  }, [prices]);

  const filtered = useMemo(() => {
    return prices.filter(p => {
      if (vendorFilter !== 'all' && p.vendorName !== vendorFilter) return false;
      if (search && !p.modelName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [prices, vendorFilter, search]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <div className="text-red-500 text-lg font-medium mb-2">数据获取失败</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            API 模型定价
          </h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
            {formatTime(fetchTime)} 更新
          </div>
        </div>
        <p className="text-sm text-gray-500">
          共 <span className="font-semibold text-gray-700">{prices.length}</span> 个模型 · 价格单位：¥/百万 Tokens
        </p>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        <button
          onClick={() => setTab('pricing')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pricing'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          当前定价
        </button>
        <button
          onClick={() => setTab('changes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
            tab === 'changes'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          变更记录
          {history.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-100 text-red-600 rounded-full font-semibold">
              {history.length > 99 ? '99+' : history.length}
            </span>
          )}
        </button>
      </div>

      {/* Pricing Tab */}
      {tab === 'pricing' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setVendorFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  vendorFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {vendors.map(v => (
                <button
                  key={v}
                  onClick={() => setVendorFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    vendorFilter === v
                      ? 'bg-gray-900 text-white'
                      : `${VENDOR_STYLE[v] || 'vendor-default'} hover:opacity-80`
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="搜索模型..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ml-auto px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-48"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>模型名称</th>
                    <th>供应商</th>
                    <th className="text-right">输入价格</th>
                    <th className="text-right">输出价格</th>
                    <th className="text-right">倍率</th>
                    <th>端点</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.modelName}>
                      <td className="font-medium text-gray-900">{p.modelName}</td>
                      <td>
                        <span className={`vendor-badge ${VENDOR_STYLE[p.vendorName] || 'vendor-default'}`}>
                          {p.vendorName}
                        </span>
                      </td>
                      <td className="text-right price-cell text-blue-600">
                        {formatPrice(p.inputPrice)}
                      </td>
                      <td className="text-right price-cell text-purple-600">
                        {formatPrice(p.outputPrice)}
                      </td>
                      <td className="text-right text-gray-400 text-xs">
                        {p.modelRatio}x / {p.completionRatio.toFixed(2)}x
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {p.endpoints.map(e => (
                            <span key={e} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded text-xs">
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                没有匹配的模型
              </div>
            )}
          </div>
        </>
      )}

      {/* Changes Tab */}
      {tab === 'changes' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-3">-</div>
              <div className="text-sm">暂无价格变更记录</div>
              <div className="text-xs mt-1 text-gray-300">首次探测后，后续变动将在此显示</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((c, i) => (
                <div key={`${c.modelName}-${c.field}-${c.timestamp}-${i}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    c.field === 'new' ? 'bg-blue-50 text-blue-500' :
                    c.field === 'removed' ? 'bg-gray-100 text-gray-400' :
                    (c.newValue! > c.oldValue!) ? 'bg-red-50 text-red-500' :
                    'bg-green-50 text-green-500'
                  }`}>
                    {c.field === 'new' ? '+' :
                     c.field === 'removed' ? '-' :
                     (c.newValue! > c.oldValue!) ? '↑' : '↓'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {c.modelName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {c.vendorName} · {c.field === 'input' ? '输入价格' : c.field === 'output' ? '输出价格' : c.field === 'new' ? '新增模型' : '已移除'}
                    </div>
                  </div>

                  {/* Change detail */}
                  <div className="text-right flex-shrink-0">
                    {(c.field === 'input' || c.field === 'output') && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">{formatPrice(c.oldValue!)}</span>
                        <span className="text-gray-300">→</span>
                        <span className={c.newValue! > c.oldValue! ? 'text-red-500 font-semibold' : 'text-green-500 font-semibold'}>
                          {formatPrice(c.newValue!)}
                        </span>
                      </div>
                    )}
                    {c.field === 'new' && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">新增</span>
                    )}
                    {c.field === 'removed' && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">移除</span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-xs text-gray-300 flex-shrink-0 w-24 text-right">
                    {formatTime(c.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-gray-300 pb-6">
        数据来源：new2.882111.xyz · 每次访问自动探测最新定价
      </footer>
    </div>
  );
}
