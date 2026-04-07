/**
 * CSV出力ユーティリティ
 * データをCSV形式に変換してダウンロード・送信
 */

// CSVに変換
export const convertToCSV = (applications, agentCode, agentName) => {
  if (!applications || applications.length === 0) {
    return null;
  }
  
  // CSVヘッダー
  const headers = [
    '代理店コード',
    '代理店名',
    '登録日時',
    '商品ラインナップ',
    '支払方法',
    'お申込者様名',
    'フリガナ',
    '携帯番号',
    '固定番号',
    '生年月日',
    '性別',
    '物件住所',
    '物件名',
    '物件名フリガナ',
    '号室',
    'サービス提供価格',
    '保証番号',
    'サービス期間開始日',
    '緊急連絡先名',
    '緊急連絡先続柄',
    '緊急連絡先電話番号',
    '代理店情報_販売店名',
    '代理店情報_電話番号',
    '代理店情報_担当者名',
    '申込日',
    '入居者1_氏名',
    '入居者1_フリガナ',
    '入居者1_続柄',
    '入居者1_生年月日',
    '入居者2_氏名',
    '入居者2_フリガナ',
    '入居者2_続柄',
    '入居者2_生年月日',
    'オプションサービス'
  ];
  
  // CSVデータ行
  const rows = applications.map(app => {
    const data = app.formData;
    const residents = data.residents || [];
    
    return [
      agentCode,
      agentName,
      new Date(app.timestamp).toLocaleString('ja-JP'),
      getProductName(data.selectedProduct),
      getPaymentMethodName(data.paymentMethod),
      data.applicantName || '',
      data.applicantNameKana || '',
      data.mobilePhone || '',
      data.homePhone || '',
      data.birthDate || '',
      data.gender === 'male' ? '男性' : data.gender === 'female' ? '女性' : '',
      data.propertyAddress || '',
      data.propertyName || '',
      data.propertyNameKana || '',
      data.roomNumber || '',
      data.servicePrice || '',
      data.guaranteeNumber || '',
      data.servicePeriodStartDate || '',
      data.emergencyContact?.name || '',
      data.emergencyContact?.relationship || '',
      data.emergencyContact?.phone || '',
      data.agentInfo?.name || '',
      data.agentInfo?.phone || '',
      data.agentInfo?.contactPerson || '',
      data.applicationDate || '',
      residents[0]?.name || '',
      residents[0]?.nameKana || '',
      residents[0]?.relationship || '',
      residents[0]?.birthDate || '',
      residents[1]?.name || '',
      residents[1]?.nameKana || '',
      residents[1]?.relationship || '',
      residents[1]?.birthDate || '',
      (data.selectedOptions || []).join('、')
    ].map(escapeCSV);
  });
  
  // ヘッダーとデータを結合
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // BOM付きUTF-8（Excelで正しく開くため）
  return '\ufeff' + csvContent;
};

// CSV用にエスケープ
const escapeCSV = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  
  return stringValue;
};

// 商品名を取得
const getProductName = (productId) => {
  const products = {
    'anshin-support-24': 'あんしんサポート24',
    'home-assist-24': 'ホームアシスト24',
    'anshin-full-support': 'あんしんフルサポート',
    'ierabu-anshin-support': 'いえらぶ安心サポート'
  };
  return products[productId] || productId;
};

// 支払方法名を取得
const getPaymentMethodName = (methodId) => {
  const methods = {
    'monthly': '月払',
    'yearly-1': '年払（更新時運営会社案内）',
    'yearly-2': '年払（更新時代理店案内）'
  };
  return methods[methodId] || methodId;
};

// CSVファイルをダウンロード
export const downloadCSV = (csvContent, agentCode, agentName) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `駆け付けサービス申込_${agentCode}_${agentName}_${dateStr}.csv`;
  
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(link.href);
};

// メールでCSVを送信（バックエンドAPI経由）
export const sendCSVByEmail = async (csvContent, agentCode, agentName, email) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `駆け付けサービス申込_${agentCode}_${agentName}_${dateStr}.csv`;
    
    const response = await fetch('/api/email/send-csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentCode,
        agentName,
        email,
        csvContent,
        fileName
      })
    });
    
    if (!response.ok) {
      throw new Error('メール送信に失敗しました');
    }
    
    return await response.json();
  } catch (error) {
    console.error('メール送信エラー:', error);
    throw error;
  }
};
