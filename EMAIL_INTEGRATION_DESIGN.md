# 📐 メール送信機能 修復・実装 設計書（確定版）

**作成日**: 2026-05-18
**最終更新**: 2026-05-18（Q1〜Q4ユーザー承認済み）
**目的**: 「メール送信に失敗しました」エラーの根本解決
**方針**: 既存機能を一切壊さず、Resendベースで安全に再構築する

---

## 🎯 ゴール

「PDF内容を確認して提出する」ボタン → PDF確認モーダル → 「いえらぶに送信する」ボタン → **送信確認ダイアログ（新規）** → 確定で **PDF1枚目だけ** をメール送信。

| 役割 | アドレス | 用途 |
|---|---|---|
| **TO** ① | `motfax-kaketsuke@ielove-partners.jp` | RPA自動受付 |
| **CC** ② | `kaketsuke.partners@ielove-partners.jp` | 人的フォロー（フェイルセーフ） |
| **CC** ③ | `formData.agentInfo.email`（あれば） + 追加CC入力（任意） | 代理店側履歴記録 |

---

## ✅ 確定したユーザー体験フロー

```
[1] フォーム入力
        ↓
[2] 🟦「PDF内容を確認して提出する」を押す（既存：文言変更なし）
        ↓
[3] 📥 PDFが自動ダウンロード（4枚つづり：ユーザー保存・印刷用）
        ↓
[4] 🪟 PDF確認モーダルが開く（4枚プレビュー）
        ↓
[5] 🟦「いえらぶに送信する」を押す（既存）
        ↓
[6] 🆕 送信確認ダイアログが開く（NEW）
       ┌────────────────────────────────────────┐
       │ 📧 メール送信内容の確認                 │
       │ ─────────────────                     │
       │ TO: motfax-kaketsuke@...               │
       │ CC: kaketsuke.partners@... + 代理店    │
       │ 📧 追加CC（任意）: [入力欄]            │
       │ 📎 添付: 申込書（1枚目）.pdf            │
       │ [キャンセル] [✉️ この内容で送信]      │
       └────────────────────────────────────────┘
        ↓
[7] 「この内容で送信」を押す
        ↓
[8] バックエンド処理
       ├ PDF4枚を生成（既存ロジック）
       ├ 🆕 1枚目だけ抜き出し（pdf-libで）
       └ Resend経由でメール送信
        ↓
[9] ✅ 成功モーダル / ❌ FAXダイアログ
```

---

## 🛡 絶対NG（自分への約束）

| # | やらないこと | 理由 |
|---|---|---|
| 1 | `pdfGeneratorV5.js` を1文字でも変更 | PDF生成は正常動作中 |
| 2 | `ApplicationForm.js` を全体置き換え | 過去2回これで機能消失 |
| 3 | 既存の `formData` 構造変更 | 全コードが依存している |
| 4 | 既存ボタン文言の変更 | ユーザー指示「変更不要」 |
| 5 | `webapp` で直接修正 | PROJECT_NOTES.md 厳守 |
| 6 | SendGridコードを残す | 混乱の元・完全に消す |
| 7 | API キー未設定でサーバー起動失敗 | PDF機能まで巻き込まないため |
| 8 | テストなしで本番デプロイ | preview環境で必ず確認 |

---

## 📋 変更ファイル一覧（全 12 ファイル）

### 🅰 webapp-v2（開発・Vercelフロントエンド）

| # | ファイル | 操作 | 規模 |
|---|---|---|:---:|
| A-1 | `backend/utils/emailSender.js` | **書き換え**（SendGrid→Resend） | ~130行 |
| A-2 | `backend/routes/applicationRoutes.js` | **修正**（PDF1枚目抽出+Resend形式） | +15行 |
| A-3 | `backend/utils/errorLogger.js` | **変更なし** | - |
| A-4 | `backend/package.json` | **依存差し替え** | 2行 |
| A-5 | `backend/.env.example` | **追記** | +5行 |
| A-6 | `frontend/src/components/ApplicationForm.js` | **加筆のみ** | +60行 |

