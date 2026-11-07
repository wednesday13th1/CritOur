export const ja = {
  home:'ホーム', explore:'さがす', create:'つくる', profile:'マイページ',
  projects:'プロジェクト', findProjects:'プロジェクトを探す', createProject:'プロジェクトを作成',
  help:'この作品に参加する', showcase:'作品紹介', about:'この作品について',
  feedback:'フィードバック', sendFeedback:'感想・アイデアを送る', demo:'作品を試す', video:'動画を見る',
  canvas:'創作キャンバス', history:'貢献の記録', notifications:'通知',
  signIn:'ログイン', signOut:'ログアウト', edit:'編集',
} as const;

export const contributionLabels = {
  feedback:'フィードバックを送りました',
  completed:'タスクが完了しました',
  adopted:'アイデアが採用されました',
  implemented:'提案が作品に反映されました',
} as const;

export const statusLabels: Readonly<Record<string,string>> = {
  open:'募集中', in_progress:'取り組み中', completed:'タスク完了', cancelled:'取り消し済み',
  submitted:'送信済み', reviewed:'確認済み', adopted:'採用済み', implemented:'反映済み',
  todo:'未着手', doing:'取り組み中', in_review:'確認中', done:'完了',
};

export const difficultyLabels: Readonly<Record<string,string>> = {
  beginner:'初級', intermediate:'中級', advanced:'上級',
};

export const measurementLabels: Readonly<Record<string,string>> = {
  project_viewed:'作品の閲覧', share_clicked:'共有ボタンの操作', collaboration_started:'タスクの選択',
  contribution_submitted:'投稿の送信', contribution_accepted:'提案の採用', impact_viewed:'改善ページの閲覧',
  returning_user:'再訪',
};

const notifications: Readonly<Record<string,string>> = {
  request:'協力を募集する新しいタスクが公開されました。',
  project:'参加したプロジェクトが更新されました。',
  submitted:'作品への貢献が届きました。',
  reviewed:'あなたの貢献が確認されました。',
  adopted:'あなたのアイデアが採用されました。',
  implemented:'あなたの提案が作品に反映されました。',
  reply:'あなたの投稿に返信が届きました。',
};

export function notificationLabel(notice: {kind:string;title:string}) {
  if (notice.title === 'Your feedback is now linked to an improvement review') return 'あなたのフィードバックが改善の候補に登録されました。';
  return notifications[notice.kind] || 'プロジェクトの活動に更新がありました。';
}

const dateFormat = new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'});

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '日付不明' : dateFormat.format(date);
}

const errors: Readonly<Record<string,string>> = {
  'Too many requests. Please try again shortly.':'操作が続いたため、一時的に制限されています。1分ほど待ってからお試しください。',
  'Invalid origin':'この画面から操作を受け付けられませんでした。ページを開き直してください。',
  'JSON required':'送信形式が正しくありません。ページを開き直してお試しください。',
  'Invalid JSON':'送信した内容を読み取れませんでした。ページを開き直してください。',
  'Invalid body':'送信内容がありません。入力内容を確認してください。',
  'Request too large':'送信できるサイズを超えています。文章を短くするか、画像を小さくしてください。',
  'Invalid client ID.':'送信を確認できませんでした。ページを開き直してお試しください。',
  'Invalid client ID':'送信を確認できませんでした。ページを開き直してお試しください。',
  'Something went wrong. Try again shortly.':'処理に失敗しました。少し待ってからお試しください。',
  'Failed to fetch':'接続できませんでした。通信状況を確認してからお試しください。',
  'Load failed':'接続できませんでした。通信状況を確認してからお試しください。',
  'NetworkError when attempting to fetch resource.':'接続できませんでした。通信状況を確認してからお試しください。',
  'This account is unavailable.':'このアカウントは利用できません。',
  'That provider account is already connected to another CritOur account. Accounts were not merged.':'この外部アカウントは別のCritOurアカウントに連携済みです。',
  'A different account from this provider is already connected.':'このサービスの別のアカウントがすでに連携されています。',
  'Could not connect this account. No existing identity was changed.':'アカウントを連携できませんでした。すでに連携済みの設定は変更されていません。',
  'Sign in again before connecting an account.':'アカウントを連携するには、もう一度ログインしてください。',
  'Account linking is not ready.':'アカウント連携は準備中です。',
};

export function localizeError(value: unknown, fallback = '処理に失敗しました。もう一度お試しください。') {
  if (typeof value !== 'string' || !value) return fallback;
  return Object.hasOwn(errors,value) ? errors[value] : /[\u3040-\u30ff\u3400-\u9fff]/.test(value) ? value : fallback;
}
