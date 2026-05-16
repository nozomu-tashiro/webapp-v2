const sgMail = require('@sendgrid/mail');

// SendGrid API Key の設定（環境変数から取得）
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY is not set. Email sending will fail.');
}

/**
 * メール送信のヘルパー関数
 * @param {Object} emailData - メール送信データ
 * @param {string} emailData.to - 送信先メールアドレス
 * @param {Array<string>} emailData.cc - CCメールアドレスの配列
 * @param {string} emailData.subject - メール件名
 * @param {string} emailData.text - メール本文（テキスト）
 * @param {string} emailData.html - メール本文（HTML）
 * @param {Array<Object>} emailData.attachments - 添付ファイル配列
 * @returns {Promise<Object>} - 送信結果
 */
async function sendEmail(emailData) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not configured');
  }

  const msg = {
    to: emailData.to,
    cc: emailData.cc || [],
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com', // 要設定
    subject: emailData.subject,
    text: emailData.text,
    html: emailData.html || emailData.text,
    attachments: emailData.attachments || []
  };

  try {
    const response = await sgMail.send(msg);
    return {
      success: true,
      response: response
    };
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error('Error Response Body:', error.response.body);
    }
    throw error;
  }
}

/**
 * リトライ付きメール送信
 * @param {Object} emailData - メール送信データ
 * @param {number} maxRetries - 最大リトライ回数（デフォルト: 3）
 * @returns {Promise<Object>} - 送信結果
 */
async function sendEmailWithRetry(emailData, maxRetries = 3) {
  const delays = [0, 30000, 60000]; // 0秒、30秒、60秒

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 待機（1回目は待機なし）
      if (attempt > 1) {
        console.log(`⏳ Waiting ${delays[attempt - 1] / 1000} seconds before retry ${attempt}...`);
        await sleep(delays[attempt - 1]);
      }

      console.log(`📧 Sending email (attempt ${attempt}/${maxRetries})...`);
      
      // メール送信試行
      const result = await sendEmail(emailData);
      
      console.log(`✅ Email sent successfully on attempt ${attempt}`);
      return {
        success: true,
        attempt: attempt,
        response: result.response
      };

    } catch (error) {
      console.error(`❌ Email sending failed (attempt ${attempt}/${maxRetries}):`, error.message);

      // 最後の試行でも失敗
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          errorType: getErrorType(error),
          attempts: maxRetries
        };
      }
    }
  }
}

/**
 * エラータイプの判定
 * @param {Error} error - エラーオブジェクト
 * @returns {string} - エラータイプ
 */
function getErrorType(error) {
  if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    return 'SMTP_TIMEOUT';
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return 'NETWORK_ERROR';
  }
  if (error.response && error.response.statusCode === 400) {
    return 'INVALID_EMAIL';
  }
  return 'UNKNOWN_ERROR';
}

/**
 * スリープ関数
 * @param {number} ms - ミリ秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * メール件名の生成
 * @param {string} agentName - 代理店名
 * @param {string} agentCode - 代理店コード
 * @param {string} applicantName - 申込者名
 * @returns {string} - メール件名
 */
function generateEmailSubject(agentName, agentCode, applicantName) {
  const now = new Date();
  const dateStr = formatDateTime(now);
  return `[駆け付け申込] ${agentName}（${agentCode}） | ${applicantName} | ${dateStr}`;
}

/**
 * メール本文の生成
 * @param {Object} formData - 申込データ
 * @returns {string} - メール本文
 */
function generateEmailBody(formData) {
  const now = new Date();
  const dateStr = formatJapaneseDateTime(now);

  // 選択されたオプションを取得
  const options = [];
  if (formData.selectedOptions && Array.isArray(formData.selectedOptions)) {
    const optionMap = {
      'support': '駆け付けサポート',
      'water': '水トラブルサポート',
      'key': '鍵トラブルサポート',
      'water-support-gold': '水まわりサポートGold',
      'ielove-anshin-support': 'いえらぶあんしんサポート',
      'home-assist-24': 'おうちアシスト24',
      'anshin-full-support': 'あんしんフルサポート',
      'life-support-plus': 'ライフサポートPlus',
      'appliance-support': '家電の安心サポート（Syu-rIt！シューリット！）'
    };
    
    formData.selectedOptions.forEach(opt => {
      if (optionMap[opt]) {
        options.push(`- ${optionMap[opt]}`);
      }
    });
  }

  const optionsText = options.length > 0 ? options.join('\n') : '- 選択なし';

  return `いえらぶパートナーズ 駆付係 御中

駆け付けサービスの申込書をお送りします。

━━━━━━━━━━━━━━━━━━━━━━
【代理店情報】
代理店名: ${formData.agentInfo?.name || '未入力'}
代理店コード: ${formData.agentInfo?.code || '未入力'}
━━━━━━━━━━━━━━━━━━━━━━

【申込者情報】
お名前: ${formData.applicantName || '未入力'} 様
申込日時: ${dateStr}

【契約内容】
${optionsText}

ご確認の程、よろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━━━
このメールは駆け付けサービス申込フォームから自動送信されています。
━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * PDFファイル名のサニタイズ
 * @param {string} agentName - 代理店名
 * @param {string} applicantName - 申込者名
 * @returns {string} - ファイル名
 */
function sanitizeFileName(agentName, applicantName) {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = timestamp.toTimeString().slice(0, 8).replace(/:/g, '');

  // 安全な文字のみ残す
  const safeAgentName = agentName.replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
  const safeApplicantName = applicantName.replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');

  const filename = `駆付_${safeAgentName}_${safeApplicantName}_${dateStr}_${timeStr}.pdf`;

  // 最大100文字に制限
  return filename.length > 100 ? filename.substring(0, 97) + '.pdf' : filename;
}

/**
 * 日時フォーマット（YYYY/MM/DD HH:MM形式）
 * @param {Date} date - 日付オブジェクト
 * @returns {string} - フォーマット済み日時
 */
function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min}`;
}

/**
 * 日時フォーマット（日本語形式）
 * @param {Date} date - 日付オブジェクト
 * @returns {string} - フォーマット済み日時
 */
function formatJapaneseDateTime(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日 ${h}:${min}`;
}

module.exports = {
  sendEmail,
  sendEmailWithRetry,
  generateEmailSubject,
  generateEmailBody,
  sanitizeFileName,
  formatDateTime,
  formatJapaneseDateTime
};
