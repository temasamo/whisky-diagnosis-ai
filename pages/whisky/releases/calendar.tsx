import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

interface ReleaseItem {
  id: string;
  brand: string;
  expression: string;
  source_type: string;
  announced_date: string | null;
  on_sale_date: string | null;
  market: string;
  retailer?: string;
  source_org?: string;
  source_url?: string;
  price_minor?: number | null;
  currency?: string | null;
  stock_status?: string | null;
  created_at: string;
  type: 'announced' | 'on_sale';
}

interface CalendarInfo {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  firstDayOfWeek: number;
  lastDayOfWeek: number;
}

export default function ReleaseCalendar() {
  const router = useRouter();
  const [calendarData, setCalendarData] = useState<Record<string, ReleaseItem[]>>({});
  const [calendarInfo, setCalendarInfo] = useState<CalendarInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [market, setMarket] = useState<string>("ALL");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchCalendarData();
  }, [year, month, market]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/whisky/releases/calendar?year=${year}&month=${month}&market=${market}`);
      if (!res.ok) {
        throw new Error(`Error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setCalendarData(data.releases);
      setCalendarInfo(data.calendarInfo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getDayType = (day: number, releases: ReleaseItem[]) => {
    if (!releases || releases.length === 0) return '';
    
    const hasOnSale = releases.some(r => r.type === 'on_sale');
    const hasAnnounced = releases.some(r => r.type === 'announced');
    
    if (hasOnSale && hasAnnounced) return 'both';
    if (hasOnSale) return 'on_sale';
    if (hasAnnounced) return 'announced';
    return '';
  };

  const renderCalendarDays = () => {
    if (!calendarInfo) return null;

    const days = [];
    const { totalDays, firstDayOfWeek } = calendarInfo;

    // 前月の空白日
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 border border-gray-200 bg-gray-50"></div>
      );
    }

    // 当月の日付
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const releases = calendarData[dateStr] || [];
      const dayType = getDayType(day, releases);
      const isToday = dateStr === new Date().toISOString().slice(0, 10);
      const isSelected = selectedDate === dateStr;

      days.push(
        <div
          key={day}
          className={`h-24 border border-gray-200 p-1 cursor-pointer hover:bg-gray-50 ${
            isToday ? 'bg-blue-50 border-blue-300' : ''
          } ${isSelected ? 'bg-amber-50 border-amber-300' : ''}`}
          onClick={() => setSelectedDate(selectedDate === dateStr ? null : dateStr)}
        >
          <div className="flex justify-between items-start">
            <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
              {day}
            </span>
            {dayType && (
              <div className="flex space-x-1">
                {dayType.includes('on_sale') && (
                  <span className="w-2 h-2 bg-green-500 rounded-full" title="発売日"></span>
                )}
                {dayType.includes('announced') && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full" title="発表日"></span>
                )}
              </div>
            )}
          </div>
          {releases.length > 0 && (
            <div className="mt-1">
              <span className="text-xs text-gray-600">
                {releases.length}件
              </span>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const renderSelectedDateDetails = () => {
    if (!selectedDate || !calendarData[selectedDate]) return null;

    const releases = calendarData[selectedDate];
    const onSaleReleases = releases.filter(r => r.type === 'on_sale');
    const announcedReleases = releases.filter(r => r.type === 'announced');

    return (
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          {formatDate(selectedDate)} のリリース
        </h3>
        
        {onSaleReleases.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-green-600 mb-2 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              発売日 ({onSaleReleases.length}件)
            </h4>
            <div className="space-y-2">
              {onSaleReleases.map((release) => (
                <div key={`${release.id}-on_sale`} className="border-l-4 border-green-500 pl-3 py-2">
                  <div className="font-medium">{release.brand} - {release.expression}</div>
                  <div className="text-sm text-gray-600">
                    市場: {release.market} | 出典: {release.source_org || 'Unknown'}
                  </div>
                  {release.source_url && (
                    <a 
                      href={release.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      詳細を見る →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {announcedReleases.length > 0 && (
          <div>
            <h4 className="text-md font-medium text-orange-600 mb-2 flex items-center">
              <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
              発表日 ({announcedReleases.length}件)
            </h4>
            <div className="space-y-2">
              {announcedReleases.map((release) => (
                <div key={`${release.id}-announced`} className="border-l-4 border-orange-500 pl-3 py-2">
                  <div className="font-medium">{release.brand} - {release.expression}</div>
                  <div className="text-sm text-gray-600">
                    市場: {release.market} | 出典: {release.source_org || 'Unknown'}
                  </div>
                  {release.source_url && (
                    <a 
                      href={release.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      詳細を見る →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="text-center p-4">読み込み中...</div>;
  if (error) return <div className="text-center p-4 text-red-500">エラー: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4">
      <Head>
        <title>ウイスキー発売日カレンダー - ウイスキー診断AI</title>
      </Head>

      {/* ヘッダー */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ウイスキー発売日カレンダー</h1>
            <p className="mt-2 text-gray-600">発売日と発表日をカレンダー形式で確認</p>
          </div>
          <div className="flex space-x-2">
            <Link
              href="/whisky"
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              ウイスキー検索
            </Link>
            <Link
              href="/"
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
            >
              ホーム
            </Link>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← 前月
            </button>
            <h2 className="text-xl font-semibold">
              {year}年{month}月
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              次月 →
            </button>
            <button
              onClick={goToToday}
              className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              今日
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">市場:</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1"
            >
              <option value="ALL">すべて</option>
              <option value="JP">日本</option>
              <option value="UK">イギリス</option>
              <option value="Global">グローバル</option>
            </select>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div className="mb-4 bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span>発売日</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
            <span>発表日</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            <span>今日</span>
          </div>
        </div>
      </div>

      {/* カレンダー */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-7">
          {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
            <div key={day} className="p-3 text-center font-semibold bg-gray-100 border-b border-gray-200">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {renderCalendarDays()}
        </div>
      </div>

      {/* 選択日付の詳細 */}
      {renderSelectedDateDetails()}
    </div>
  );
}
