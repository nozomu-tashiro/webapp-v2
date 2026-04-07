import React, { useState, useEffect } from 'react';
import {
  getAuthData,
  verifyLogin,
  validatePin
} from '../utils/auth';
import '../styles/Login.css';

const Login = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 保存された代理店情報を読み込み
    const authData = getAuthData();
    if (authData) {
      setAgentName(authData.agentName);
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
            <a href="#" className="forgot-pin-link">
              PINを忘れた方はこちら →
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