### 🅱 webapp（Render本番バックエンド）

| # | ファイル | 操作 |
|---|---|---|
| B-1 | `backend/utils/emailSender.js` | **新規作成**（A-1のコピー） |
| B-2 | `backend/utils/errorLogger.js` | **新規作成**（A-3のコピー） |
| B-3 | `backend/routes/applicationRoutes.js` | **新規作成**（A-2のコピー） |
| B-4 | `backend/server.js` | **2行復元** |
| B-5 | `backend/package.json` | **依存追加** `resend` |
| B-6 | `backend/pre-deploy-check.js` | **チェック対象追加** |
| B-7 | `backend/.env.example` | **追記** |

---

## 📝 各ファイルの修正内容（詳細）

### A-1: `backend/utils/emailSender.js`（Resend版・完全新規）

**重要設計**:
- 関数シグネチャは既存と同じ（`sendEmail`, `sendEmailWithRetry`, `generateEmailSubject`, `generateEmailBody`, `sanitizeFileName`）
- 件名フォーマット維持：`[駆け付け申込] ${agentName}（${agentCode}） | ${applicantName} | ${dateStr}`
- メール本文の文面維持
- リトライ機能維持（3回・30秒/60秒待機）
- APIキー未設定でも require 時にクラッシュしない（警告のみ）

```javascript
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL;

let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('✅ Resend initialized');
} else {
  console.warn('⚠️ RESEND_API_KEY が未設定です。メール送信は失敗します');
}

async function sendEmail(emailData) {
  if (!resend) throw new Error('RESEND_API_KEY is not configured');
  if (!RESEND_FROM) throw new Error('RESEND_FROM_EMAIL is not configured');

  // Resendの仕様: attachments は { filename, content } で content は Buffer/string OK
  const attachments = (emailData.attachments || []).map(a => ({
    filename: a.filename,
    content: a.content // Buffer 直接渡し可
  }));

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
      cc: emailData.cc || [],
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text,
      attachments
    });

    if (result.error) {
      const err = new Error(result.error.message || 'Resend API error');
      err.response = result.error;
      throw err;
    }

    return { success: true, response: result };
  } catch (error) {
    console.error('Resend Error:', error);
    throw error;
  }
}

// sendEmailWithRetry, generateEmailSubject, generateEmailBody, 
// sanitizeFileName, formatDateTime, formatJapaneseDateTime
// は既存ロジックをそのまま流用（中身変更なし）

module.exports = {
  sendEmail,
  sendEmailWithRetry,
  generateEmailSubject,
  generateEmailBody,
  sanitizeFileName,
  formatDateTime,
  formatJapaneseDateTime
};
```

---

### A-2: `backend/routes/applicationRoutes.js`（PDF1枚目抽出を追加）

**🚨 最重要変更：PDF1枚目だけメール添付する処理を追加**

