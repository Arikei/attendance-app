import { createClient } from '@supabase/supabase-js';

// 環境変数からSupabaseの接続情報を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabaseクライアントの初期化
export const supabase = createClient(supabaseUrl, supabaseKey);

// --- 型定義 ---

export interface Stamp {
  id: number;
  x: number;
  y: number;
}

export interface ClassData {
  id: string;
  name: string;
  created_at?: string;
}

export interface LessonInfo {
  lesson_date: string;
  period: number;
}

// --- クラス管理 ---

// クラス一覧を取得
export const fetchClasses = async (): Promise<ClassData[]> => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
  return data || [];
};

// クラスを新規作成
export const createClass = async (className: string) => {
  const { data, error } = await supabase
    .from('classes')
    .insert([{ name: className }])
    .select();

  if (error) {
    console.error('Error creating class:', error);
    throw error;
  }
  return data;
};

// --- 授業・出席管理 ---

// 授業一覧を取得 (日付 + 時限)
export const fetchLessonDates = async (classId: string): Promise<LessonInfo[]> => {
  const { data, error } = await supabase
    .from('attendances')
    .select('lesson_date, period')
    .eq('class_id', classId)
    .order('lesson_date', { ascending: false })
    .order('period', { ascending: true });

  if (error) {
    console.error('Error fetching lessons:', error);
    return [];
  }
  return data as LessonInfo[];
};

// 授業日を作成（存在しなければ）
export const createLessonDate = async (classId: string, date: string, period: number) => {
  // すでに存在するか確認
  const { data } = await supabase
    .from('attendances')
    .select('id')
    .eq('class_id', classId)
    .eq('lesson_date', date)
    .eq('period', period)
    .single();

  // なければ作成
  if (!data) {
    const { error } = await supabase.from('attendances').insert([{ 
      class_id: classId, 
      lesson_date: date, 
      period: period,
      stamps: [],
      memo: '' // 初期値
    }]);
    
    if (error) {
      console.error('Error creating lesson date:', error);
    }
  }
};

// 授業を削除
export const deleteLesson = async (classId: string, date: string, period: number) => {
  const { error } = await supabase
    .from('attendances')
    .delete()
    .eq('class_id', classId)
    .eq('lesson_date', date)
    .eq('period', period);

  if (error) {
    console.error('Error deleting lesson:', error);
    throw error;
  }
};

// スタンプを取得
export const fetchStamps = async (classId: string, date: string, period: number): Promise<Stamp[]> => {
  const { data, error } = await supabase
    .from('attendances')
    .select('stamps')
    .eq('class_id', classId)
    .eq('lesson_date', date)
    .eq('period', period)
    .single();
  
  if (error) {
    return [];
  }
  return data?.stamps ? (data.stamps as unknown as Stamp[]) : [];
};

// スタンプを保存
export const saveStamps = async (classId: string, date: string, period: number, stamps: Stamp[]) => {
  const jsonStamps = stamps as unknown as any; 
  
  const { error } = await supabase
    .from('attendances')
    .update({ stamps: jsonStamps })
    .eq('class_id', classId)
    .eq('lesson_date', date)
    .eq('period', period);

  if (error) {
    console.error('Error saving stamps:', error);
  }
};

// --- メモ機能 ---

// メモを取得
export const getMemo = async (classId: string, date: string, period: number): Promise<string> => {
  const { data } = await supabase
    .from('attendances')
    .select('memo')
    .eq('class_id', classId)
    .eq('lesson_date', date)
    .eq('period', period)
    .single();
  
  return data?.memo || '';
};

// メモを保存
export const saveMemo = async (classId: string, date: string, period: number, text: string) => {
  const { error } = await supabase
    .from('attendances')
    .update({ memo: text })
    .eq('class_id', classId)
    .eq('lesson_date', date)
    .eq('period', period);

  if (error) {
    console.error('Error saving memo:', error);
  }
};

// --- 座席表画像管理 ---

// 座席表画像を取得 (過去の最新版を取得するロジック)
export const getActiveSeatMap = async (classId: string, date: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('seat_maps')
    .select('image_data')
    .eq('class_id', classId)
    .lte('lesson_date', date) // その日以前
    .order('lesson_date', { ascending: false }) // 新しい順
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }
  return data.image_data;
};

// 座席表画像を保存 (Upsert対応版)
export const saveSeatMap = async (classId: string, date: string, imageBase64: string) => {
  const { error } = await supabase
    .from('seat_maps')
    .upsert(
      { 
        class_id: classId, 
        lesson_date: date, 
        image_data: imageBase64 
      },
      { onConflict: 'class_id, lesson_date' }
    );

  if (error) {
    console.error('Error saving seat map:', error);
  }
};

export const deleteClass = async (id: number) => {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting class:', error);
    throw error;
  }
};