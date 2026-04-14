import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ApplicationForm.css';
import { saveApplication, updateApplication } from '../utils/indexedDB';
import { getCurrentUser } from '../utils/auth';

const ApplicationForm = ({ editMode = false, editData = null, editingId = null, onSaveComplete = null }) => {
  // 認証情報を取得
  const currentUser = getCurrentUser();
  
  // Form state
  const [formData, setFormData] = useState({
    applicationType: 'new',
    applicationDate: new Date().toISOString().split('T')[0],
    applicantName: '',
    applicantNameKana: '',
    mobilePhone: '',
    homePhone: '',
    birthDate: '',
    gender: '',
    residents: [{ name: '', nameKana: '', relationship: '', birthDate: '', sameAsApplicant: false }], // デフォルトで1人追加
    propertyAddress: '',
    propertyName: '',
    propertyNameKana: '',
    roomNumber: '',
    selectedProduct: 'anshin-support-24',
    paymentMethod: 'monthly',
    selectedOptions: [],
    servicePrice: '',
    guaranteeNumber: '',
    servicePeriodStartDate: '',
    emergencyContact: {
      name: '',
      nameKana: '',
      address: '',
      homePhone: '',
      mobilePhone: '',
      relationship: ''
    },
    agentInfo: {
      name: '',
      phone: '',
      code: '',
      codePart1: '', // 2桁（都道府県）
      codePart2: '', // 2桁（地域）
      codePart3: '', // 最大10桁（会員番号）
      codePart4: '', // 3桁（端末番号）
      representativeName: ''
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedDataId, setSavedDataId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  
  // Accordion state for optional sections
  const [accordionState, setAccordionState] = useState({
    basicInfo: true,      // デフォルトで開く
    servicePeriod: true,  // デフォルトで開く
    residents: true,      // デフォルトで開く
    property: true,       // デフォルトで開く
    emergencyContact: false
  });
  
  // Toggle accordion
  const toggleAccordion = (section) => {
    setAccordionState(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 編集モード用：editDataが渡された場合、フォームに読み込む
  useEffect(() => {
    if (editMode && editData) {
      // 代理店コードを分割
      const code = editData.agentInfo?.code || '';
      const parts = code.split('-');
      const codePart1 = parts[0] || '';
      const codePart2 = parts[1] || '';
      const codePart3 = parts[2] || '';
      
      setFormData({
        ...editData,
        agentInfo: {
          ...editData.agentInfo,
          codePart1,
          codePart2,
          codePart3,
          codePart4: '' // 端末番号は空
        }
      });
      console.log('Edit mode activated, loaded data:', editData);
    }
  }, [editMode, editData]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle nested object changes
  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  // Handle checkbox changes for options
  const handleOptionChange = (option) => {
    setFormData(prev => {
      const selectedOptions = prev.selectedOptions.includes(option)
        ? prev.selectedOptions.filter(opt => opt !== option)
        : [...prev.selectedOptions, option];
      
      return {
        ...prev,
        selectedOptions
      };
    });
  };

  // Add resident
  const addResident = () => {
    setFormData(prev => ({
      ...prev,
      residents: [...prev.residents, { name: '', nameKana: '', relationship: '', birthDate: '', sameAsApplicant: false }]
    }));
  };

  // Remove resident
  const removeResident = (index) => {
    setFormData(prev => ({
      ...prev,
      residents: prev.residents.filter((_, i) => i !== index)
    }));
  };

  // Update resident
  const updateResident = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      residents: prev.residents.map((resident, i) => 
        i === index ? { ...resident, [field]: value } : resident
      )
    }));
  };

  // 契約者と同じ情報をコピー
  const toggleSameAsApplicant = (index, checked) => {
    setFormData(prev => {
      const updatedResidents = prev.residents.map((resident, i) => {
        if (i === index) {
          if (checked) {
            // 契約者情報をコピー
            return {
              ...resident,
              sameAsApplicant: true,
              name: prev.applicantName,
              nameKana: prev.applicantNameKana,
              birthDate: prev.birthDate
            };
          } else {
            // クリア
            return {
              ...resident,
              sameAsApplicant: false,
              name: '',
              nameKana: '',
              birthDate: ''
            };
          }
        }
        return resident;
      });
      return { ...prev, residents: updatedResidents };
    });
  };

  // Validate form
  const validateForm = () => {
    console.log('=== Form Validation Start ===');
    console.log('selectedProduct:', formData.selectedProduct);
    console.log('paymentMethod:', formData.paymentMethod);
    
    // 対象物件情報の必須項目チェック
    if (!formData.propertyAddress) {
      const errorMsg = '住所を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.propertyName) {
      const errorMsg = '物件名を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.propertyNameKana) {
      const errorMsg = '物件名（フリガナ）を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.roomNumber) {
      const errorMsg = '号室を入力してください（戸建等でない場合は「なし」と記載）';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    
    // 申込基本情報の必須項目チェック
    if (!formData.applicantName) {
      const errorMsg = 'お申込者名を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.applicantNameKana) {
      const errorMsg = 'フリガナを入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.mobilePhone) {
      const errorMsg = '携帯番号を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.birthDate) {
      const errorMsg = '生年月日を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    
    // サービス期間の必須項目チェック
    if (!formData.servicePeriodStartDate) {
      const errorMsg = 'サービス開始日を入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    
    // 入居者・同居人情報の必須項目チェック
    if (formData.residents.length === 0) {
      const errorMsg = '入居者・同居人情報を少なくとも1人入力してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    
    for (let i = 0; i < formData.residents.length; i++) {
      const resident = formData.residents[i];
      if (!resident.name) {
        const errorMsg = `入居者・同居人 ${i + 1} のお名前を入力してください`;
        setError(errorMsg);
        alert(errorMsg);
        console.error('Validation failed:', errorMsg);
        return false;
      }
      if (!resident.nameKana) {
        const errorMsg = `入居者・同居人 ${i + 1} のフリガナを入力してください`;
        setError(errorMsg);
        alert(errorMsg);
        console.error('Validation failed:', errorMsg);
        return false;
      }
      if (!resident.birthDate) {
        const errorMsg = `入居者・同居人 ${i + 1} の生年月日を入力してください`;
        setError(errorMsg);
        alert(errorMsg);
        console.error('Validation failed:', errorMsg);
        return false;
      }
    }
    
    // 商品・支払方法の必須項目チェック
    if (!formData.selectedProduct) {
      const errorMsg = '商品を選択してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    if (!formData.paymentMethod) {
      const errorMsg = '支払方法を選択してください';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Validation failed:', errorMsg);
      return false;
    }
    
    // 販売店コード形式チェック（XX-XX-最大10桁-XXX または XX-XX-最大10桁）
    const agentCode = formData.agentInfo.code;
    if (agentCode) {
      // 端末番号付き（13-00-1122336600-000）または端末番号なし（13-00-1122336600）のどちらも許可
      // 2桁-2桁-1～10桁-3桁 または 2桁-2桁-1～10桁
      const validPattern = /^\d{2}-\d{2}-\d{1,10}(-\d{3})?$/;
      
      if (!validPattern.test(agentCode)) {
        const errorMsg = '販売店コードの形式が正しくありません。\n正しい形式: XX-XX-最大10桁 または XX-XX-最大10桁-XXX\n（例: 13-00-1122336600 または 13-00-1122336600-000）';
        setError(errorMsg);
        alert(errorMsg);
        console.error('Validation failed:', errorMsg);
        return false;
      }
    }
    
    console.log('=== Validation Passed ===');
    setError('');
    return true;
  };

  // フォームをクリアして次の入力へ
  const handleContinueInput = () => {
    setShowSuccessModal(false);
    
    // 保持する項目（商品情報、販売店情報）
    const preservedData = {
      selectedProduct: formData.selectedProduct,
      paymentMethod: formData.paymentMethod,
      selectedOptions: formData.selectedOptions,
      servicePrice: formData.servicePrice,
      agentInfo: formData.agentInfo // 販売店情報は全て保持
    };
    
    // フォームをリセット（一部項目は保持）
    setFormData({
      applicationType: 'new',
      applicationDate: new Date().toISOString().split('T')[0],
      applicantName: '',
      applicantNameKana: '',
      mobilePhone: '',
      homePhone: '',
      birthDate: '',
      gender: '',
      residents: [{ name: '', nameKana: '', relationship: '', birthDate: '', sameAsApplicant: false }], // デフォルトで1人追加
      propertyAddress: '',
      propertyName: '',
      propertyNameKana: '',
      roomNumber: '',
      selectedProduct: preservedData.selectedProduct, // ✅ 保持
      paymentMethod: preservedData.paymentMethod, // ✅ 保持
      selectedOptions: preservedData.selectedOptions, // ✅ 保持
      servicePrice: preservedData.servicePrice, // ✅ 保持
      guaranteeNumber: '', // ❌ クリア（毎回変わる）
      servicePeriodStartDate: '',
      emergencyContact: {
        name: '',
        nameKana: '',
        address: '',
        homePhone: '',
        mobilePhone: '',
        relationship: ''
      },
      agentInfo: preservedData.agentInfo, // ✅ 販売店情報は保持
      remarks: ''
    });
    
    // ページトップへスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 一覧画面へ遷移
  const handleViewList = () => {
    setShowSuccessModal(false);
    
    // 一覧セクションまでスクロール
    setTimeout(() => {
      const listSection = document.getElementById('application-list-section');
      if (listSection) {
        listSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300); // モーダルが閉じるまで少し待つ
  };

  // Submit form and generate PDF
  const handleSubmit = async (e) => {
    console.log('=== handleSubmit called ===');
    e.preventDefault();
    console.log('preventDefault executed');
    
    console.log('Starting validation...');
    if (!validateForm()) {
      console.log('Validation failed, stopping submit');
      return;
    }
    console.log('Validation passed, continuing...');

    setLoading(true);
    setError('');
    setProgress(0);
    setProgressStep('書類レイアウトを作成しています');
    console.log('Loading state set to true');
    
    let pdfSuccess = false; // PDF生成成功フラグ

    try {
      const apiUrl = process.env.REACT_APP_API_URL || '';
      console.log('=== PDF Generation Debug ===');
      console.log('process.env.REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
      console.log('API URL (final):', apiUrl);
      console.log('Full URL:', `${apiUrl}/api/pdf/generate`);
      
      console.log('Form Data:', JSON.stringify(formData, null, 2));
      console.log('===========================');
      
      // プログレスバーのアニメーション
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 30) {
            return prev + 2;
          } else if (prev < 60) {
            return prev + 1;
          } else if (prev < 90) {
            return prev + 0.5;
          }
          return prev;
        });
      }, 200);

      // ステップ表示の更新
      setTimeout(() => setProgressStep('データを準備しています'), 1000);
      setTimeout(() => setProgressStep('PDFを書き出しています'), 3000);
      setTimeout(() => setProgressStep('最終調整をしています'), 8000);
      
      console.log('Sending POST request...');
      const response = await axios.post(`${apiUrl}/api/pdf/generate`, formData, {
        responseType: 'blob',
        timeout: 120000 // 120秒（2分）のタイムアウト - Render.comのコールドスタート対応
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      setProgressStep('完了しました！');
      console.log('Response received:', response.status, response.statusText);
      console.log('Response data size:', response.data.size, 'bytes');

      // Create download link
      console.log('Creating download link...');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `入会申込書_${formData.applicantName || 'application'}_${new Date().getTime()}.pdf`);
      document.body.appendChild(link);
      console.log('Triggering download...');
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log('PDF download complete!');
      
      // データをIndexedDBに保存または更新（端末番号も含めて保存）
      try {
        const agentCode = currentUser?.agentCode || 'unknown';
        
        if (editingId) {
          // 編集モード：既存データを更新
          await updateApplication(editingId, formData);
          setSavedDataId(editingId);
          console.log('Data updated in IndexedDB with ID:', editingId);
        } else {
          // 新規作成モード：新しいデータを追加
          const result = await saveApplication(formData, agentCode);
          setSavedDataId(result.id);
          console.log('Data saved to IndexedDB with ID:', result.id);
        }
        
        // PDF生成成功フラグを立てる
        pdfSuccess = true;
        
        // プログレスモーダルを閉じてから成功モーダルを表示
        setLoading(false); // プログレスモーダルを即座に閉じる
        
        setTimeout(() => {
          setShowSuccessModal(true);
        }, 300); // 短縮して300msに
        
        // ApplicationList更新イベントを発火
        window.dispatchEvent(new Event('applicationSaved'));
        
        // onSaveCompleteコールバックがあれば実行
        if (onSaveComplete) {
          onSaveComplete(editingId || savedDataId);
        }
      } catch (saveError) {
        console.error('Failed to save data to IndexedDB:', saveError);
        // 保存失敗してもPDFは成功しているので、警告のみ
        alert('PDF生成は成功しましたが、データの保存に失敗しました。');
        pdfSuccess = true; // PDFは成功している
        setLoading(false); // エラーでもプログレスモーダルを閉じる
      }
      
    } catch (err) {
      setProgress(0);
      setProgressStep('');
      console.error('=== ERROR generating PDF ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
      console.error('===========================');
      
      const errorMsg = `PDFの生成に失敗しました: ${err.message}`;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      // PDF生成失敗時のみ loading を false にする（成功時は既に false になっている）
      if (!pdfSuccess) {
        console.log('Setting loading to false (PDF generation failed)');
        setLoading(false);
      }
    }
  };

  // Get available payment methods based on selected product
  // 1年更新は最後に配置（基本的に選ばれないため）
  const getAvailablePaymentMethods = () => {
    switch (formData.selectedProduct) {
      case 'anshin-support-24':
      case 'home-assist-24':
        return [
          { value: 'monthly', label: '月払' },
          { value: 'yearly-2', label: '年払（2年更新）' },
          { value: 'yearly-1', label: '年払（1年更新）', warning: true }
        ];
      case 'anshin-full-support':
        return [{ value: 'monthly', label: '月払' }];
      case 'ierabu-anshin-support':
        return [{ value: 'yearly-2', label: '年払（2年更新）' }];
      default:
        return [{ value: 'monthly', label: '月払' }];
    }
  };

  return (
    <div className="application-form-container">
      {/* 編集モードバナー */}
      {editingId && (
        <div className="edit-mode-banner">
          <div className="edit-banner-icon">✏️</div>
          <div className="edit-banner-content">
            <h3 className="edit-banner-title">編集モード</h3>
            <p className="edit-banner-text">
              「{formData.applicantName || '申込者'}」さんの申込データを編集中です。<br />
              PDF生成後、元のデータが上書きされます。
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="application-form">
        
        {/* Error message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* 商品・サービス選択 */}
        <section className="form-section">
          <h2 className="section-title">商品・サービス選択</h2>
          
          <div className="form-row">
            <label className="form-label">
              商品ラインナップ <span className="required">*</span>
            </label>
            <select
              name="selectedProduct"
              value={formData.selectedProduct}
              onChange={(e) => {
                handleInputChange(e);
                // Reset payment method when product changes
                const availableMethods = getAvailablePaymentMethods();
                if (availableMethods.length > 0) {
                  setFormData(prev => ({
                    ...prev,
                    selectedProduct: e.target.value,
                    paymentMethod: availableMethods[0].value
                  }));
                }
              }}
              className="form-select"
              required
            >
              <option value="anshin-support-24">① あんしんサポート２４</option>
              <option value="home-assist-24">② ホームアシスト２４</option>
              <option value="anshin-full-support">③ あんしんフルサポート</option>
              <option value="ierabu-anshin-support">④ いえらぶ安心サポート</option>
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">
              支払方法 <span className="required">*</span>
            </label>
            <div className="payment-method-group">
              {getAvailablePaymentMethods().map(method => (
                <label 
                  key={method.value} 
                  className={`payment-method-label ${method.warning ? 'warning-option' : ''}`}
                  title={method.warning ? '※１年更新プランは基本的に取り扱っておりません' : ''}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={formData.paymentMethod === method.value}
                    onChange={handleInputChange}
                    required
                  />
                  <span>{method.label}</span>
                  {method.warning && (
                    <span className="warning-badge">⚠️</span>
                  )}
                </label>
              ))}
            </div>
            {formData.paymentMethod === 'yearly-1' && (
              <div className="warning-message">
                ⚠️ ※1年更新プランは設定可能ですが、個別対応となります。プラン内容の確認・ご相談が必要なため、営業担当とのお打ち合わせ後、専用の申込書でのお申込みとなり、本画面からの印刷はできません。
              </div>
            )}
          </div>

          <div className="form-row">
            <label className="form-label">
              {formData.paymentMethod === 'monthly' 
                ? 'サービス提供価格（円/税込）/毎月'
                : '【更新時】運営会社（いえらぶ）にて更新案内する場合：更新時ご請求額（円/※税別）'
              }
            </label>
            <input
              type="number"
              name="servicePrice"
              value={formData.servicePrice}
              onChange={handleInputChange}
              className="form-input"
              placeholder={formData.paymentMethod === 'monthly' ? '1100' : '15000'}
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              オプションサービス
            </label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.selectedOptions.includes('neighbor-trouble')}
                  onChange={() => handleOptionChange('neighbor-trouble')}
                />
                近隣トラブル解決支援サービス（マモロッカ）
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.selectedOptions.includes('senior-watch')}
                  onChange={() => handleOptionChange('senior-watch')}
                />
                シニア向け総合見守りサービス（まごころ）
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.selectedOptions.includes('appliance-support')}
                  onChange={() => handleOptionChange('appliance-support')}
                />
                家電の安心サポート（Syu-rIt！シューリット！）
              </label>
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">
              保証番号（いえらぶ安心保証契約者の場合）
            </label>
            <input
              type="text"
              name="guaranteeNumber"
              value={formData.guaranteeNumber}
              onChange={handleInputChange}
              className="form-input"
              placeholder="00000268"
            />
          </div>
        </section>

        {/* 販売店情報 */}
        <section className="form-section">
          <h2 className="section-title">販売店情報</h2>
          
          <div className="form-row">
            <label className="form-label">
              販売店名 <span className="required">*</span>
            </label>
            <input
              type="text"
              value={formData.agentInfo.name}
              onChange={(e) => handleNestedChange('agentInfo', 'name', e.target.value)}
              className="form-input"
              placeholder="いえらぶ不動産販売株式会社"
              required
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              電話番号
            </label>
            <input
              type="tel"
              value={formData.agentInfo.phone}
              onChange={(e) => handleNestedChange('agentInfo', 'phone', e.target.value)}
              className="form-input"
              placeholder="03-1234-5678"
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              販売店コード <span className="required">*</span>
            </label>
            <div className="code-input-group">
              <input
                type="text"
                value={formData.agentInfo.codePart1}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                  handleNestedChange('agentInfo', 'codePart1', value);
                  // 完全なコードを組み立て（端末番号も含める）
                  const fullCode = `${value}-${formData.agentInfo.codePart2}-${formData.agentInfo.codePart3}-${formData.agentInfo.codePart4}`;
                  handleNestedChange('agentInfo', 'code', fullCode);
                }}
                className="form-input code-part"
                placeholder="13"
                maxLength="2"
              />
              <span className="code-separator">-</span>
              <input
                type="text"
                value={formData.agentInfo.codePart2}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                  handleNestedChange('agentInfo', 'codePart2', value);
                  // 完全なコードを組み立て（端末番号も含める）
                  const fullCode = `${formData.agentInfo.codePart1}-${value}-${formData.agentInfo.codePart3}-${formData.agentInfo.codePart4}`;
                  handleNestedChange('agentInfo', 'code', fullCode);
                }}
                className="form-input code-part"
                placeholder="00"
                maxLength="2"
              />
              <span className="code-separator">-</span>
              <input
                type="text"
                value={formData.agentInfo.codePart3}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  handleNestedChange('agentInfo', 'codePart3', value);
                  // 完全なコードを組み立て（端末番号も含める）
                  const fullCode = `${formData.agentInfo.codePart1}-${formData.agentInfo.codePart2}-${value}-${formData.agentInfo.codePart4}`;
                  handleNestedChange('agentInfo', 'code', fullCode);
                }}
                className="form-input code-part code-part-long"
                placeholder="00000"
                maxLength="10"
              />
              <span className="code-separator">-</span>
              <input
                type="text"
                value={formData.agentInfo.codePart4}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                  handleNestedChange('agentInfo', 'codePart4', value);
                  // 完全なコードを組み立て（端末番号も含める）
                  const fullCode = `${formData.agentInfo.codePart1}-${formData.agentInfo.codePart2}-${formData.agentInfo.codePart3}-${value}`;
                  handleNestedChange('agentInfo', 'code', fullCode);
                }}
                className="form-input code-part"
                placeholder="000"
                maxLength="3"
              />
            </div>
            {formData.agentInfo.codePart4 && formData.agentInfo.code && !/^\d{2}-\d{2}-\d{1,10}-\d{3}$/.test(formData.agentInfo.code) && (
              <div className="warning-message">
                ⚠️ 形式が正しくありません。正しい形式: XX-XX-最大10桁-XXX（例: 13-00-00000-000）
              </div>
            )}
          </div>

          <div className="form-row">
            <label className="form-label">
              担当者名
            </label>
            <input
              type="text"
              value={formData.agentInfo.representativeName}
              onChange={(e) => handleNestedChange('agentInfo', 'representativeName', e.target.value)}
              className="form-input"
              placeholder="いえらぶ太郎"
            />
          </div>
        </section>

        {/* 対象物件情報 */}
        <section className="form-section">
          <div className="accordion-header">
            <label className="accordion-label">
              <input
                type="checkbox"
                checked={accordionState.property}
                onChange={() => toggleAccordion('property')}
              />
              <h2 className="section-title">
                対象物件情報
              </h2>
            </label>
          </div>
          
          {accordionState.property && (
            <div className="accordion-content">
              <div className="form-row">
                <label className="form-label">
                  住所 <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="東京都渋谷区〇〇1-2-3"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  物件名 <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="propertyName"
                  value={formData.propertyName}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="いえらぶマンション"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  物件名フリガナ <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="propertyNameKana"
                  value={formData.propertyNameKana}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="イエラブマンション"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  号室（戸建等でない場合は「なし」と記載） <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="roomNumber"
                  value={formData.roomNumber}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="101"
                />
              </div>
            </div>
          )}
        </section>

        {/* 申込基本情報 */}
        <section className="form-section">
          <div className="accordion-header">
            <label className="accordion-label">
              <input
                type="checkbox"
                checked={accordionState.basicInfo}
                onChange={() => toggleAccordion('basicInfo')}
              />
              <h2 className="section-title">
                申込基本情報
              </h2>
            </label>
          </div>
          
          {accordionState.basicInfo && (
            <div className="accordion-content">
              <div className="form-row">
                <label className="form-label">
                  お申込者名（法人の場合は法人名） <span className="required">*</span>
                  <br />
                  <small style={{ fontSize: '12px', color: '#666' }}>※入居者情報は必須入力となります。</small>
                </label>
                <input
                  type="text"
                  name="applicantName"
                  value={formData.applicantName}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="山田 太郎"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  フリガナ <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="applicantNameKana"
                  value={formData.applicantNameKana}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="ヤマダ タロウ"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  携帯番号 <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  name="mobilePhone"
                  value={formData.mobilePhone}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="090-1234-5678"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  固定番号
                </label>
                <input
                  type="tel"
                  name="homePhone"
                  value={formData.homePhone}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="03-1234-5678"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  生年月日 <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  性別
                </label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={formData.gender === 'male'}
                      onChange={handleInputChange}
                    />
                    男性
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={formData.gender === 'female'}
                      onChange={handleInputChange}
                    />
                    女性
                  </label>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* サービス期間 */}
        <section className="form-section">
          <div className="accordion-header">
            <label className="accordion-label">
              <input
                type="checkbox"
                checked={accordionState.servicePeriod}
                onChange={() => toggleAccordion('servicePeriod')}
              />
              <h2 className="section-title">
                サービス期間
              </h2>
            </label>
          </div>
          
          {accordionState.servicePeriod && (
            <div className="accordion-content">
              <div className="form-row">
                <label className="form-label">
                  開始日 <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="servicePeriodStartDate"
                  value={formData.servicePeriodStartDate}
                  onChange={handleInputChange}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <label className="form-label">
                  期間
                </label>
                <div className="service-period-display">
                  {formData.servicePeriodStartDate ? (
                    formData.paymentMethod === 'monthly' ? (
                      <p>
                        西暦{formData.servicePeriodStartDate.replace(/-/g, '年').replace(/年(\d+)$/, '年$1月').replace(/月(\d+)$/, '月$1日')} から
                      </p>
                    ) : (
                      <p>
                        西暦{formData.servicePeriodStartDate.replace(/-/g, '年').replace(/年(\d+)$/, '年$1月').replace(/月(\d+)$/, '月$1日')} から２年後応答月の月末まで
                      </p>
                    )
                  ) : (
                    <p className="placeholder-text">開始日を選択してください</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 入居者・同居人情報 */}
        <section className="form-section">
          <div className="accordion-header">
            <label className="accordion-label">
              <input
                type="checkbox"
                checked={accordionState.residents}
                onChange={() => toggleAccordion('residents')}
              />
              <h2 className="section-title">
                入居者・同居人情報
              </h2>
            </label>
          </div>
          
          {accordionState.residents && (
            <div className="accordion-content">
              <p className="section-description">
                お申込者以外の方が入居する場合や、法人契約の場合は必ずご記入ください。
              </p>
              
              {formData.residents.map((resident, index) => (
                <div key={index} className="resident-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <h3 className="resident-title" style={{ margin: 0 }}>入居者・同居人 {index + 1}</h3>
                    {index === 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', backgroundColor: '#fff3e0', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ff9800' }}>
                        <input
                          type="checkbox"
                          checked={resident.sameAsApplicant || false}
                          onChange={(e) => toggleSameAsApplicant(index, e.target.checked)}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        />
                        <span style={{ fontWeight: '500' }}>契約者と同じ（法人の場合は実際入居される入居者を登録してください。）</span>
                      </label>
                    )}
                  </div>
                  
                  <div className="form-row">
                    <label className="form-label">お名前 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={resident.name}
                      onChange={(e) => updateResident(index, 'name', e.target.value)}
                      className="form-input"
                      placeholder="山田 花子"
                      disabled={resident.sameAsApplicant}
                      style={{ backgroundColor: resident.sameAsApplicant ? '#f5f5f5' : 'white' }}
                    />
                  </div>

                  <div className="form-row">
                    <label className="form-label">フリガナ <span className="required">*</span></label>
                    <input
                      type="text"
                      value={resident.nameKana}
                      onChange={(e) => updateResident(index, 'nameKana', e.target.value)}
                      className="form-input"
                      placeholder="ヤマダ ハナコ"
                      disabled={resident.sameAsApplicant}
                      style={{ backgroundColor: resident.sameAsApplicant ? '#f5f5f5' : 'white' }}
                    />
                  </div>

                  <div className="form-row">
                    <label className="form-label">生年月日 <span className="required">*</span></label>
                    <input
                      type="date"
                      value={resident.birthDate || ''}
                      onChange={(e) => updateResident(index, 'birthDate', e.target.value)}
                      className="form-input"
                      disabled={resident.sameAsApplicant}
                      style={{ backgroundColor: resident.sameAsApplicant ? '#f5f5f5' : 'white' }}
                    />
                  </div>

                  <div className="form-row">
                    <label className="form-label">続柄</label>
                    <input
                      type="text"
                      value={resident.relationship}
                      onChange={(e) => updateResident(index, 'relationship', e.target.value)}
                      className="form-input"
                      placeholder="妻"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeResident(index)}
                    className="btn-remove"
                  >
                    削除
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addResident}
                className="btn-add"
              >
                + 入居者・同居人を追加
              </button>
            </div>
          )}
        </section>

        {/* 緊急連絡先（シニア向けサービス選択時のみ表示） */}
        {formData.selectedOptions.includes('senior-watch') && (
          <section className="form-section">
            <div className="accordion-header">
              <label className="accordion-label">
                <input
                  type="checkbox"
                  checked={accordionState.emergencyContact}
                  onChange={() => toggleAccordion('emergencyContact')}
                />
                <h2 className="section-title">
                  緊急連絡先
                  <span className="warning-text">※シニア向け総合見守りサービスを付帯する場合は、緊急連絡先のご登録（お届け）が必須となります。</span>
                </h2>
              </label>
            </div>
            
            {accordionState.emergencyContact && (
              <div className="accordion-content">
                <p className="section-description">
                  シニア向け総合見守りサービスを選択した場合は必須です。
                </p>
                
                <div className="form-row">
                  <label className="form-label">
                    お名前
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.name}
                    onChange={(e) => handleNestedChange('emergencyContact', 'name', e.target.value)}
                    className="form-input"
                    placeholder="田中 一郎"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    フリガナ
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.nameKana}
                    onChange={(e) => handleNestedChange('emergencyContact', 'nameKana', e.target.value)}
                    className="form-input"
                    placeholder="タナカ イチロウ"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    住所
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.address}
                    onChange={(e) => handleNestedChange('emergencyContact', 'address', e.target.value)}
                    className="form-input"
                    placeholder="東京都港区〇〇1-2-3"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    固定電話
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyContact.homePhone}
                    onChange={(e) => handleNestedChange('emergencyContact', 'homePhone', e.target.value)}
                    className="form-input"
                    placeholder="03-1234-5678"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    携帯電話
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyContact.mobilePhone}
                    onChange={(e) => handleNestedChange('emergencyContact', 'mobilePhone', e.target.value)}
                    className="form-input"
                    placeholder="090-1234-5678"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    続柄
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => handleNestedChange('emergencyContact', 'relationship', e.target.value)}
                    className="form-input"
                    placeholder="息子"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Submit button */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
            style={editingId ? {
              backgroundColor: '#ff9800',
              borderColor: '#f57c00'
            } : {}}
          >
            {loading ? 'PDF生成中...' : (editingId ? '✏️ 編集内容を保存してPDF再生成' : 'PDFを生成・ダウンロード')}
          </button>
        </div>
      </form>

      {/* プログレスモーダル */}
      {loading && (
        <div className="progress-modal-overlay">
          <div className="progress-modal">
            <h3 className="progress-title">正式書類（PDF）を作成しています</h3>
            
            <div className="progress-steps">
              <div className={`progress-step ${progress >= 10 ? 'completed' : progress > 0 ? 'active' : ''}`}>
                <span className="step-icon">{progress >= 30 ? '✓' : '▷'}</span>
                <span className="step-text">書類レイアウトを作成しています</span>
              </div>
              <div className={`progress-step ${progress >= 40 ? 'completed' : progress >= 30 ? 'active' : ''}`}>
                <span className="step-icon">{progress >= 70 ? '✓' : progress >= 30 ? '▷' : '○'}</span>
                <span className="step-text">データを準備しています</span>
              </div>
              <div className={`progress-step ${progress >= 70 ? 'active' : ''}`}>
                <span className="step-icon">{progress >= 95 ? '✓' : progress >= 70 ? '▷' : '○'}</span>
                <span className="step-text">PDFを書き出しています</span>
              </div>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>
                <span className="progress-percentage">{Math.round(progress)}%</span>
              </div>
            </div>

            <div className="progress-info">
              <p className="progress-status">{progressStep}</p>
              <p className="progress-notice">
                初回は通常30秒ほどかかる場合があります<br />
                ※画面は閉じずにお待ちください
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 保存成功モーダル */}
      {showSuccessModal && (
        <div className="progress-modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="progress-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="progress-title">
              {editingId ? '✅ データを上書き保存しました！' : '✅ データを保存しました！'}
            </h3>
            
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              {editingId ? (
                <>
                  <p style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                    「{formData.applicantName || '申込者'}」さんの申込データを更新しました。
                  </p>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    元のデータは削除されています。<br />
                    PDFファイルがダウンロードされました。
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '14px', color: '#333', marginBottom: '12px' }}>
                    PDF生成とデータ保存が完了しました。
                  </p>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    続けて入力する場合は「次の入力へ」を、<br />
                    登録済みデータを確認する場合は「一覧を見る」をクリックしてください。
                  </p>
                </>
              )}
            </div>

            <div className="modal-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
              {editingId ? (
                <button
                  className="btn-primary"
                  onClick={handleViewList}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: '1px solid #1565c0',
                    borderRadius: '2px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  一覧に戻る
                </button>
              ) : (
                <>
                  <button
                    className="btn-secondary"
                    onClick={handleContinueInput}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#003366',
                      color: 'white',
                      border: '1px solid #002244',
                      borderRadius: '2px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    次の入力へ
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleViewList}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      border: '1px solid #1565c0',
                      borderRadius: '2px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    一覧を見る
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationForm;