```diff
  const express = require('express');
  const router = express.Router();
  const pdfGeneratorV5 = require('../utils/pdfGeneratorV5');
  const emailSender = require('../utils/emailSender');
  const errorLogger = require('../utils/errorLogger');
+ const { PDFDocument } = require('pdf-lib'); // 1枚目抽出用

  router.post('/submit', async (req, res) => {
    try {
      const formData = req.body;
      // ... バリデーション（変更なし）...

      // ステップ1: PDF生成（4枚つづり）
      console.log('📄 Generating PDF (4 pages)...');
      const pdfBuffer = await pdfGeneratorV5.generatePDF(formData);
      console.log('✅ PDF generated successfully');

+     // ステップ1-2: メール添付用に「1枚目だけ」を抽出
+     console.log('✂️ Extracting first page for email attachment...');
+     const firstPageBuffer = await extractFirstPage(pdfBuffer);
+     console.log('✅ First page extracted');

      // ステップ2: メール送信準備
      // ... TO/CC構築（変更なし）...

      // メール送信データ
      const emailData = {
        to: toEmail,
        cc: ccEmails,
        subject: subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
        attachments: [
          {
-           content: pdfBuffer.toString('base64'),
+           content: firstPageBuffer, // ← 1枚目だけ
            filename: pdfFileName,
-           type: 'application/pdf',
-           disposition: 'attachment'
          }
        ]
      };

      // ステップ3: メール送信（リトライ付き）
      // ... 既存ロジックそのまま ...
    }
  });

+ /**
+  * PDF buffer から 1ページ目だけ抜き出す
+  * @param {Buffer} pdfBuffer - 4ページPDFのバッファ
+  * @returns {Promise<Buffer>} - 1ページPDFのバッファ
+  */
+ async function extractFirstPage(pdfBuffer) {
+   const fullPdf = await PDFDocument.load(pdfBuffer);
+   const firstPageDoc = await PDFDocument.create();
+   const [firstPage] = await firstPageDoc.copyPages(fullPdf, [0]);
+   firstPageDoc.addPage(firstPage);
+   const bytes = await firstPageDoc.save();
+   return Buffer.from(bytes);
+ }
```

**保証**:
- ✅ `pdf-lib` は既存依存（追加不要）
- ✅ `pdfGeneratorV5.js` は触らない
- ✅ ユーザーがブラウザでダウンロードするPDFは4枚のまま（別経路 `/api/pdf/generate`）
- ✅ メール添付のみ1枚目

---

### A-4: `backend/package.json`

```diff
  "dependencies": {
    "@pdf-lib/fontkit": "^1.1.1",
-   "@sendgrid/mail": "^8.1.6",
+   "resend": "^4.0.0",
    "body-parser": "^1.20.2",
    "canvas": "^3.2.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "moment": "^2.29.4",
    "pdf-lib": "^1.17.1",
    "pdfkit": "^0.14.0",
    "xlsx": "^0.18.5"
  }
```

---

### A-5: `backend/.env.example`

```diff
  # Server Configuration
  NODE_ENV=production
  PORT=5000

  # CORS Configuration
  CORS_ORIGIN=*
+
+ # Email Configuration (Resend)
+ # API Key: https://resend.com/api-keys
+ RESEND_API_KEY=re_xxxxxxxxxxxx
+ # From アドレス: 認証済みドメインのアドレス
+ # システム部DNS設定完了後 kaketsuke@ielove-partners.jp に切替
+ RESEND_FROM_EMAIL=onboarding@resend.dev
```

---

### A-6: `frontend/src/components/ApplicationForm.js`（加筆のみ）

**触る箇所は4箇所のみ。既存ロジックは1箇所も削除・置換しない。**

#### ① state を1つ追加（line 320付近、既存のstate追加位置）

```diff
  const [showFaxDialog, setShowFaxDialog] = useState(false);
+ // 🆕 送信確認ダイアログ用
+ const [showConfirmSendDialog, setShowConfirmSendDialog] = useState(false);
+ const [additionalCcEmail, setAdditionalCcEmail] = useState('');
```

#### ② `handleSendToIerabu` 直前に「送信確認ダイアログを開く関数」を追加

