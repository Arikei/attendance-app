'use client';

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import * as XLSX from 'xlsx';
import Link from 'next/link';

export default function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const supabase = createClient();

  // Excelの日付シリアル値（数値）を YYYY-MM-DD 形式に変換する関数
  const formatExcelDate = (serial: any) => {
    if (!serial) return null;

    // もし数値（46113など）で来た場合
    if (typeof serial === 'number') {
      // Excelの基準日(1900/1/1)とJSの基準日(1970/1/1)の差分(25569日)を調整
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);

      // ズレを防ぐためUTCで年を取得
      const year = date_info.getUTCFullYear();
      const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date_info.getUTCDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }

    // 文字列（2026/04/01など）で来た場合は、/ を - に置換して返す
    let str = String(serial).trim();
    // "2026/04/01" -> "2026-04-01"
    str = str.replace(/\//g, '-');
    return str;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setLogs(['ファイルを解析中...']);

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        setLogs((prev) => [...prev, `${rows.length}件のデータが見つかりました。解析を開始します...`]);

        for (const row of rows) {
          // 列名のスペース削除処理
          const cleanRow: any = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key.trim().split(' ')[0]; 
            cleanRow[cleanKey] = row[key];
          });

          const rawClassName = cleanRow['ClassName'] || cleanRow['Class'];
          const rawDate = cleanRow['Date'];
          const rawPeriod = cleanRow['Period'];
          const rawNote = cleanRow['Note'];

          if (!rawClassName || !rawDate || !rawPeriod) {
            continue;
          }

          const classNameStr = String(rawClassName).trim();
          
          // ★ここで日付変換関数を使う
          const formattedDate = formatExcelDate(rawDate);

          if (!formattedDate) {
             setLogs((prev) => [...prev, `⚠️ 日付エラーのためスキップ: ${classNameStr}`]);
             continue;
          }

          // 1. クラス作成または取得
          let classId: string | null = null;
          const { data: existingClass } = await supabase
            .from('classes')
            .select('id')
            .eq('name', classNameStr)
            .single();

          if (existingClass) {
            classId = existingClass.id;
          } else {
            const { data: newClass } = await supabase
              .from('classes')
              .insert({ name: classNameStr })
              .select()
              .single();
            
            if (newClass) {
              classId = newClass.id;
              setLogs((prev) => [...prev, `✨ 新規クラス作成: ${classNameStr}`]);
            }
          }

          // 2. 登録
          if (classId) {
            const periodNum = parseInt(String(rawPeriod).replace(/[^0-9]/g, ''), 10);

            const { error: insertError } = await supabase
              .from('attendances')
              .insert({
                class_id: classId,
                lesson_date: formattedDate, // 変換後の日付を入れる
                period: periodNum,
                memo: rawNote || '',
              });

            if (insertError) {
              // すでに登録済み（重複）エラーの場合は無視、それ以外はログ出す
              if (insertError.code !== '23505') { 
                console.error(insertError);
                setLogs((prev) => [...prev, `❌ 失敗: ${formattedDate} - ${insertError.message}`]);
              }
            }
          }
        }
        setLogs((prev) => [...prev, '✅ 全ての処理が完了しました！']);

      } catch (error) {
        console.error(error);
        setLogs((prev) => [...prev, 'エラーが発生しました。']);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Excel一括登録</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
             トップに戻る
          </Link>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            Excelファイル(.xlsx)をアップロードしてください。
          </p>
          <div className="bg-gray-100 p-3 rounded text-sm font-mono overflow-x-auto whitespace-nowrap">
            ClassName | Date | Period | Note
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 p-10 text-center rounded-lg hover:bg-gray-50 transition relative">
          <input 
            type="file" 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-gray-500">
             {uploading ? '処理中...' : 'ここにファイルをドラッグ＆ドロップ'}
          </div>
        </div>

        <div className="mt-6 bg-black text-green-400 p-4 rounded h-64 overflow-y-auto text-sm font-mono">
          {logs.length === 0 ? (
            <p className="text-gray-500">実行ログ...</p>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}