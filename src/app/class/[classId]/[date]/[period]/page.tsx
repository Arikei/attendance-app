'use client';

import { useState, useRef, MouseEvent, useEffect, use, TouchEvent } from 'react';
import Link from 'next/link';
// getMemo, saveMemo を追加でインポート
import { 
  getActiveSeatMap, 
  saveSeatMap, 
  fetchStamps, 
  saveStamps, 
  getMemo,  // 追加
  saveMemo, // 追加
  Stamp 
} from '../../../../../utils/db'; 

export default function AttendancePage({ 
  params 
}: { 
  params: Promise<{ classId: string; date: string; period: string }> 
}) {
  const resolvedParams = use(params);
  const { classId, date, period } = resolvedParams;
  
  const displayDate = decodeURIComponent(date);
  const periodNum = parseInt(period, 10);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [memo, setMemo] = useState(''); // ★ メモ用ステート
  const [loading, setLoading] = useState(true);
  
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const imgContainerRef = useRef<HTMLDivElement>(null);

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // メモも一緒に読み込む
      const [img, savedStamps, savedMemo] = await Promise.all([
        getActiveSeatMap(classId, displayDate),
        fetchStamps(classId, displayDate, periodNum),
        getMemo(classId, displayDate, periodNum) // ★ 追加
      ]);
      
      if (img) setImageSrc(img);
      setStamps(savedStamps);
      setMemo(savedMemo); // ★ セット
      setLoading(false);
    };
    loadData();
  }, [classId, displayDate, periodNum]);

  // スタンプの自動保存
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      saveStamps(classId, displayDate, periodNum, stamps);
    }, 500); 
    return () => clearTimeout(timer);
  }, [stamps, classId, displayDate, periodNum, loading]);

  // ★ メモの保存（フォーカスが外れた時に保存）
  const handleMemoBlur = () => {
    saveMemo(classId, displayDate, periodNum, memo);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === 'string') {
        const newImage = event.target.result;
        setImageSrc(newImage);
        await saveSeatMap(classId, displayDate, newImage);
      }
    };
    reader.readAsDataURL(file);
  };

  const getCoordinates = (clientX: number, clientY: number) => {
    if (!imgContainerRef.current) return null;
    const rect = imgContainerRef.current.getBoundingClientRect();
    return {
      // 幅と高さに対する割合（%）に変換する
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  // --- 操作ロジック (変更なし) ---
  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isDeleteMode) return;
    if (draggingId !== null) { setDraggingId(null); return; }
    const coords = getCoordinates(e.clientX, e.clientY);
    if (!coords) return;
    setStamps((prev) => [...prev, { id: Date.now(), x: coords.x, y: coords.y }]);
  };

  const handleStampClick = (e: MouseEvent | TouchEvent, id: number) => {
    e.stopPropagation();
    if (isDeleteMode) { setStamps((prev) => prev.filter((s) => s.id !== id)); }
  };

  const handleStampMouseDown = (e: MouseEvent | TouchEvent, id: number) => {
    e.stopPropagation(); 
    if (isDeleteMode) return;
    setDraggingId(id);
  };

  const handleContainerMove = (clientX: number, clientY: number) => {
    if (draggingId === null) return;
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;
    setStamps((prev) => prev.map((s) => (s.id === draggingId ? { ...s, x: coords.x, y: coords.y } : s)));
  };

  const onMouseMove = (e: MouseEvent) => { handleContainerMove(e.clientX, e.clientY); };
  const onTouchMove = (e: TouchEvent) => { handleContainerMove(e.touches[0].clientX, e.touches[0].clientY); };
  const handleDragEnd = () => { setDraggingId(null); };

  if (loading) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <main className="min-h-screen bg-gray-100 p-4 select-none">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <Link href={`/class/${classId}`} className="text-blue-500 hover:underline">
            &larr; 戻る
          </Link>
          <h1 className="text-xl font-bold text-gray-800">{displayDate} - {periodNum}限</h1>
          
          <button
            onClick={() => setIsDeleteMode(!isDeleteMode)}
            className={`px-4 py-2 rounded-lg font-bold shadow transition flex items-center gap-2 ${
              isDeleteMode 
                ? 'bg-red-600 text-white ring-4 ring-red-200' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isDeleteMode ? '🗑️ 削除モード中' : '✏️ 追加・移動モード'}
          </button>
        </div>

        {/* ★ メモ欄の追加 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-600 mb-1">📝 メモ</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={handleMemoBlur} // フォーカスが外れたら保存
            placeholder="授業のメモを入力..."
            className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-200 focus:outline-none bg-yellow-50 min-h-[80px]"
          />
        </div>

        {!imageSrc ? (
          <div className="text-center py-10">
            <p className="mb-4 text-gray-600">座席表が設定されていません</p>
            {/* 継承ロジックが入ったため、ここに表示されるのは「過去にも一枚も登録がない場合」のみです */}
            <label className="bg-blue-600 text-white font-bold py-3 px-6 rounded-full cursor-pointer inline-block hover:bg-blue-700">
              <span>📷 座席表を新規登録</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            <p className="mt-2 text-xs text-gray-400">※登録すると、今日以降の授業にもこの座席表が適用されます</p>
          </div>
        ) : (
          <div>
            <div className={`p-2 mb-2 text-sm text-center rounded flex justify-between items-center ${isDeleteMode ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              <span className="flex-1 text-center">
                {isDeleteMode 
                  ? '「欠」をタップして削除してください' 
                  : 'タップで追加 / ドラッグで移動'}
              </span>
              {/* 画像変更ボタン（小さく表示） */}
              <label className="text-xs bg-white border px-2 py-1 rounded cursor-pointer shadow-sm text-gray-600 ml-2 hover:bg-gray-100">
                📷 画像更新
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="overflow-auto flex justify-center bg-gray-200 p-4 rounded-lg border touch-none">
              <div
                ref={imgContainerRef}
                onClick={handleContainerClick}
                onMouseMove={onMouseMove}
                onTouchMove={onTouchMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchEnd={handleDragEnd}
                className={`relative inline-block bg-white shadow ${isDeleteMode ? 'cursor-pointer' : 'cursor-crosshair'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="座席表"
                  className="max-w-full h-auto block pointer-events-none"
                  style={{ maxHeight: '75vh' }}
                />
                
                {stamps.map((stamp) => (
                  <div
                    key={stamp.id}
                    onClick={(e) => handleStampClick(e, stamp.id)} 
                    onMouseDown={(e) => handleStampMouseDown(e, stamp.id)}
                    onTouchStart={(e) => handleStampMouseDown(e, stamp.id)}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform
                      ${isDeleteMode 
                        ? 'cursor-pointer hover:scale-110 z-10 opacity-80 hover:opacity-100' 
                        : (draggingId === stamp.id ? 'scale-125 cursor-grabbing z-10' : 'cursor-grab hover:scale-110 z-0') 
                      }
                    `}
                    style={{ left: `${stamp.x}%`, top: `${stamp.y}%` }}
                  >
                    <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-md select-none text-white"
                          style={{ 
                            // Tailwindを使わず、直接カラーコードを指定して強制的に色をつけます
                            backgroundColor: isDeleteMode ? '#6b7280' : '#ef4444' 
                          }}
                        >
                          <span className="font-bold text-xl leading-none">
                            {isDeleteMode ? '×' : '欠'}
                          </span>
                        </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}