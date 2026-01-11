'use client';

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import * as XLSX from 'xlsx';
import Link from 'next/link';

export default function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const supabase = createClient();

  // ----------------------------------------------------------------
  // 共通関数: Excelの日付シリアル値を YYYY-MM-DD に変換
  // ----------------------------------------------------------------
  const formatExcelDate = (serial: any) => {
    if (!serial) return null;
    // 数値（シリアル値）の場合
    if (typeof serial === 'number') {
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      const year = date_info.getUTCFullYear();
      const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date_info.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // 文字列の場合
    let str = String(serial).trim();
    str = str.replace(/\//g, '-');
    return str;
  };

  // 共通関数: ファイル読み込み処理
  const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  // ----------------------------------------------------------------
  // 1. 授業データのインポート処理 (既存のロジック)
  // ----------------------------------------------------------------
  const handleLessonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setLogs(['【授業登録】ファイルを解析中...']);

    try {
      const rows = await parseFile(file);
      setLogs((prev) => [...prev, `${rows.length}件のデータが見つかりました。処理を開始します...`]);

      for (const row of rows as any[]) {
        // キーのスペース削除など
        const cleanRow: any = {};
        Object.keys(row).forEach((key) => {
          const cleanKey = key.trim().split(' ')[0]; 
          cleanRow[cleanKey] = row[key];
        });

        const rawClassName = cleanRow['ClassName'] || cleanRow['Class'];
        const rawDate = cleanRow['Date'];
        const rawPeriod = cleanRow['Period'];
        const rawNote = cleanRow['Note'];

        if (!rawClassName || !rawDate || !rawPeriod) continue;

        const classNameStr = String(rawClassName).trim();
        const formattedDate = formatExcelDate(rawDate);

        if (!formattedDate) {
           setLogs((prev) => [...prev, `⚠️ 日付エラーのためスキップ: ${classNameStr}`]);
           continue;
        }

        // クラス取得または作成
        let classId: string | null = null;
        const { data: existingClass } = await supabase.from('classes').select('id').eq('name', classNameStr).single();

        if (existingClass) {
          classId = existingClass.id;
        } else {
          const { data: newClass } = await supabase.from('classes').insert({ name: classNameStr }).select().single();
          if (newClass) {
            classId = newClass.id;
            setLogs((prev) => [...prev, `✨ 新規クラス作成: ${classNameStr}`]);
          }
        }

        if (classId) {
          const periodNum = parseInt(String(rawPeriod).replace(/[^0-9]/g, ''), 10);
          const { error } = await supabase.from('attendances').insert({
            class_id: classId,
            lesson_date: formattedDate,
            period: periodNum,
            memo: rawNote || '',
          });
          if (error && error.code !== '23505') {
            setLogs((prev) => [...prev, `❌ 失敗: ${formattedDate} - ${error.message}`]);
          }
        }
      }
      setLogs((prev) => [...prev, '✅ 授業データの登録が完了しました！']);
    } catch (error) {
      console.error(error);
      setLogs((prev) => [...prev, '❌ エラーが発生しました。']);
    } finally {
      setUploading(false);
      // inputをリセット（同じファイルを再度選べるように）
      e.target.value = '';
    }
  };

  // ----------------------------------------------------------------
  // 2. カレンダーメモのインポート処理 (今回追加)
  // ----------------------------------------------------------------
  const handleMemoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setLogs(['【メモ登録】ファイルを解析中...']);

    try {
      const rows = await parseFile(file);
      setLogs((prev) => [...prev, `${rows.length}件のメモデータが見つかりました。`]);

      const updates = [];

      for (const row of rows as any[]) {
        // キーの揺れに対応 (Date/MemoDate, Content/Memo/Note)
        const cleanRow: any = {};
        Object.keys(row).forEach((key) => {
           cleanRow[key.trim().toLowerCase()] = row[key];
        });

        // "date" や "memodate" などを探す
        const rawDate = cleanRow['date'] || cleanRow['memodate'];
        // "content" や "memo" や "note" を探す
        const rawContent = cleanRow['content'] || cleanRow['memo'] || cleanRow['note'];

        if (!rawDate || !rawContent) continue;

        const formattedDate = formatExcelDate(rawDate);
        if (!formattedDate) continue;

        // 一括更新用に配列にためる
        updates.push({
          memo_date: formattedDate,
          content: rawContent
        });
      }

      if (updates.length > 0) {
        // Upsert実行 (日付が被ったら上書き)
        const { error } = await supabase
          .from('daily_memos')
          .upsert(updates, { onConflict: 'memo_date' });
        
        if (error) {
          setLogs((prev) => [...prev, `❌ データベースエラー: ${error.message}`]);
        } else {
          setLogs((prev) => [...prev, `✅ ${updates.length}件のメモを登録・更新しました！`]);
        }
      } else {
        setLogs((prev) => [...prev, '⚠️ 有効なデータが見つかりませんでした。列名を確認してください。']);
      }

    } catch (error) {
      console.error(error);
      setLogs((prev) => [...prev, '❌ エラーが発生しました。']);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow">
        
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800">Excel一括登録</h1>
          <Link href="/" className="text-blue-600 hover:underline font-bold">
             &larr; トップに戻る
          </Link>
        </div>

        {/* 2つのアップロードエリア */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* 左：授業登録 */}
          <div className="border border-blue-200 bg-blue-50 rounded-xl p-6 relative">
            <h2 className="text-lg font-bold text-blue-800 mb-2">📚 1. 授業データの登録</h2>
            <p className="text-sm text-gray-600 mb-4 h-10">
              時間割を一括登録します。<br/>
              <span className="text-xs text-gray-500">列名: ClassName | Date | Period | Note</span>
            </p>
            
            <div className="border-2 border-dashed border-blue-300 bg-white p-6 text-center rounded-lg hover:bg-blue-50 transition cursor-pointer relative group">
              <input 
                type="file" 
                onChange={handleLessonUpload} 
                accept=".xlsx, .xls" 
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <span className="text-blue-600 font-bold group-hover:scale-105 inline-block transition">
                {uploading ? '処理中...' : '📂 授業Excelを選択'}
              </span>
            </div>
          </div>

          {/* 右：メモ登録 */}
          <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-6 relative">
            <h2 className="text-lg font-bold text-yellow-800 mb-2">📅 2. カレンダーメモ登録</h2>
            <p className="text-sm text-gray-600 mb-4 h-10">
              行事や祝日を一括登録します。<br/>
              <span className="text-xs text-gray-500">列名: Date | Content (または Memo)</span>
            </p>
            
            <div className="border-2 border-dashed border-yellow-300 bg-white p-6 text-center rounded-lg hover:bg-yellow-50 transition cursor-pointer relative group">
              <input 
                type="file" 
                onChange={handleMemoUpload} 
                accept=".xlsx, .xls" 
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <span className="text-yellow-700 font-bold group-hover:scale-105 inline-block transition">
                {uploading ? '処理中...' : '📂 メモExcelを選択'}
              </span>
            </div>
          </div>

        </div>

        {/* ログウィンドウ */}
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm shadow-inner">
          {logs.length === 0 ? (
            <p className="text-gray-500 opacity-50">ここに実行ログが表示されます...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
                {log}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}