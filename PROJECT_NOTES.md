# プロジェクト重要事項メモ

## 🔴 絶対に守るべきルール

### 1. リポジトリ構成
- **`webapp-v2`** = 本番稼働中の正しいコード（メインリポジトリ）
  - GitHub: `https://github.com/nozomu-tashiro/webapp-v2.git`
  - フロントエンド: Vercel (`https://webapp-v2-sage.vercel.app/`)
  - バックエンドAPI: Render.com (`https://kaketsuke-form-web.onrender.com`)

- **`webapp` (kaketsuke-form-web)** = バックエンドデプロイ用リポジトリ
  - GitHub: `https://github.com/nozomu-tashiro/kaketsuke-form-web.git`
  - Render.comが参照するリポジトリ
  - **webapp-v2のコピーを保持するだけ**

### 2. 作業フロー（厳守）

```bash
# 1. webapp-v2 で修正
cd /home/user/webapp-v2
# コード修正...
git add .
git commit -m "修正内容"
git push origin main

# 2. webapp にコピー（バックエンド修正の場合のみ）
cp /home/user/webapp-v2/backend/utils/[修正ファイル] /home/user/webapp/backend/utils/

# 3. webapp もコミット＆プッシュ
cd /home/user/webapp
git add .
git commit -m "同じ修正内容"
git push origin main
```

### 3. 絶対にやってはいけないこと ❌

1. **webapp から webapp-v2 へのコピー** → webapp は古いコードの可能性あり
2. **webapp で直接修正** → webapp-v2 との不整合が発生
3. **ApplicationForm.js の安易な置き換え** → 機能が大量に失われる
4. **git reset --hard の多用** → 必ず現在の状態を確認してから
5. **フロントエンドとバックエンドの混同** → デプロイ先が違う

## 🎯 デプロイ構成

### フロントエンド
- リポジトリ: `webapp-v2`
- デプロイ先: **Vercel**
- URL: `https://webapp-v2-sage.vercel.app/`
- 自動デプロイ: 有効（mainブランチへのpush時）
- 確認方法: Vercel Dashboard → Deployments

### バックエンド
- 開発リポジトリ: `webapp-v2`
- デプロイ用リポジトリ: `webapp` (kaketsuke-form-web)
- デプロイ先: **Render.com**
- サービス名: `kaketsuke-form-web`
- API URL: `https://kaketsuke-form-web.onrender.com`
- 自動デプロイ: 有効（mainブランチへのpush時）
- 確認方法: Render.com Dashboard → Events

## 📝 過去の重大なミス

### ミス1: リポジトリの混同（2026-05-15）
- **問題**: webapp-v2とwebappを混同し、古いコードで上書き
- **影響**: 代理店コード入力欄、必須項目、生年月日入力、入居者情報など全機能が消失
- **原因**: webappが12月の古いコード、webapp-v2が最新だと理解していなかった
- **対策**: 必ず webapp-v2 で作業し、バックエンド修正時のみ webapp にコピー

### ミス2: ApplicationForm.js の破壊的変更
- **問題**: 郵便番号追加時に ApplicationForm.js を古いバージョンで上書き
- **影響**: 
  - 代理店コード入力欄（4分割）が消失
  - 必須項目バリデーションが消失
  - 生年月日の自動フォーカス移動が消失
  - 入居者情報の「契約者と同じ」チェックボックスが消失
- **教訓**: 新機能追加は**既存コードへの追加**のみ。全体の置き換えは絶対NG

### ミス3: 座標の推測
- **問題**: PDF座標を確認せずに推測で設定
- **影響**: いえらぶあんしんサポートで郵便番号が大幅にずれる
- **対策**: 必ず実際のPDFで確認後、1つの商品でテストしてから他に展開

## 🔧 よくある修正パターン

### PDF印字位置の修正
```javascript
// backend/utils/pdfGeneratorV5.js
// 商品によって座標が異なる
const coords123 = { ... };  // 商品①②③
const coords4 = { ... };    // 商品④いえらぶあんしんサポート
```

### フォーム項目の追加
```javascript
// frontend/src/components/ApplicationForm.js
// 1. formData に追加
const [formData, setFormData] = useState({
  ...
  newField: '',  // ← 追加
});

// 2. JSX に入力欄追加
<input name="newField" value={formData.newField} onChange={handleInputChange} />

// 3. バックエンドで受け取る（必要な場合）
const { newField = '', ... } = formData;
```

## 📊 主要ファイル

### フロントエンド
- `frontend/src/components/ApplicationForm.js` - メインフォーム（953行、重要）
- `frontend/src/components/ApplicationList.js` - 申込一覧
- `frontend/src/components/Login.js` - ログイン
- `frontend/src/components/Register.js` - 登録

### バックエンド
- `backend/utils/pdfGeneratorV5.js` - PDF生成（重要）
- `backend/templates/*.pdf` - PDF帳票テンプレート

## 🚨 緊急時の復旧手順

### 1. コードが壊れた場合

```bash
# 最新の動作確認済みコミットを確認
cd /home/user/webapp-v2
git log --oneline -10

# 安全なコミットに戻す（例: 910c21c）
git reset --hard 910c21c
git push --force origin main

# webappも同期
cd /home/user/webapp
cp -r /home/user/webapp-v2/frontend/* frontend/
cp -r /home/user/webapp-v2/backend/* backend/
git add -A
git commit -m "fix: webapp-v2から復元"
git push --force origin main
```

### 2. デプロイが反映されない場合

**Vercel:**
1. https://vercel.com/dashboard
2. プロジェクト選択 → Deployments
3. 最新コミットが表示されているか確認
4. なければ「Redeploy」

**Render.com:**
1. https://dashboard.render.com/
2. kaketsuke-form-web → Events
3. 最新コミットが表示されているか確認
4. なければ Manual Deploy → Deploy latest commit

## 📅 重要な日付

- **2026-05-15 11:00前**: 安全な状態（コミット 910c21c）
- **2026-05-15**: Bug ③ 携帯電話と固定電話の修正

## 🎯 進行中のタスク

### Phase 1: PDF出力問題（優先度：高）
- [x] ③ 携帯電話と固定電話の逆転 → 完了
- [ ] ② 郵便番号フィールド追加
- [ ] ⑧ 保証番号入力時のチェックボックス
- [ ] ⑪ 年払（2年更新）選択時の税込チェックボックス

### Phase 2: バリデーション改善
- [ ] ① ②③ など

### Phase 3: UX改善
- [ ] ④⑤⑥⑦⑫ など

## 💡 開発のヒント

1. **テストは段階的に**: 1つの商品で確認後、他の商品に展開
2. **座標は実測**: PDF座標は必ず実際の帳票で確認
3. **コミットは細かく**: 1機能1コミットで、いつでもロールバック可能に
4. **必須項目に注意**: 新規項目は基本的に任意項目として追加
5. **キャッシュクリア必須**: テスト時は必ず Ctrl+Shift+R

## 📞 連絡先・リソース

- GitHub webapp-v2: https://github.com/nozomu-tashiro/webapp-v2
- GitHub webapp: https://github.com/nozomu-tashiro/kaketsuke-form-web
- Vercel: https://vercel.com/dashboard
- Render.com: https://dashboard.render.com/
- 本番URL: https://webapp-v2-sage.vercel.app/
- API URL: https://kaketsuke-form-web.onrender.com

---

**最終更新**: 2026-05-15
**作成者**: AI Developer
**目的**: 同じミスを二度と繰り返さないための記録