```diff
+ // 🆕 PDF確認モーダル内「いえらぶに送信する」押下時：送信確認ダイアログを開く
+ const openConfirmSendDialog = () => {
+   setShowConfirmSendDialog(true);
+ };

  // 既存: いえらぶに送信（メール送信）→ そのまま残す
  const handleSendToIerabu = async () => {
    setSendingEmail(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || '';
+     // 追加CCを含めた payload を構築
+     const payload = {
+       ...formData,
+       contactEmail: additionalCcEmail || ''
+     };

-     const response = await axios.post(`${apiUrl}/api/application/submit`, formData, {
+     const response = await axios.post(`${apiUrl}/api/application/submit`, payload, {
        timeout: 180000
      });

      if (response.data.success) {
        alert('✅ メール送信に成功しました！\n\nいえらぶパートナーズに申込書を送信しました。');
+       setShowConfirmSendDialog(false); // 確認ダイアログ閉じる
        setShowPreviewModal(false);
        setShowSuccessModal(true);
      } else {
        throw new Error(response.data.message || 'メール送信に失敗しました');
      }
    } catch (err) {
      console.error('Email sending error:', err);
      setSendingEmail(false);
+     setShowConfirmSendDialog(false); // 確認ダイアログ閉じる
      setShowPreviewModal(false);
      setShowFaxDialog(true);
    } finally {
      setSendingEmail(false);
    }
  };
```

#### ③ PDF確認モーダル内のボタン挙動を「直接送信」→「確認ダイアログを開く」に変更（1行のみ）

**Line 2135付近**:

```diff
              <button 
                className="btn-primary" 
-               onClick={handleSendToIerabu}
+               onClick={openConfirmSendDialog}
                disabled={sendingEmail}
              >
                {sendingEmail ? '送信中...' : 'いえらぶに送信する'}
              </button>
```

#### ④ JSXの末尾（FAXダイアログの直後）に「送信確認ダイアログ」を新規追加

**Line 2189付近、`{/* ★ 新機能: FAX番号表示ダイアログ */}` の閉じカッコの後に追加**:

```jsx
{/* 🆕 送信確認ダイアログ */}
{showConfirmSendDialog && (
  <div className="modal-overlay" onClick={() => !sendingEmail && setShowConfirmSendDialog(false)}>
    <div className="modal-content modal-confirm-send" onClick={(e) => e.stopPropagation()}
         style={{ maxWidth: '560px' }}>
      <div className="modal-header">
        <h2>📧 メール送信内容の確認</h2>
        {!sendingEmail && (
          <button className="modal-close" onClick={() => setShowConfirmSendDialog(false)}>×</button>
        )}
      </div>

      <div className="modal-body" style={{ padding: '20px 24px' }}>
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#555' }}>
          以下の宛先に申込書（1枚目）を送信します。内容をご確認ください。
        </p>

        <div style={{
          background: '#f7f9fc', border: '1px solid #e0e6ed',
          borderRadius: '6px', padding: '14px 16px', marginBottom: '16px'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '4px' }}>
              TO（メイン送信先）
            </div>
            <div style={{ fontSize: '14px', color: '#333' }}>
              motfax-kaketsuke@ielove-partners.jp
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '4px' }}>
              CC（自動付与）
            </div>
            <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7 }}>
              kaketsuke.partners@ielove-partners.jp
              {formData.agentInfo?.email && (
                <><br/>{formData.agentInfo.email}（代理店登録メール）</>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: '#333', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            📧 追加でCCしたいメール（任意）
          </label>
          <input
            type="email"
            value={additionalCcEmail}
            onChange={(e) => setAdditionalCcEmail(e.target.value)}
            placeholder="例: yourname@ielove-partners.jp"
            disabled={sendingEmail}
            style={{
              width: '100%', padding: '8px 10px', fontSize: '14px',
              border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
            ※ ご自身の手元にも控えを残したい場合などにご利用ください
          </div>
        </div>

        <div style={{
          background: '#fff8e1', border: '1px solid #ffe082',
          borderRadius: '4px', padding: '10px 12px', fontSize: '13px'
        }}>
          📎 添付ファイル: <strong>申込書（1枚目）.pdf</strong>
        </div>
      </div>

      <div className="modal-footer">
        <button
          className="btn-secondary"
          onClick={() => setShowConfirmSendDialog(false)}
          disabled={sendingEmail}
        >
          キャンセル
        </button>
        <button
          className="btn-primary"
          onClick={handleSendToIerabu}
          disabled={sendingEmail}
        >
          {sendingEmail ? '送信中...' : '✉️ この内容で送信する'}
        </button>
      </div>
    </div>
  </div>
)}
```

