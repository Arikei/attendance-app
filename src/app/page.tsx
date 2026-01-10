'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../utils/supabase/client';
import Link from 'next/link';

// ▼ 許可するユーザーを制限したい場合はここにメールアドレスを書く
// （空っぽのままなら、Googleアカウントを持っている人は誰でも入れます）
const ALLOWED_EMAILS: string[] = [
  'readings1218@gmail.com', 
  // 'teacher@university.ac.jp',
];

type ClassItem = {
  id: number;
  name: string;
};

type ScheduleItem = {
  id: string;
  lesson_date: string;
  period: number;
  memo: string | null;
  classes: {
    name: string;
    id: number; 
  } | null;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // ログイン確認中か？
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const supabase = createClient();

  // ■ 1. 初回ロード時にユーザー確認
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsAuthLoading(false); // 確認完了

      // ユーザーがいて、かつリスト取得が必要なら取得
      if (user) {

        // 今日の日付をセット
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setSelectedDate(todayStr);

        fetchClasses();
        fetchMonthlySchedule(d);
      }
    };
    checkUser();
  }, []);

  // ■ 2. 授業データの取得
  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('id', { ascending: true });

    if (!error) {
      setClasses(data || []);
    }
    setLoadingClasses(false);
  };

  // ■ 3. ログイン処理
  const handleLogin = async () => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  };

  // ■ 4. ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.reload();
  };

  // ■ 5. 授業追加
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;

    const { error } = await supabase.from('classes').insert({ name: newClassName });
    if (error) alert('エラー: ' + error.message);
    else {
      setNewClassName('');
      fetchClasses();
    }
  };

  // ■ 6. 授業削除
  const handleDeleteClass = async (id: number) => {
    if (!window.confirm('削除しますか？')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) {
      setClasses(classes.filter((c) => String(c.id) !== String(id)));
    }
  };

