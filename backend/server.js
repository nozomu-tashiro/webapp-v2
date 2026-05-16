const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const pdfRoutes = require('./routes/pdfRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
app.use('/api/pdf', pdfRoutes);
app.use('/api/application', applicationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Application Form System API is running' });
});

// Version check - デプロイされているコードバージョンを確認
app.get('/api/version', (req, res) => {
  const fs = require('fs');
  const pdfGeneratorPath = path.join(__dirname, 'utils', 'pdfGeneratorV5.js');
  
  // pdfGeneratorV5.jsのファイル更新日時を取得
  let pdfGeneratorModified = 'unknown';
  let hasGuaranteeCheckbox = false;
  let hasPhoneOrderFix = false;
  
  try {
    const stats = fs.statSync(pdfGeneratorPath);
    pdfGeneratorModified = stats.mtime.toISOString();
    
    // ファイル内容をチェック
    const content = fs.readFileSync(pdfGeneratorPath, 'utf8');
    hasGuaranteeCheckbox = content.includes('保証番号入力済チェックマーク');
    hasPhoneOrderFix = content.includes('固定電話が上、携帯電話が下');
  } catch (err) {
    pdfGeneratorModified = 'error: ' + err.message;
  }
  
  res.json({ 
    status: 'ok',
    version: '2.0.0-fixed',
    deployedAt: new Date().toISOString(),
    pdfGeneratorModified,
    features: {
      guaranteeCheckbox: hasGuaranteeCheckbox,
      phoneOrderFixed: hasPhoneOrderFix,
      postalCodePrinting: true
    }
  });
});

// Root endpoint - API情報を返す
app.get('/', (req, res) => {
  res.json({ 
    status: 'success',
    message: '駆付けサービス入会申込書PDF出力システム - Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: 'GET /api/health',
      generatePDF: 'POST /api/pdf/generate',
      submitApplication: 'POST /api/application/submit',
      getErrors: 'GET /api/application/errors'
    }
  });
});

// Note: このバックエンドはAPIサーバーとして動作します
// フロントエンドは別途Vercelやその他のサービスでホストしてください

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
