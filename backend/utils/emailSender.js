/**
 * メール送信ユーティリティ（Resend版）
 *
 * 設計方針:
 * - 関数シグネチャは旧SendGrid版と完全互換 (sendEmail, sendEmailWithRetry, etc.)
 * - APIキー未設定でも require 時にクラッシュさせない（PDF機能を巻き込まないため）
 * - 件名フォーマット、メール本文、リトライ機構は旧版と同一
 */

const { Resend } = require('resend');

// 環境変数
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

// Resend クライアント初期化（APIキーがあれば）
let resend = null;
if (RESEND_API_KEY) {
  try {
    resend = new Resend(RESEND_API_KEY);
    console.log('✅ Resend client initialized');
  } catch (e) {
    console.error('❌ Resend init error:', e.message);
    resend = null;
  }
} else {
  console.warn('⚠️  RESEND_API_KEY is not set. Email sending will fail.');
}

if (!RESEND_FROM_EMAIL) {
  console.warn('⚠️  RESEND_FROM_EMAIL is not set. Email sending will fail.');
}

/**
 * メール送信（基本関数）
 * @param {Object} emailData
 * @param {string|Array<string>} emailData.to - 送信先
 * @param {Array<string>} emailData.cc - CC
 * @param {string} emailData.subject - 件名
 * @param {string} emailData.text - 本文（プレーン）
 * @param {string} [emailData.html] - 本文（HTML）
 * @param {Array<Object>} [emailData.attachments] - 添付（{ filename, content }）
 * @returns {Promise<Object>}
 */
async function sendEmail(emailData) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }

  // Resend の attachments 形式に整形
  // content は Buffer / base64 string / Uint8Array いずれも受付可
  const attachments = (emailData.attachments || []).map(a => ({
    filename: a.filename,
    content: a.content
  }));

  // TO は配列必須
  const toList = Array.isArray(emailData.to) ? emailData.to : [emailData.to];

  // CC は空配列の場合 undefined にしておく方が無難
  const ccList = (emailData.cc && emailData.cc.length > 0) ? emailData.cc : undefined;

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: toList,
      cc: ccList,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text,
      attachments
    });

    // Resend SDK v4 はエラー時 { data: null, error: {...} } を返す
    if (result && result.error) {
      const err = new Error(result.error.message || 'Resend API error');
      err.response = result.error;
      err.code = result.error.name || 'RESEND_ERROR';
      throw err;
    }

    return {
      success: true,
      response: result
    };
  } catch (error) {
    console.error('Resend Error:', error.message);
    if (error.response) {
      console.error('Error Detail:', JSON.stringify(error.response));
    }
    throw error;
  }
}

/**
 * リトライ付きメール送信
 * @param {Object} emailData
 * @param {number} maxRetries - 最大リトライ回数（デフォルト3）
 * @returns {Promise<Object>}
 */
async function sendEmailWithRetry(emailData, maxRetries = 3) {
  const delays = [0, 30000, 60000]; // 0秒、30秒、60秒

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`⏳ Waiting ${delays[attempt - 1] / 1000} seconds before retry ${attempt}...`);
        await sleep(delays[attempt - 1]);
      }

      console.log(`📧 Sending email (attempt ${attempt}/${maxRetries})...`);

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
 */
function getErrorType(error) {
  if (error.code === 'ETIMEDOUT' || (error.message && error.message.includes('timeout'))) {
    return 'SMTP_TIMEOUT';
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return 'NETWORK_ERROR';
  }
  if (error.response && error.response.statusCode === 400) {
    return 'INVALID_EMAIL';
  }
  if (error.code === 'validation_error') {
    return 'INVALID_EMAIL';
  }
  return 'UNKNOWN_ERROR';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * メール件名の生成（旧版と完全同一フォーマット）
 */
function generateEmailSubject(agentName, agentCode, applicantName) {
  const now = new Date();
  const dateStr = formatDateTime(now);
  return `[駆け付け申込] ${agentName}（${agentCode}） | ${applicantName} | ${dateStr}`;
}

/**
 * メール本文の生成（旧版と完全同一）
 */
function generateEmailBody(formData) {
  const now = new Date();
  const dateStr = formatJapaneseDateTime(now);

  // 選択されたオプション
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
 * PDFファイル名のサニタイズ（旧版と同一）
 */
function sanitizeFileName(agentName, applicantName) {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = timestamp.toTimeString().slice(0, 8).replace(/:/g, '');

  const safeAgentName = (agentName || 'agent').replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
  const safeApplicantName = (applicantName || 'applicant').replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');

  const filename = `駆付_${safeAgentName}_${safeApplicantName}_${dateStr}_${timeStr}.pdf`;
  return filename.length > 100 ? filename.substring(0, 97) + '.pdf' : filename;
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min}`;
}

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
