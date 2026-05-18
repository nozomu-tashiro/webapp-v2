const express = require('express');
const router = express.Router();
const { PDFDocument } = require('pdf-lib');
const pdfGeneratorV5 = require('../utils/pdfGeneratorV5');
const emailSender = require('../utils/emailSender');
const errorLogger = require('../utils/errorLogger');

/**
 * PDF buffer から 1ページ目だけを抜き出す
 * @param {Buffer} pdfBuffer - 元PDF（4ページつづり）のバッファ
 * @returns {Promise<Buffer>} - 1ページPDFのバッファ
 */
async function extractFirstPage(pdfBuffer) {
  const fullPdf = await PDFDocument.load(pdfBuffer);
  const totalPages = fullPdf.getPageCount();

  if (totalPages === 0) {
    throw new Error('PDF has no pages');
  }

  const firstPageDoc = await PDFDocument.create();
  const [firstPage] = await firstPageDoc.copyPages(fullPdf, [0]);
  firstPageDoc.addPage(firstPage);
  const bytes = await firstPageDoc.save();
  return Buffer.from(bytes);
}

/**
 * POST /api/application/submit
 * PDF生成 + 1枚目だけ抜き出し + Resend経由でメール送信
 *
 * 送信先：
 *   TO: motfax-kaketsuke@ielove-partners.jp（RPA自動受付）
 *   CC: kaketsuke.partners@ielove-partners.jp（人的フォロー）
 *       + 代理店登録メール（agentInfo.email）
 *       + 任意追加メール（contactEmail）※フロントで送信確認ダイアログで入力
 */
router.post('/submit', async (req, res) => {
  try {
    const formData = req.body;

    // バリデーション
    if (!formData.applicantName) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '申込者名は必須です'
      });
    }

    if (!formData.agentInfo || !formData.agentInfo.name || !formData.agentInfo.code) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '代理店情報は必須です'
      });
    }

    console.log('📋 Received application submission:', {
      applicantName: formData.applicantName,
      agentName: formData.agentInfo.name,
      agentCode: formData.agentInfo.code
    });

    // ステップ1: PDF生成（4ページつづり）
    console.log('📄 Generating PDF (full 4 pages)...');
    const pdfBuffer = await pdfGeneratorV5.generatePDF(formData);
    console.log('✅ PDF generated successfully');

    // ステップ1-2: メール添付用に「1ページ目だけ」を抽出
    console.log('✂️  Extracting first page for email attachment...');
    const firstPageBuffer = await extractFirstPage(pdfBuffer);
    console.log(`✅ First page extracted (${firstPageBuffer.length} bytes)`);

    // ステップ2: メール送信準備
    console.log('📧 Preparing email...');

    // TO: いえらぶFAX受付
    const toEmail = 'motfax-kaketsuke@ielove-partners.jp';

    // CC: いえらぶ受付 + 代理店メール
    const ccEmails = ['kaketsuke.partners@ielove-partners.jp'];

    // 代理店の登録メールアドレス
    if (formData.agentInfo.email) {
      ccEmails.push(formData.agentInfo.email);
    }

    // 代理店の連絡先メールアドレス（任意：フロントの送信確認ダイアログで入力されたもの）
    if (formData.contactEmail && formData.contactEmail !== formData.agentInfo.email) {
      ccEmails.push(formData.contactEmail);
    }

    // メール件名
    const subject = emailSender.generateEmailSubject(
      formData.agentInfo.name,
      formData.agentInfo.code,
      formData.applicantName
    );

    // メール本文
    const body = emailSender.generateEmailBody(formData);

    // PDFファイル名
    const pdfFileName = emailSender.sanitizeFileName(
      formData.agentInfo.name,
      formData.applicantName
    );

    // メール送信データ（Resend形式）
    const emailData = {
      to: toEmail,
      cc: ccEmails,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
      attachments: [
        {
          filename: pdfFileName,
          content: firstPageBuffer // ← 1枚目だけを添付
        }
      ]
    };

    console.log('📬 Sending to:', toEmail);
    console.log('📬 CC:', ccEmails.join(', '));

    // ステップ3: メール送信（リトライ付き）
    const sendResult = await emailSender.sendEmailWithRetry(emailData, 3);

    if (sendResult.success) {
      console.log('✅ Email sent successfully!');
      return res.json({
        success: true,
        message: 'メール送信に成功しました',
        sentAt: new Date().toISOString(),
        attempts: sendResult.attempt
      });
    } else {
      console.error('❌ Email sending failed after retries');

      const errorId = errorLogger.logEmailError({
        errorType: sendResult.errorType,
        errorMessage: sendResult.error,
        agentCode: formData.agentInfo.code,
        applicantName: formData.applicantName,
        retryCount: sendResult.attempts,
        lastRetryAt: new Date().toISOString()
      });

      return res.status(500).json({
        success: false,
        error: sendResult.errorType,
        message: 'メール送信に失敗しました',
        attempts: sendResult.attempts,
        errorId: errorId,
        fallbackFax: '03-6240-3385'
      });
    }
  } catch (error) {
    console.error('❌ Error in application submission:', error);

    errorLogger.logEmailError({
      errorType: 'SYSTEM_ERROR',
      errorMessage: error.message,
      agentCode: req.body.agentInfo?.code || 'N/A',
      applicantName: req.body.applicantName || 'N/A',
      retryCount: 0,
      lastRetryAt: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: 'システムエラーが発生しました',
      fallbackFax: '03-6240-3385'
    });
  }
});

/**
 * GET /api/application/errors
 * エラーログの取得（管理用）
 */
router.get('/errors', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const errors = errorLogger.getRecentErrors(limit);

    res.json({
      success: true,
      count: errors.length,
      errors: errors
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs',
      message: error.message
    });
  }
});

module.exports = router;
