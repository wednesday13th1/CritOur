export function requestMessage(error:unknown){
 if(error instanceof TypeError)return '通信できませんでした。接続を確認して再試行してください。';
 if(error instanceof SyntaxError)return '応答を読み取れませんでした。少し待って再試行してください。';
 return error instanceof Error?error.message:'操作を完了できませんでした。再試行してください。';
}