**影響範囲まとめ**:
- 既存JSXに**追加するだけ**（削除・置換ゼロ）
- 既存`formData`構造は不変
- 既存ボタンは全て同じ場所・同じ文言
- 既存`handleSendToIerabu`は内部に追加CC合成の数行を追記するだけ

---

### B-4: `webapp/backend/server.js`（2行復元）

```diff
  // Routes
  const pdfRoutes = require('./routes/pdfRoutes');
+ const applicationRoutes = require('./routes/applicationRoutes');
  app.use('/api/pdf', pdfRoutes);
+ app.use('/api/application', applicationRoutes);
```

加えて、ルート紹介エンドポイントも更新:

```diff
  endpoints: {
    health: 'GET /api/health',
    version: 'GET /api/version',
-   generatePDF: 'POST /api/pdf/generate'
+   generatePDF: 'POST /api/pdf/generate',
+   submitApplication: 'POST /api/application/submit'
  }
```

---

### B-6: `webapp/backend/pre-deploy-check.js`（チェック追加）

```diff
  const requiredFiles = [
    'server.js',
    'package.json',
    'routes/pdfRoutes.js',
+   'routes/applicationRoutes.js',
    'utils/pdfGeneratorV5.js',
+   'utils/emailSender.js',
+   'utils/errorLogger.js',
    'templates/ipag.ttf'
  ];

  const requiredDependencies = [
    'express',
    'cors',
    'body-parser',
    'pdf-lib',
-   '@pdf-lib/fontkit'
+   '@pdf-lib/fontkit',
+   'resend'
  ];
```

---

## 🌍 Render環境変数設定（実装後にあなたが操作）

| 変数名 | 初期値（テスト用） | システム部設定完了後 |
|---|---|---|
| `RESEND_API_KEY` | 既存「駆けつけフォーム本番」キー | 同じ |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | `kaketsuke@ielove-partners.jp` |

**Resendテストドメインの制約**:
- `onboarding@resend.dev` は **Resendアカウント所有者のメアドにしか送れない**
- なので、最初のテストはあなたのアドレスだけで動作確認

---

## 📅 実装の進め方（段階的・後戻り可能）

### Phase 1: 設計レビュー ✅ **完了**

### Phase 2: webapp-v2 でブランチ作成 + 実装 ⏳ **次これ**
- ブランチ: `feat/resend-email-integration`
- 全A-*ファイル変更
- ローカルでビルド確認
- PR作成（main宛）

### Phase 3: webapp（本番デプロイ用）に同期
- 同名ブランチ作成
- 全B-*ファイル反映
- PR作成

### Phase 4: あなたが Render 環境変数設定（コードはマージしない）

### Phase 5: PRマージ → 本番デプロイ
- webapp-v2 マージ → Vercel自動デプロイ
- webapp マージ → Render自動デプロイ

### Phase 6: テスト送信（あなたのアドレス宛）

### Phase 7: システム部に依頼
- `IT_DEPT_REQUEST.md` を生成

### Phase 8: ドメイン認証完了 → 本番3先（①②③）に切替

---

## ✅ 確認済みの仕様（再掲）

| # | 項目 | 確定内容 |
|---|---|:---:|
| Q1 | フォーム下メインボタン文言 | 「PDF内容を確認して提出する」のまま |
| Q2 | 送信フロー | 「いえらぶに送信する」→ 確認ダイアログ → 確定送信 |
| Q3 | PDF枚数の使い分け | ダウンロード=4枚 / メール添付=1枚目のみ |
| Q4 | 送信確認ダイアログUI | TO/CC明示 + 任意追加CC欄 + 添付ファイル名表示 |

---

**最終ステータス**: ✅ 設計確定。実装フェーズへ進行可能。
