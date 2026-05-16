const fs = require('fs');
const path = require('path');

// ログディレクトリのパス
const LOG_DIR = path.join(__dirname, '../logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'email-errors.log');

/**
 * ログディレクトリを作成（存在しない場合）
 */
function ensureLogDirectory() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * メール送信失敗ログを記録
 * @param {Object} errorData - エラーデータ
 */
function logEmailError(errorData) {
  try {
    ensureLogDirectory();

    const logEntry = {
      id: generateUUID(),
      failedAt: new Date().toISOString(),
      errorType: errorData.errorType || 'UNKNOWN_ERROR',
      errorMessage: errorData.errorMessage || 'No error message',
      agentCode: errorData.agentCode || 'N/A',
      applicantName: errorData.applicantName || 'N/A',
      retryCount: errorData.retryCount || 0,
      lastRetryAt: errorData.lastRetryAt || new Date().toISOString()
    };

    // JSON形式でログを追記
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(ERROR_LOG_FILE, logLine, 'utf8');

    console.log('📝 Error logged:', logEntry.id);
    return logEntry.id;

  } catch (error) {
    console.error('Failed to log error:', error);
    return null;
  }
}

/**
 * エラーログの読み込み（最新N件）
 * @param {number} limit - 取得件数
 * @returns {Array<Object>} - エラーログ配列
 */
function getRecentErrors(limit = 100) {
  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) {
      return [];
    }

    const content = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    const errors = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(item => item !== null)
      .reverse() // 最新が先頭
      .slice(0, limit);

    return errors;

  } catch (error) {
    console.error('Failed to read error log:', error);
    return [];
  }
}

/**
 * UUID生成（簡易版）
 * @returns {string} - UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = {
  logEmailError,
  getRecentErrors
};
