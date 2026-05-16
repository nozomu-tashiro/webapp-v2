const express = require('express');
const router = express.Router();
const pdfGeneratorV5 = require('../utils/pdfGeneratorV5');
const emailSender = require('../utils/emailSender');
const errorLogger = require('../utils/errorLogger');

/**
 * POST /api/application/submit
 * PDF生成 + メール送信
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

    // ステップ1: PDF生成
    console.log('📄 Generating PDF...');
    const pdfBuffer = await pdfGeneratorV5.generatePDF(formData);
    console.log('✅ PDF generated successfully');

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

    // 代理店の連絡先メールアドレス（任意）
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

    // メール送信データ
    const emailData = {
      to: toEmail,
      cc: ccEmails,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: pdfFileName,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    console.log('📬 Sending to:', toEmail);
    console.log('📬 CC:', ccEmails.join(', '));

    // ステップ3: メール送信（リトライ付き）
    const sendResult = await emailSender.sendEmailWithRetry(emailData, 3);

    if (sendResult.success) {
      // 送信成功
      console.log('✅ Email sent successfully!');
      return res.json({
        success: true,
        message: 'メール送信に成功しました',
        sentAt: new Date().toISOString(),
        attempts: sendResult.attempt
      });

    } else {
      // 送信失敗（3回リトライ後）
      console.error('❌ Email sending failed after retries');

      // エラーログに記録
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
        // FAX番号を返す
        fallbackFax: '03-6240-3385'
      });
    }

  } catch (error) {
    console.error('❌ Error in application submission:', error);

    // エラーログに記録
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
