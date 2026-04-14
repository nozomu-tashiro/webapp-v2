/**
 * CSV出力ユーティリティ
 * データをCSV形式に変換してダウンロード・送信
 */

// CSVに変換
export const convertToCSV = (applications, agentCode, agentName) => {
  if (!applications || applications.length === 0) {
    return null;
  }
  
  // CSVヘッダー（画面の入力順に完全一致）
  const headers = [
    // 代理店情報
    '代理店コード',
    '代理店名',
    '登録日時',
    
    // 商品・サービス選択
    '商品ラインナップ',
    '支払方法',
    'サービス提供価格（円/税込）/毎月',
    'オプション1_近隣トラブル解決支援サービス',
    'オプション2_シニア向け総合見守りサービス',
    'オプション3_家電の安心サポート',
    '保証番号',
    
    // 販売店情報
    '販売店名',
    '販売店電話番号',
    '販売店コード',
    '販売店担当者名',
    
    // 対象物件情報
    '対象物件住所',
    '対象物件名',
    '対象物件名フリガナ',
    '対象物件号室',
    
    // 申込基本情報
    'お申込者様名',
    'お申込者様フリガナ',
    'お申込者様携帯番号',
    'お申込者様固定番号',
    'お申込者様生年月日',
    'お申込者様性別',
    
    // サービス期間
    'サービス期間開始日',
    'サービス期間（自動計算）',
    
    // 入居者・同居人情報
    '入居者1_お名前',
    '入居者1_フリガナ',
    '入居者1_生年月日',
    '入居者1_続柄',
    '入居者2_お名前',
    '入居者2_フリガナ',
    '入居者2_生年月日',
    '入居者2_続柄',
    '入居者3_お名前',
    '入居者3_フリガナ',
    '入居者3_生年月日',
    '入居者3_続柄',
    
    // 緊急連絡先
    '緊急連絡先_お名前',
    '緊急連絡先_フリガナ',
    '緊急連絡先_住所',
    '緊急連絡先_固定電話',
    '緊急連絡先_携帯電話',
    '緊急連絡先_続柄',
    
    // その他
    '申込日'
  ];
  
  // CSVデータ行
  const rows = applications.map(app => {
    const data = app.formData;
    const residents = data.residents || [];
    const emergency = data.emergencyContact || {};
    const agent = data.agentInfo || {};
    
    // オプションサービスの有無をチェック
    const options = data.selectedOptions || [];
    const hasNeighborTrouble = options.includes('neighbor-trouble') ? '○' : '';
    const hasSeniorWatch = options.includes('senior-watch') ? '○' : '';
    const hasApplianceSupport = options.includes('appliance-support') ? '○' : '';
    
    // サービス期間の自動計算
    let servicePeriod = '';
    if (data.servicePeriodStartDate && data.paymentMethod) {
      const startDate = new Date(data.servicePeriodStartDate);
      if (data.paymentMethod === 'monthly') {
        servicePeriod = '月払（期間指定なし）';
      } else if (data.paymentMethod.startsWith('yearly')) {
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 2);
        endDate.setMonth(endDate.getMonth() - 1);
        servicePeriod = `西暦${startDate.getFullYear()}年${String(startDate.getMonth() + 1).padStart(2, '0')}月${String(startDate.getDate()).padStart(2, '0')}日 から 2年後応当月の月末まで`;
      }
    }
    
    return [
      // 代理店情報
      agentCode,
      agentName,
      new Date(app.timestamp).toLocaleString('ja-JP'),
      
      // 商品・サービス選択
      getProductName(data.selectedProduct),
      getPaymentMethodName(data.paymentMethod),
      data.servicePrice || '',
      hasNeighborTrouble,
      hasSeniorWatch,
      hasApplianceSupport,
      data.guaranteeNumber || '',
      
      // 販売店情報
      agent.name || '',
      agent.phone || '',
      agent.code || '',
      agent.representativeName || '',
      
      // 対象物件情報
      data.propertyAddress || '',
      data.propertyName || '',
      data.propertyNameKana || '',
      data.roomNumber || '',
      
      // 申込基本情報
      data.applicantName || '',
      data.applicantNameKana || '',
      data.mobilePhone || '',
      data.homePhone || '',
      data.birthDate || '',
      data.gender === 'male' ? '男性' : data.gender === 'female' ? '女性' : '',
      
      // サービス期間
      data.servicePeriodStartDate || '',
      servicePeriod,
      
      // 入居者・同居人情報（最大3人）
      residents[0]?.name || '',
      residents[0]?.nameKana || '',
      residents[0]?.birthDate || '',
      residents[0]?.relationship || '',
      residents[1]?.name || '',
      residents[1]?.nameKana || '',
      residents[1]?.birthDate || '',
      residents[1]?.relationship || '',
      residents[2]?.name || '',
      residents[2]?.nameKana || '',
      residents[2]?.birthDate || '',
      residents[2]?.relationship || '',
      
      // 緊急連絡先
      emergency.name || '',
      emergency.nameKana || '',
      emergency.address || '',
      emergency.homePhone || '',
      emergency.mobilePhone || '',
      emergency.relationship || '',
      
      // その他
      data.applicationDate || ''
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
    'anshin-support-24': '① あんしんサポート２４',
    'home-assist-24': '② ホームアシスト２４',
    'anshin-full-support': '③ あんしんフルサポート',
    'ierabu-anshin-support': '④ いえらぶ安心サポート'
  };
  return products[productId] || productId;
};

// 支払方法名を取得
const getPaymentMethodName = (methodId) => {
  const methods = {
    'monthly': '月払',
    'yearly-2': '年払（2年更新）',
    'yearly-1': '年払（1年更新）'
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
