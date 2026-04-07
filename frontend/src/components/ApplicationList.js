import React, { useState, useEffect } from 'react';
import {
  getApplicationsByAgent,
  deleteApplication,
  getApplicationCount
} from '../utils/indexedDB';
import { getCurrentUser } from '../utils/auth';
import { convertToCSV, downloadCSV, sendCSVByEmail } from '../utils/csvExport';
import '../styles/ApplicationList.css';

const ApplicationList = ({ onEdit, onRegeneratePDF }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitMethod, setSubmitMethod] = useState('download'); // 'download' or 'email'
  const currentUser = getCurrentUser();

  // データ読み込み
  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await getApplicationsByAgent(currentUser.agentCode);
      setApplications(data);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      alert('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
    
    // 新規保存時にリストを更新
    const handleApplicationSaved = () => {
      loadApplications();
    };
    
    window.addEventListener('applicationSaved', handleApplicationSaved);
    
    return () => {
      window.removeEventListener('applicationSaved', handleApplicationSaved);
    };
  }, []);

  // 削除確認
  const handleDelete = async (id, applicantName) => {
    if (!window.confirm(`${applicantName}さんの申込データを削除してよろしいですか？`)) {
      return;
    }

    try {
      await deleteApplication(id);
      alert('削除しました');
      loadApplications();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // CSV出力
  const handleCSVExport = () => {
    if (applications.length === 0) {
      alert('出力するデータがありません');
      return;
    }

    setShowSubmitDialog(true);
  };

  // CSV ダウンロード
  const handleDownloadCSV = () => {
    try {
      const csvContent = convertToCSV(applications, currentUser.agentCode, currentUser.agentName);
      if (csvContent) {
        downloadCSV(csvContent, currentUser.agentCode, currentUser.agentName);
        alert('CSVファイルをダウンロードしました');
        setShowSubmitDialog(false);
      }
    } catch (error) {
      console.error('CSV出力エラー:', error);
      alert('CSVの出力に失敗しました');
    }
  };

  // CSV メール送信
  const handleEmailCSV = async () => {
    try {
      const csvContent = convertToCSV(applications, currentUser.agentCode, currentUser.agentName);
      if (csvContent) {
        // TODO: バックエンドのメール送信APIと連携
        alert('メール送信機能は実装予定です');
        setShowSubmitDialog(false);
      }
    } catch (error) {
      console.error('メール送信エラー:', error);
      alert('メール送信に失敗しました');
    }
  };

  // 日時フォーマット
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 商品名を取得
  const getProductDisplayName = (productId) => {
    const products = {
      'anshin-support-24': 'あんしんサポート24',
      'home-assist-24': 'ホームアシスト24',
      'anshin-full-support': 'あんしんフルサポート',
      'ierabu-anshin-support': 'いえらぶ安心サポート'
    };
    return products[productId] || productId;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="application-list-container">
      <div className="list-header">
        <h2>登録済みデータ一覧</h2>
        <div className="list-stats">
          現在の登録件数: <strong>{applications.length}件</strong>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="empty-state">
          <p>まだ登録されたデータがありません</p>
          <p>上のフォームから申込データを登録してください</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="application-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>申込者名</th>
                  <th>物件名</th>
                  <th>商品</th>
                  <th>登録日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, index) => (
                  <tr key={app.id}>
                    <td>{index + 1}</td>
                    <td>{app.formData.applicantName || '-'}</td>
                    <td>{app.formData.propertyName || '-'}</td>
                    <td className="product-cell">
                      {getProductDisplayName(app.formData.selectedProduct)}
                    </td>
                    <td className="datetime-cell">
                      <div className="datetime-main">
                        {formatDateTime(app.timestamp)}
                      </div>
                      {app.updatedAt && (
                        <div className="datetime-updated">
                          ⚠️ {formatDateTime(app.updatedAt)}更新
                        </div>
                      )}
                    </td>
                    <td className="action-cell">
                      <button
                        onClick={() => onEdit(app)}
                        className="btn-edit"
                        title="編集"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => onRegeneratePDF(app.formData)}
                        className="btn-pdf"
                        title="PDF再出力"
                      >
                        PDF再出力
                      </button>
                      <button
                        onClick={() => handleDelete(app.id, app.formData.applicantName)}
                        className="btn-delete"
                        title="削除"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="list-actions">
            <button onClick={handleCSVExport} className="btn-csv-export">
              全データをCSV出力
            </button>
          </div>
        </>
      )}

      {/* CSV出力ダイアログ */}
      {showSubmitDialog && (
        <div className="modal-overlay" onClick={() => setShowSubmitDialog(false)}>
          <div className="modal-content submit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>CSV出力方法を選択</h3>
            <p className="data-count">出力件数: {applications.length}件</p>

            <div className="submit-options">
              <div
                className={`submit-option ${submitMethod === 'download' ? 'selected' : ''}`}
                onClick={() => setSubmitMethod('download')}
              >
                <div className="option-icon">💾</div>
                <div className="option-content">
                  <h4>CSVをダウンロード</h4>
                  <p>ファイルをダウンロードして、手動でメール送信</p>
                </div>
              </div>

              <div
                className={`submit-option ${submitMethod === 'email' ? 'selected' : ''}`}
                onClick={() => setSubmitMethod('email')}
              >
                <div className="option-icon">📧</div>
                <div className="option-content">
                  <h4>自動的にメール送信</h4>
                  <p>ボタンをクリックするだけで自動的に当社へ送信</p>
                </div>
              </div>
            </div>

            <div className="modal-buttons">
              <button onClick={() => setShowSubmitDialog(false)} className="btn-secondary">
                キャンセル
              </button>
              <button
                onClick={submitMethod === 'download' ? handleDownloadCSV : handleEmailCSV}
                className="btn-primary"
              >
                {submitMethod === 'download' ? 'ダウンロード' : 'メール送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 商品名を表示用に変換
const getProductDisplayName = (productId) => {
  const products = {
    'anshin-support-24': 'あんしんサポート24',
    'home-assist-24': 'ホームアシスト24',
    'anshin-full-support': 'あんしんフルサポート',
    'ierabu-anshin-support': 'いえらぶ安心サポート'
  };
  return products[productId] || productId;
};

export default ApplicationList;
