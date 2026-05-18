import React, { useState, useEffect } from 'react';
import {
  getAuthData,
  verifyLogin,
  validatePin
} from '../utils/auth';
import { deleteAllApplications } from '../utils/indexedDB';
import '../styles/Login.css';

const Login = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  useEffect(() => {
    // 保存された代理店情報を読み込み
    const authData = getAuthData();
    if (authData) {
      setAgentName(authData.agentName);
      setRegisteredEmail(authData.email || '');
    }
  }, []);

  // PIN入力処理
  const handlePinChange = (index, value) => {
    // 数字のみ受け付ける
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // 自動的に次の入力欄にフォーカス
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }

    // 4桁すべて入力されたら自動ログイン
    if (newPin.every(digit => digit !== '') && index === 3) {
      handleLogin(newPin.join(''));
    }
  };

  // Backspaceキーで前の入力欄に戻る
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  // ログイン処理
  const handleLogin = async (pinValue) => {
    setError('');
    setLoading(true);

    const validation = validatePin(pinValue);
    if (!validation.valid) {
      setError(validation.error);
      setLoading(false);
      return;
    }

    try {
      const result = verifyLogin(pinValue);
      
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error);
        // PINをクリア
        setPin(['', '', '', '']);
        document.getElementById('pin-0')?.focus();
      }
    } catch (error) {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pinValue = pin.join('');
    handleLogin(pinValue);
  };

  // PINを忘れた場合の処理
  const handleForgotPin = () => {
    setShowForgotPinModal(true);
  };

  // 再登録処理
  const handleReRegister = async () => {
    const confirmMessage = 
      '再登録すると、以下のデータが削除されます：\n' +
      '• 現在の認証情報（PIN、メールアドレス）\n' +
      '• 保存済みの申込データ（PDF/CSV未出力分）\n\n' +
      '※ PDF/CSV出力済みのデータは影響ありません。\n\n' +
      '本当に続けますか？';
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        
        // IndexedDBの全データを削除
        await deleteAllApplications();
        
        // localStorageの認証データを削除
        localStorage.removeItem('auth_data');
        sessionStorage.clear();
        
        alert('古いデータを削除しました。新規登録画面に移動します。');
        
        // ページをリロードして登録画面に戻る
        window.location.href = '/';
      } catch (error) {
        console.error('データ削除エラー:', error);
        alert('データの削除に失敗しました。ブラウザのキャッシュをクリアしてから再度お試しください。');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">駆け付けサービス申込システムV2</h1>
        
        <div className="login-welcome">
          <h2>おかえりなさい！</h2>
          {agentName && (
            <p className="agent-name">{agentName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>4桁PIN（暗証番号）</label>
            <div className="pin-input-group">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="password"
                  inputMode="numeric"
                  pattern="\d"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="pin-input"
                  autoFocus={index === 0}
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading || pin.some(d => !d)}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>

          <div className="login-help">
            <button type="button" className="forgot-pin-link" onClick={handleForgotPin}>
              PINを忘れた方はこちら →
            </button>
          </div>
        </form>
      </div>

      {/* PINを忘れた場合のモーダル */}
      {showForgotPinModal && (
        <div
          className="pin-recovery-overlay"
          onClick={() => !loading && setShowForgotPinModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-recovery-title"
        >
          <div className="pin-recovery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pin-recovery-header">
              <h3 id="pin-recovery-title">
                <span role="img" aria-label="key">🔑</span>
                PINの再発行について
              </h3>
              {!loading && (
                <button
                  type="button"
                  className="pin-recovery-close"
                  onClick={() => setShowForgotPinModal(false)}
                  aria-label="閉じる"
                >
                  ×
                </button>
              )}
            </div>

            <div className="pin-recovery-body">
              {registeredEmail ? (
                <div className="pin-recovery-section">
                  <p className="pin-recovery-label">ご登録のメールアドレス</p>
                  <div className="pin-recovery-email">
                    <span role="img" aria-label="email" className="pin-recovery-email-icon">✉️</span>
                    <span className="pin-recovery-email-address">{registeredEmail}</span>
                  </div>
                </div>
              ) : (
                <div className="pin-recovery-section">
                  <div className="pin-recovery-alert pin-recovery-alert--error">
                    <p className="pin-recovery-alert-title">
                      <span role="img" aria-label="warning">⚠️</span>
                      メールアドレスが登録されていません
                    </p>
                    <p className="pin-recovery-alert-text">
                      再登録が必要です。
                    </p>
                  </div>
                </div>
              )}

              <div className="pin-recovery-alert pin-recovery-alert--warning">
                <p className="pin-recovery-alert-title">
                  <span role="img" aria-label="warning">⚠️</span>
                  PINを失念した場合は、再度登録しなおしてください
                </p>
                <p className="pin-recovery-alert-subtitle">
                  【重要】再登録すると、以下のデータが削除されます：
                </p>
                <ul className="pin-recovery-list">
                  <li>現在の認証情報（PIN、メールアドレス）</li>
                  <li>保存済みの申込データ（PDF/CSV未出力分）</li>
                </ul>
                <p className="pin-recovery-note">
                  ※ PDF/CSV出力済みのデータは影響ありません。
                </p>
              </div>
            </div>

            <div className="pin-recovery-footer">
              <button
                type="button"
                onClick={() => setShowForgotPinModal(false)}
                className="pin-recovery-btn pin-recovery-btn--secondary"
                disabled={loading}
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleReRegister}
                className="pin-recovery-btn pin-recovery-btn--danger"
                disabled={loading}
              >
                {loading ? '削除中...' : '再登録画面へ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
