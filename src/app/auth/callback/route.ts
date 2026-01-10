import { createClient } from '../../../utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // ログイン後のリダイレクト先（指定がなければトップページ）
  const next = searchParams.get('next') ?? '/';

  if (code) {
    // ★ここが重要: await を忘れるとクラッシュします
    const supabase = await createClient();
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // エラー時はエラー画面へ（なければトップへ戻す）
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}