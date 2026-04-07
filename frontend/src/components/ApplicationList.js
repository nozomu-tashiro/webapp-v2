import React, { useState, useEffect } from 'react';
import {
  getApplicationsByAgent,
  deleteApplication,
  getApplicationCount,
  markAllAsSubmitted
} from '../utils/indexedDB';
import { getCurrentUser } from '../utils/auth';
import { convertToCSV, downloadCSV, sendCSVByEmail } from '../utils/csvExport';
import '../styles/ApplicationList.css';

const ApplicationList = ({ onEdit, onRegeneratePDF }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitMethod, setSubmitMethod] = useState('download'); // 'download' or 'email'
  const [selectedIds, setSelectedIds] = useState([]); // チェックボックス選択管理
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

  // 全選択/全解除
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(applications.map(app => app.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 個別選択
  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // 削除確認（単一）
  const handleDelete = async (id, applicantName) => {
    if (!window.confirm(`${applicantName}さんの申込データを削除してよろしいですか？`)) {
      return;
    }

    try {
      await deleteApplication(id);
      alert('削除しました');
      loadApplications();
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('削除するデータを選択してください');
      return;
    }

    if (!window.confirm(`選択した${selectedIds.length}件のデータを削除してよろしいですか？`)) {
      return;
    }

    try {
      await Promise.all(selectedIds.map(id => deleteApplication(id)));
      alert(`${selectedIds.length}件のデータを削除しました`);
      setSelectedIds([]);
      loadApplications();
    } catch (error) {
      console.error('一括削除エラー:', error);
      alert('一括削除に失敗しました');
    }
  };

  // 出力済みデータを一括削除
  const handleDeleteSubmitted = async () => {
    const submittedApps = applications.filter(app => app.submitted);
    if (submittedApps.length === 0) {
      alert('出力済みデータがありません');
      return;
    }

    if (!window.confirm(`出力済みデータ${submittedApps.length}件を削除してよろしいですか？`)) {
      return;
    }

    try {
      await Promise.all(submittedApps.map(app => deleteApplication(app.id)));
      alert(`${submittedApps.length}件の出力済みデータを削除しました`);
      setSelectedIds([]);
      loadApplications();
    } catch (error) {
      console.error('出力済み削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // CSV出力（未出力データのみ）
  const handleCSVExport = () => {
    const unsubmittedApps = applications.filter(app => !app.submitted);
    
    if (unsubmittedApps.length === 0) {
      alert('未出力のデータがありません。\nすべてのデータは既にCSV出力済みです。');
      return;
    }

    setShowSubmitDialog(true);
  };

  // CSV ダウンロード（未出力データのみ）
  const handleDownloadCSV = async () => {
    try {
      const unsubmittedApps = applications.filter(app => !app.submitted);
      
      if (unsubmittedApps.length === 0) {
        alert('未出力のデータがありません');
        return;
      }

      const csvContent = convertToCSV(unsubmittedApps, currentUser.agentCode, currentUser.agentName);
      if (csvContent) {
        downloadCSV(csvContent, currentUser.agentCode, currentUser.agentName);
        
        // 出力済みフラグを立てる
        await markAllAsSubmitted(currentUser.agentCode);
        
        alert(`CSVファイルをダウンロードしました。\n出力件数: ${unsubmittedApps.length}件\n\n※このデータは3日後に自動削除されます。`);
        setShowSubmitDialog(false);
        loadApplications(); // リスト更新
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

  // 支払方法の表示名を取得
  const getPaymentMethodDisplayName = (paymentMethod) => {
    const methods = {
      'monthly': '月払',
      'yearly-2': '年払（２年更新）',
      'yearly-1': '年払（１年更新）'
    };
    return methods[paymentMethod] || paymentMethod || '-';
  };

  // オプションサービスの表示名を取得
  const getOptionDisplayNames = (selectedOptions) => {
    if (!selectedOptions || selectedOptions.length === 0) return '-';
    
    const optionMap = {
      'neighbor-trouble': 'マモロッカ',
      'senior-watch': 'まごころ',
      'appliance-support': 'シューリット！'
    };
    
    return selectedOptions
      .map(opt => optionMap[opt] || opt)
      .join(', ');
  };

  // サービス期間をフォーマット
  const formatServicePeriod = (startDate) => {
    if (!startDate) return '-';
    try {
      const date = new Date(startDate);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
    } catch (error) {
      return startDate;
    }
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
      {/* 重要な注意文バナー */}
      <div className="important-notice-banner">
        <div className="notice-icon">⚠️</div>
        <div className="notice-content">
          <h3 className="notice-title">【重要】データ自動削除について</h3>
          <p className="notice-text">
            CSV出力済みデータは、<strong className="highlight-danger">出力から3日後に自動削除</strong>されます。<br />
            必要なデータは<strong className="highlight-warning">CSV出力後、すみやかにダウンロード</strong>してください。
          </p>
        </div>
      </div>

      <div className="list-header">
        <h2>登録済みデータ一覧</h2>
        <div className="list-stats">
          現在の登録件数: <strong>{applications.length}件</strong>
          {applications.filter(app => !app.submitted).length > 0 && (
            <span className="unsubmitted-count">
              （未出力: <strong>{applications.filter(app => !app.submitted).length}件</strong>）
            </span>
          )}
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
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === applications.length && applications.length > 0}
                      onChange={handleSelectAll}
                      title="全選択/全解除"
                    />
                  </th>
                  <th>No.</th>
                  <th>申込者名</th>
                  <th>物件名</th>
                  <th>号室</th>
                  <th>商品</th>
                  <th>支払方法</th>
                  <th>追加オプション</th>
                  <th>サービス期間～</th>
                  <th>登録日時</th>
                  <th>ステータス</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, index) => (
                  <tr key={app.id} className={app.submitted ? 'submitted-row' : ''}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(app.id)}
                        onChange={() => handleSelectOne(app.id)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>{app.formData.applicantName || '-'}</td>
                    <td>{app.formData.propertyName || '-'}</td>
                    <td>{app.formData.roomNumber || '-'}</td>
                    <td className="product-cell">
                      {getProductDisplayName(app.formData.selectedProduct)}
                    </td>
                    <td className="payment-cell">
                      {getPaymentMethodDisplayName(app.formData.paymentMethod)}
                    </td>
                    <td className="option-cell">
                      {getOptionDisplayNames(app.formData.selectedOptions)}
                    </td>
                    <td className="period-cell">
                      {formatServicePeriod(app.formData.servicePeriodStartDate)}
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
                    <td className="status-cell">
                      {app.submitted ? (
                        <div className="status-submitted">
                          <span className="status-icon">✅</span>
                          <span className="status-text">出力済</span>
                          <div className="submitted-date">
                            {formatDateTime(app.submittedAt)}
                          </div>
                        </div>
                      ) : (
                        <div className="status-pending">
                          <span className="status-icon">📝</span>
                          <span className="status-text">未出力</span>
                        </div>
                      )}
                    </td>
                    <td className="action-cell">
                      <button
                        onClick={() => {
                          if (app.submitted) {
                            alert('⚠️ このデータは既にCSV出力済みです。\n編集はできません。\n\n再度編集が必要な場合は、新規データとして再登録してください。');
                          } else {
                            onEdit(app);
                          }
                        }}
                        className={app.submitted ? 'btn-edit btn-disabled' : 'btn-edit'}
                        title={app.submitted ? 'CSV出力済みのため編集不可' : '編集'}
                        disabled={app.submitted}
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
            <button 
              onClick={handleBulkDelete} 
              className="btn-bulk-delete"
              disabled={selectedIds.length === 0}
            >
              選択した{selectedIds.length}件を削除
            </button>
            <button 
              onClick={handleDeleteSubmitted} 
              className="btn-delete-submitted"
              disabled={applications.filter(app => app.submitted).length === 0}
            >
              出力済みデータを一括削除（{applications.filter(app => app.submitted).length}件）
            </button>
            <button 
              onClick={handleCSVExport} 
              className="btn-csv-export"
              disabled={applications.filter(app => !app.submitted).length === 0}
            >
              未出力データをCSV出力（{applications.filter(app => !app.submitted).length}件）
            </button>
          </div>
        </>
      )}

      {/* CSV出力ダイアログ */}
      {showSubmitDialog && (
        <div className="modal-overlay" onClick={() => setShowSubmitDialog(false)}>
          <div className="modal-content submit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>CSV出力方法を選択</h3>
            <p className="data-count">
              出力件数: <strong>{applications.filter(app => !app.submitted).length}件</strong>（未出力データのみ）
            </p>
            <p className="csv-notice">
              ⚠️ CSV出力後、データは<strong>3日後に自動削除</strong>されます。
            </p>

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
