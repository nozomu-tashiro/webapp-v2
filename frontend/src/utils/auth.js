/**
 * 認証管理ユーティリティ
 * ログイン、登録、PIN管理を担当
 */

// PINをハッシュ化（簡易的な暗号化）
export const hashPin = (pin) => {
  // 簡易的なハッシュ化（本番環境では bcrypt などを使用）
  let hash = 0;
  const str = `${pin}-salt-駆け付けサービス`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

// ローカルストレージから認証情報を取得
export const getAuthData = () => {
  try {
    const authData = localStorage.getItem('auth_data');
    return authData ? JSON.parse(authData) : null;
  } catch (error) {
    console.error('認証データの取得エラー:', error);
    return null;
  }
};

// 認証情報を保存
export const saveAuthData = (agentCode, agentName, email, pin, rememberMe = true) => {
  const authData = {
    agentCode,
    agentName,
    email,
    pinHash: hashPin(pin),
    createdAt: new Date().toISOString(),
    rememberMe
  };
  
  localStorage.setItem('auth_data', JSON.stringify(authData));
  
  // セッションストレージにも保存（ログイン状態の管理用）
  sessionStorage.setItem('logged_in', 'true');
  sessionStorage.setItem('agent_code', agentCode);
  sessionStorage.setItem('agent_name', agentName);
};

// ログイン検証
export const verifyLogin = (pin) => {
  const authData = getAuthData();
  if (!authData) {
    return { success: false, error: '登録情報が見つかりません' };
  }
  
  const inputPinHash = hashPin(pin);
  if (inputPinHash === authData.pinHash) {
    // ログイン成功
    sessionStorage.setItem('logged_in', 'true');
    sessionStorage.setItem('agent_code', authData.agentCode);
    sessionStorage.setItem('agent_name', authData.agentName);
    return { success: true, agentName: authData.agentName };
  } else {
    return { success: false, error: 'PINが正しくありません' };
  }
};

// ログイン状態の確認
export const isLoggedIn = () => {
  return sessionStorage.getItem('logged_in') === 'true';
};

// ログアウト
export const logout = () => {
  sessionStorage.removeItem('logged_in');
  sessionStorage.removeItem('agent_code');
  sessionStorage.removeItem('agent_name');
};

// 代理店コードのバリデーション
// フォーマット: XX-XX-XXXXXXXXXX (都道府県コード2桁-地域コード2桁-会員番号最大10桁)
// ※ 端末番号(3桁)は表示のみで、保存時は含めない
export const validateAgentCode = (code) => {
  if (!code || code.trim() === '') {
    return { valid: false, error: '代理店コードを入力してください' };
  }
  
  const parts = code.split('-');
  
  if (parts.length !== 3) {
    return { valid: false, error: '代理店コードは XX-XX-XXXXXXXXXX の形式で入力してください（例: 13-00-00000）' };
  }
  
  // 第1部: 都道府県コード（2桁）
  if (!/^[0-9]{2}$/.test(parts[0])) {
    return { valid: false, error: '都道府県コードは2桁の数字で入力してください' };
  }
  
  // 第2部: 地域コード（2桁）
  if (!/^[0-9]{2}$/.test(parts[1])) {
    return { valid: false, error: '地域コードは2桁の数字で入力してください' };
  }
  
  // 第3部: 会員番号（1〜10桁）
  if (!/^[0-9]{1,10}$/.test(parts[2])) {
    return { valid: false, error: '会員番号は1〜10桁の数字で入力してください' };
  }
  
  return { valid: true };
};

// メールアドレスのバリデーション
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || email.trim() === '') {
    return { valid: false, error: 'メールアドレスを入力してください' };
  }
  if (!emailRegex.test(email)) {
    return { valid: false, error: '有効なメールアドレスを入力してください' };
  }
  return { valid: true };
};

// PINのバリデーション
export const validatePin = (pin) => {
  if (!pin || pin.trim() === '') {
    return { valid: false, error: 'PINを入力してください' };
  }
  if (!/^[0-9]{4}$/.test(pin)) {
    return { valid: false, error: 'PINは4桁の数字で入力してください' };
  }
  return { valid: true };
};

// 現在のログインユーザー情報を取得
export const getCurrentUser = () => {
  return {
    agentCode: sessionStorage.getItem('agent_code'),
    agentName: sessionStorage.getItem('agent_name'),
    isLoggedIn: isLoggedIn()
  };
};