// ■ 4. カレンダーデータの取得
  const fetchMonthlySchedule = async (date: Date) => {
    setLoadingSchedule(true);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayObj = new Date(year, month, 0);
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDayObj.getDate()}`;

    // 授業データと授業名を結合して取得
    const { data, error } = await supabase
      .from('attendances')
      .select(`
        *,
        classes!fk_classes ( name ,id)
      `)
      .gte('lesson_date', startDate)
      .lte('lesson_date', endDate)
      .order('period', { ascending: true });
    console.log('【確認用】取得できたデータ:', data);
    console.log('【確認用】エラーの内容:', error);
    if (error) {
      console.error('Error fetching schedule:', error);
    } else {
      setSchedules(data as any[] || []);
    }
    setLoadingSchedule(false);
  };

  // ■ 5. カレンダー操作
  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
    fetchMonthlySchedule(newDate);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({ date: dateStr, day: d, dayOfWeek });
    }
    return days;
  };

  // 表示ロジック
  const selectedSchedules = schedules.filter(s => s.lesson_date === selectedDate);
  const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]; // 1限〜8限
  // ---------------------------------------------------------
  // ▼ 表示の切り替えロジック
  // ---------------------------------------------------------

  // A. まだログイン確認中なら「読み込み中...」
  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">確認中...</div>;
  }

  // B. ログインしていない場合 → 【ログイン専用画面】を表示
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">UniLog 🎓</h1>
          <p className="text-gray-500 mb-8">出欠管理システムへようこそ</p>
          
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-3 px-4 rounded-lg transition shadow-sm"
          >
            <span className="text-xl">G</span>
            Googleアカウントでログイン
          </button>
        </div>
      </div>
    );
  }

  // C. 特定のメールアドレス以外を弾く設定（必要な場合）
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <p className="text-red-600 font-bold">このアカウント権限がありません。</p>
        <button onClick={handleLogout} className="underline text-gray-500">ログアウト</button>
      </div>
    );
  }

  // D. ログイン済み → 【いつもの出欠管理アプリ】を表示
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* ヘッダー */}
        <div className="flex items-end justify-between mb-10 border-b pb-4">
          <h1 className="text-3xl font-bold text-blue-600">
            UniLog 🎓 <span className="text-gray-500 text-base font-normal">出欠管理</span>
          </h1>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            <button 
              onClick={handleLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-2 px-4 rounded transition"
            >
              ログアウト
            </button>
            <Link href="/import" className="text-green-600 hover:text-green-800 font-bold text-sm flex items-center hover:underline">
              📄 Excel登録
            </Link>
          </div>
        </div>

        {/* 新規登録フォーム */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📚 授業を登録する</h2>
          <form onSubmit={handleAddClass} className="flex gap-4">
            <input
              type="text"
              placeholder="授業名を入力（例: 経済学概論）"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-grow border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button 
              type="submit"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm"
            >
              追加
            </button>
          </form>
        </div>

        {/* 授業リスト */}
        <div className="space-y-4">
          {loadingClasses ? (
             <div className="text-center py-10">データを読み込み中...</div>
          ) : classes.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              授業が登録されていません。
            </div>
          ) : (
            classes.map((c) => (
              <div 
                key={c.id} 
                className="group bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex items-center justify-between"
              >
                <Link 
                  href={`/class/${c.id}`} 
                  className="text-xl font-bold text-gray-800 hover:text-blue-600 flex-grow"
                >
                  {c.name}
                </Link>
                <button
                  onClick={() => handleDeleteClass(c.id)}
                  className="ml-4 text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>{/* 月間スケジュール表 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* 月操作ヘッダー */}
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center sticky left-0">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-200 rounded">◀ 前月</button>
            <h2 className="text-xl font-bold text-gray-800">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-200 rounded">次月 ▶</button>
          </div>

          {/* 時間割テーブル */}
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm">
                  <th className="p-3 border text-left min-w-[100px] sticky left-0 bg-gray-100 z-10">日付</th>
                  {PERIODS.map(p => (
                    <th key={p} className="p-3 border min-w-[120px] text-center">{p}限</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingSchedule ? (
                  <tr><td colSpan={9} className="p-10 text-center">読み込み中...</td></tr>
                ) : (
                  getDaysInMonth().map((day) => {
                    const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                    const rowBg = day.dayOfWeek === 0 ? 'bg-red-50' : day.dayOfWeek === 6 ? 'bg-blue-50' : 'bg-white';

                    return (
                      <tr key={day.date} className={rowBg}>
                        {/* 日付カラム */}
                        <td className={`p-3 border font-bold text-sm sticky left-0 z-10 ${rowBg}`}>
                          <span className={day.dayOfWeek === 0 ? 'text-red-500' : day.dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-800'}>
                            {day.day}日 ({WEEK_DAYS[day.dayOfWeek]})
                          </span>
                        </td>

                        {/* 1限〜8限のセル */}
                        {PERIODS.map((period) => {
                          // この日・この時限の授業を探す
                          const lesson = schedules.find(s => s.lesson_date === day.date && s.period === period);
                          
                          return (
                            <td key={period} className="p-2 border h-16 align-top">
                              {lesson && lesson.classes ? (
                                // ★ここをLinkタグに変更してクリック可能にしました
                                <Link 
                                  href={`/class/${lesson.classes.id}`}
                                  className="block w-full h-full bg-blue-100 text-blue-800 p-2 rounded text-xs md:text-sm font-bold shadow-sm flex flex-col justify-center text-center hover:bg-blue-200 transition duration-150 transform hover:scale-[1.02]"
                                >
                                  <span>{lesson.classes.name}</span>
                                  {lesson.memo && <span className="text-[10px] text-blue-600 font-normal mt-1 truncate">{lesson.memo}</span>}
                                </Link>
                              ) : (
                                <span className="text-gray-200 text-xs text-center block h-full flex items-center justify-center">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}