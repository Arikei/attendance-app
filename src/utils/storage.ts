// データの型定義
export type ClassData = {
  id: string;
  name: string;
};

export type LessonDate = {
  date: string; // "2024-04-01" 形式
};

export type Stamp = {
  id: number;
  x: number;
  y: number;
};

// --- ヘルパー関数 ---

// クラス一覧を取得
export const getClasses = (): ClassData[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem('app_classes');
  return data ? JSON.parse(data) : [];
};

// クラスを追加
export const addClass = (name: string) => {
  const classes = getClasses();
  const newClass = { id: crypto.randomUUID(), name };
  localStorage.setItem('app_classes', JSON.stringify([...classes, newClass]));
};

// クラスごとの授業日一覧を取得
export const getLessonDates = (classId: string): string[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(`app_dates_${classId}`);
  return data ? JSON.parse(data) : [];
};

// 授業日を追加
export const addLessonDate = (classId: string, date: string) => {
  const dates = getLessonDates(classId);
  if (!dates.includes(date)) {
    const newDates = [...dates, date].sort(); // 日付順に並べる
    localStorage.setItem(`app_dates_${classId}`, JSON.stringify(newDates));
  }
};

// ★重要：指定した日の座席表画像を取得（過去の画像を引き継ぐロジック）
export const getSeatImageForDate = (classId: string, targetDate: string): string | null => {
  if (typeof window === 'undefined') return null;
  
  // 保存されているすべての画像履歴を取得
  const historyJSON = localStorage.getItem(`app_images_${classId}`);
  const history: Record<string, string> = historyJSON ? JSON.parse(historyJSON) : {};
  
  // その日そのものに画像があればそれを返す
  if (history[targetDate]) return history[targetDate];

  // なければ、その日より前の日付で、最も新しい画像を探す
  const dates = Object.keys(history).sort(); // 日付順に並べる
  let bestMatchImage = null;

  for (const d of dates) {
    if (d <= targetDate) {
      bestMatchImage = history[d];
    } else {
      break; // 対象日を超えたら終了
    }
  }

  return bestMatchImage;
};

// 画像を保存する
export const saveSeatImage = (classId: string, date: string, imageSrc: string) => {
  const historyJSON = localStorage.getItem(`app_images_${classId}`);
  const history = historyJSON ? JSON.parse(historyJSON) : {};
  
  history[date] = imageSrc;
  localStorage.setItem(`app_images_${classId}`, JSON.stringify(history));
};

// 出欠スタンプの保存・取得
export const getStamps = (classId: string, date: string): Stamp[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(`app_stamps_${classId}_${date}`);
  return data ? JSON.parse(data) : [];
};

export const saveStamps = (classId: string, date: string, stamps: Stamp[]) => {
  localStorage.setItem(`app_stamps_${classId}_${date}`, JSON.stringify(stamps));
};