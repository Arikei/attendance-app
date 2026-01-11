'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
// ↓ 階層に合わせてパスを調整（src/app/class/[classId]/page.tsx から見て3つ上）
import { createClient } from '../../../utils/supabase/client'; 
import Link from 'next/link';

type AttendanceRow = {
  id: string; 
  lesson_date: string;
  period: number;
  memo: string;
  stamps: any;
};

export default function ClassDetail() {
  const params = useParams();
  const classId = params.classId as string;
  
  const [lessons, setLessons] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 新規追加用の入力ステート
  const [newDate, setNewDate] = useState('');
  const [newPeriod, setNewPeriod] = useState('1');
  const [isAdding, setIsAdding] = useState(false);

  const supabase = createClient();

  const fetchLessons = async () => {
    const { data, error } = await supabase
      .from('attendances')
      .select('*')
      .eq('class_id', classId)
      .order('lesson_date', { ascending: true })
      .order('period', { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setLessons(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (classId) fetchLessons();
  }, [classId]);

  // 日付フォーマット (例: 2026年-1月-1日-1限)
  const formatLessonString = (dateStr: string, period: number) => {
    const d = new Date(dateStr);

    const periodStr = period === 8 ? 'SHR' : `${period}限`; // 8限ならSHR

    if (isNaN(d.getTime())) return `${dateStr} - ${periodStr}`;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekDay = weekDays[d.getDay()];
    return `${year}年${month}月${day}日(${weekDay}) - ${periodStr}`;
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newPeriod) return;

    setIsAdding(true);

    const { error } = await supabase
      .from('attendances')
      .insert({
        class_id: classId,
        lesson_date: newDate,
        period: parseInt(newPeriod, 10),
        memo: '',
      });

    if (error) {
      alert('追加に失敗しました: ' + error.message);
    } else {
      setNewDate('');
      fetchLessons();
    }
    setIsAdding(false);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm('本当にこの授業を削除しますか？\n（出席データも消えます）')) {
      return;
    }

    const { error } = await supabase
      .from('attendances')
      .delete()
      .eq('id', lessonId);

    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      fetchLessons();
    }
  };

  if (loading) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link href="/" className="mr-4 text-gray-500 hover:text-blue-600 font-bold">
              &larr; 戻る
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">授業一覧</h1>
          </div>
          <Link href="/import" className="text-sm text-green-600 hover:underline">
            📄 Excelで一括追加はこちら
          </Link>
        </div>

        {/* 新規追加フォーム */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📅 新しい授業を追加</h2>
          <form onSubmit={handleAddLesson} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">日付</label>
              <input 
                type="date" 
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">時限</label>
              <select 
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                className="border border-gray-300 rounded-lg p-2.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}限</option>
                ))}
              </select>
            </div>
            <button 
              type="submit" 
              disabled={isAdding}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition"
            >
              {isAdding ? '追加中...' : '追加'}
            </button>
          </form>
        </div>

        {/* 授業リスト */}
        <div className="grid gap-4">
          {lessons.length === 0 ? (
            <div className="p-8 bg-white rounded-xl shadow text-center text-gray-500">
              <p>授業予定がありません。</p>
              <p className="text-sm mt-2">上記から追加するか、Excelから登録してください。</p>
            </div>
          ) : (
            lessons.map((lesson) => (
              <div 
                key={lesson.id}
                className="group bg-white rounded-xl shadow-sm hover:shadow-md transition border-l-4 border-blue-500 flex items-stretch overflow-hidden"
              >
                {/* リンクエリア（左側全体） */}
                <Link
                  href={`/class/${classId}/${lesson.lesson_date}/${lesson.period}`}
                  className="flex-grow p-6 flex flex-col justify-center hover:bg-gray-50 transition"
                >
                  <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition">
                    {formatLessonString(lesson.lesson_date, lesson.period)}
                  </h2>
                  {lesson.memo && (
                    <div className="text-gray-500 mt-2 text-sm whitespace-pre-wrap leading-relaxed">
                      📝 {lesson.memo}
                    </div>                  
                  )}
                </Link>

                {/* 削除ボタンエリア（右側固定） */}
                <div className="flex items-center px-4 border-l border-gray-100 bg-gray-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLesson(lesson.id);
                    }}
                    className="p-3 bg-white text-gray-400 border border-gray-200 rounded-full hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition shadow-sm"
                    title="削除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

// update layout