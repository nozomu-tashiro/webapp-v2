import React, { useState, useEffect } from 'react';
import ApplicationForm from './components/ApplicationForm';
import Login from './components/Login';
import Register from './components/Register';
import ApplicationList from './components/ApplicationList';
import { isLoggedIn, getAuthData, logout, getCurrentUser } from './utils/auth';
import { saveApplication, cleanupOldData } from './utils/indexedDB';
import './styles/App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [editingApplication, setEditingApplication] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // 認証状態チェック
    const authData = getAuthData();
    const loggedIn = isLoggedIn();
    
    if (!authData) {
      // 初回アクセス - 登録画面表示
      setShowRegister(true);
    } else if (loggedIn) {
      // ログイン済み
      setIsAuthenticated(true);
      setCurrentUser(getCurrentUser());
    } else {
      // 登録済みだがログアウト状態 - ログイン画面表示
      setShowRegister(false);
    }

    // 古いデータのクリーンアップ（7日以上経過した提出済みデータ）
    cleanupOldData().catch(console.error);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentUser(getCurrentUser());
  };

  const handleRegisterSuccess = () => {
    setShowRegister(false);
    setIsAuthenticated(true);
    setCurrentUser(getCurrentUser());
  };

  const handleLogout = () => {
    if (window.confirm('ログアウトしてよろしいですか？')) {
      logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  const handlePDFGenerated = async (formData) => {
    // PDF生成後、データを保存
    try {
      const user = getCurrentUser();
      await saveApplication(formData, user.agentCode);
      console.log('データを保存しました');
      // 一覧を再読み込みするためのイベントを発火
      window.dispatchEvent(new Event('applicationSaved'));
    } catch (error) {
      console.error('データ保存エラー:', error);
    }
  };

  const handleEditApplication = (application) => {
    setEditingApplication(application);
    // フォームまでスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegeneratePDF = (formData) => {
    // PDF再出力（編集なし）
    setEditingApplication({ formData });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 認証前の画面
  if (!isAuthenticated) {
    if (showRegister) {
      return <Register onRegisterSuccess={handleRegisterSuccess} />;
    } else {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  }

  // 認証後のメイン画面
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div>
            <h1>駆付けサービス申込システム V2</h1>
            <p className="subtitle">申込データを蓄積して、まとめて提出できます</p>
          </div>
          <div className="header-user-info">
            <span className="user-name">{currentUser?.agentName}</span>
            <button onClick={handleLogout} className="logout-button">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="App-main">
        <ApplicationForm 
          onPDFGenerated={handlePDFGenerated}
          editingData={editingApplication}
          onEditComplete={() => setEditingApplication(null)}
        />
        
        <ApplicationList 
          onEdit={handleEditApplication}
          onRegeneratePDF={handleRegeneratePDF}
        />
      </main>

      <footer className="App-footer">
        <p>&copy; 2026 駆付けサービス申込システムV2. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
