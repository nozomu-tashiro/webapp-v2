import React, { useState } from 'react';
import {
  saveAuthData,
  validateAgentCode,
  validateEmail,
  validatePin
} from '../utils/auth';
import '../styles/Register.css';

const Register = ({ onRegisterSuccess }) => {
  const [formData, setFormData] = useState({
    agentName: '',
    agentCodePart1: '',
    agentCodePart2: '',
    agentCodePart3: '',
    agentCodePart4: '',
    email: '',
    emailConfirm: '',
    pin: '',
    pinConfirm: '',
    rememberMe: true
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 入力値の変更
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // エラーをクリア
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 代理店コードの自動フォーカス移動
  const handleAgentCodeChange = (part, value, nextPartName) => {
    // 数字のみ受け付ける
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    handleChange(part, value);

    // 最大桁数に達したら次のフィールドへ
    const maxLengths = {
      agentCodePart1: 2,
      agentCodePart2: 2,
      agentCodePart3: 10,
      agentCodePart4: 3
    };

    if (value.length === maxLengths[part] && nextPartName) {
      document.getElementById(nextPartName)?.focus();
    }
  };

  // バリデーション
  const validate = () => {
    const newErrors = {};

    // 代理店名
    if (!formData.agentName.trim()) {
      newErrors.agentName = '代理店名を入力してください';
    }

    // 代理店コード
    const agentCode = `${formData.agentCodePart1}-${formData.agentCodePart2}-${formData.agentCodePart3}`;
    const codeValidation = validateAgentCode(agentCode);
    if (!codeValidation.valid) {
      newErrors.agentCode = codeValidation.error;
    }

    // メールアドレス
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error;
    }

    // メールアドレス確認
    if (formData.email !== formData.emailConfirm) {
      newErrors.emailConfirm = 'メールアドレスが一致しません';
    }

    // PIN
    const pinValidation = validatePin(formData.pin);
    if (!pinValidation.valid) {
      newErrors.pin = pinValidation.error;
    }

    // PIN確認
    if (formData.pin !== formData.pinConfirm) {
      newErrors.pinConfirm = 'PINが一致しません';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 登録処理
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // 確認ダイアログを表示
    setShowConfirmDialog(true);
  };

  // 登録確定
  const confirmRegister = () => {
    setLoading(true);

    try {
      const agentCode = `${formData.agentCodePart1}-${formData.agentCodePart2}-${formData.agentCodePart3}`;
      
      saveAuthData(
        agentCode,
        formData.agentName,
        formData.email,
        formData.pin,
        formData.rememberMe
      );

      onRegisterSuccess();
    } catch (error) {
      setErrors({ submit: '登録に失敗しました' });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1 className="register-title">駆け付けサービス申込システムV2</h1>
        <h2 className="register-subtitle">新規登録</h2>

        <form onSubmit={handleSubmit} className="register-form">
          {/* 代理店名 */}
          <div className="form-group">
            <label>代理店名 <span className="required">*</span></label>
            <input
              type="text"
              value={formData.agentName}
              onChange={(e) => handleChange('agentName', e.target.value)}
              placeholder="株式会社〇〇不動産"
              className={errors.agentName ? 'input-error' : ''}
            />
            {errors.agentName && <span className="error-text">{errors.agentName}</span>}
          </div>

          {/* 代理店コード */}
          <div className="form-group">
            <label>代理店コード <span className="required">*</span></label>
            <div className="agent-code-group">
              <input
                id="agentCodePart1"
                type="text"
                inputMode="numeric"
                maxLength="2"
                value={formData.agentCodePart1}
                onChange={(e) => handleAgentCodeChange('agentCodePart1', e.target.value, 'agentCodePart2')}
                placeholder="13"
                className={`code-input ${errors.agentCode ? 'input-error' : ''}`}
              />
              <span className="code-separator">-</span>
              <input
                id="agentCodePart2"
                type="text"
                inputMode="numeric"
                maxLength="2"
                value={formData.agentCodePart2}
                onChange={(e) => handleAgentCodeChange('agentCodePart2', e.target.value, 'agentCodePart3')}
                placeholder="00"
                className={`code-input ${errors.agentCode ? 'input-error' : ''}`}
              />
              <span className="code-separator">-</span>
              <input
                id="agentCodePart3"
                type="text"
                inputMode="numeric"
                maxLength="10"
                value={formData.agentCodePart3}
                onChange={(e) => handleAgentCodeChange('agentCodePart3', e.target.value, 'agentCodePart4')}
                placeholder="00000"
                className={`code-input code-input-long ${errors.agentCode ? 'input-error' : ''}`}
              />
              <span className="code-separator">-</span>
              <input
                id="agentCodePart4"
                type="text"
                inputMode="numeric"
                maxLength="3"
                value={formData.agentCodePart4}
                onChange={(e) => handleAgentCodeChange('agentCodePart4', e.target.value)}
                placeholder="000"
                className={`code-input ${errors.agentCode ? 'input-error' : ''}`}
              />
            </div>
            <small className="help-text">※当社から発行された代理店コード（端末番号は自動的に削除されます）</small>
            {errors.agentCode && <span className="error-text">{errors.agentCode}</span>}
          </div>

          {/* メールアドレス */}
          <div className="form-group">
            <label>メールアドレス <span className="required">*</span></label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="info@example.com"
              className={errors.email ? 'input-error' : ''}
            />
            <small className="help-text">※PINを忘れた時の復旧に使用</small>
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          {/* メールアドレス確認 */}
          <div className="form-group">
            <label>メールアドレス（確認） <span className="required">*</span></label>
            <input
              type="email"
              value={formData.emailConfirm}
              onChange={(e) => handleChange('emailConfirm', e.target.value)}
              placeholder="info@example.com"
              className={errors.emailConfirm ? 'input-error' : ''}
            />
            {errors.emailConfirm && <span className="error-text">{errors.emailConfirm}</span>}
          </div>

          {/* PIN */}
          <div className="form-group">
            <label>4桁PIN（暗証番号）を設定 <span className="required">*</span></label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={formData.pin}
              onChange={(e) => handleChange('pin', e.target.value)}
              placeholder="****"
              className={errors.pin ? 'input-error' : ''}
            />
            {errors.pin && <span className="error-text">{errors.pin}</span>}
          </div>

          {/* PIN確認 */}
          <div className="form-group">
            <label>4桁PIN（確認） <span className="required">*</span></label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={formData.pinConfirm}
              onChange={(e) => handleChange('pinConfirm', e.target.value)}
              placeholder="****"
              className={errors.pinConfirm ? 'input-error' : ''}
            />
            {errors.pinConfirm && <span className="error-text">{errors.pinConfirm}</span>}
          </div>

          {/* ログイン情報を保存 */}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => handleChange('rememberMe', e.target.checked)}
              />
              この端末にログイン情報を保存する（推奨）
            </label>
          </div>

          {/* 注意事項 */}
          <div className="warning-box">
            <strong>⚠️ 重要な注意事項:</strong>
            <p>
              登録したメールアドレスを忘れてしまうと、PINの再発行はできませんので、
              入力間違いや失念に十分ご注意ください。
            </p>
          </div>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <button type="submit" className="register-button" disabled={loading}>
            登録して始める
          </button>
        </form>
      </div>

      {/* 確認ダイアログ */}
      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>登録内容の最終確認</h3>
            <div className="confirm-details">
              <p><strong>代理店名:</strong> {formData.agentName}</p>
              <p><strong>代理店コード:</strong> {formData.agentCodePart1}-{formData.agentCodePart2}-{formData.agentCodePart3}</p>
              <p><strong>端末番号:</strong> {formData.agentCodePart4}</p>
              <p><strong>メールアドレス:</strong> {formData.email}</p>
            </div>
            <div className="warning-text">
              ⚠️ 特にメールアドレスは慎重にご確認ください
            </div>
            <p>上記の内容で登録してよろしいですか？</p>
            <div className="modal-buttons">
              <button onClick={() => setShowConfirmDialog(false)} className="btn-secondary">
                修正する
              </button>
              <button onClick={confirmRegister} className="btn-primary" disabled={loading}>
                {loading ? '登録中...' : '登録する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
