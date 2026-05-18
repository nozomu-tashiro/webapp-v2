# 🔧 Render 環境変数 設定マニュアル

**対象サービス**: `kaketsuke-form-web`
**ダッシュボード**: https://dashboard.render.com/
**作業時間**: 約3分

---

## 📋 設定する環境変数（2つ）

| 変数名 | 値 | 説明 |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` | Resendダッシュボードで作成済みの「駆けつけフォーム本番」キー |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | **一旦テスト用**。システム部DNS設定後に切り替える |

---

## 🚦 手順

### Step 1. Renderダッシュボードにログイン

1. ブラウザで https://dashboard.render.com/ にアクセス
2. ログイン

### Step 2. kaketsuke-form-web サービスを開く

1. ダッシュボードのサービス一覧から `kaketsuke-form-web` をクリック

### Step 3. 環境変数設定画面へ

1. 左サイドメニューの **「Environment」** をクリック
2. 「Environment Variables」セクションが表示される

### Step 4. RESEND_API_KEY を追加

1. **「Add Environment Variable」** ボタンをクリック
2. 次のように入力：
   - **Key**: `RESEND_API_KEY`
   - **Value**: Resendダッシュボードからコピーした「駆けつけフォーム本番」のAPIキー
     - 取得元: https://resend.com/api-keys
     - 形式: `re_` から始まる長い文字列
3. **「Save Changes」** をクリック（まだデプロイは始めない）

### Step 5. RESEND_FROM_EMAIL を追加

1. もう一度 **「Add Environment Variable」**
2. 次のように入力：
   - **Key**: `RESEND_FROM_EMAIL`
   - **Value**: `onboarding@resend.dev`
3. **「Save Changes」**

### Step 6. （まだ）自動デプロイは走らせない

このタイミングでは PR がまだマージされていないので、Renderは再デプロイしません。
PR #31 をマージすれば、新しい環境変数つきで自動デプロイされます。

---

## ⚠️ Resend テストドメインの制約（重要）

`onboarding@resend.dev` を `from` に使う場合、**送信先は Resend アカウント所有者のメアドだけ** に制限されます。

これは Resend の仕様で、誰でも自由に送れる踏み台にされるのを防ぐためのものです。

つまり最初のテストでは：

- ✅ Resendアカウントの所有メアド（田代さんのメアド）には届く
- ❌ `motfax-kaketsuke@ielove-partners.jp` には届かない
- ❌ `kaketsuke.partners@ielove-partners.jp` には届かない

この制約は、**システム部にDNS設定をしてもらってドメイン認証が完了した後**、`RESEND_FROM_EMAIL` を `kaketsuke@ielove-partners.jp` に切り替えることで解除されます。

---

## 🧪 テスト送信手順（PRマージ後・環境変数設定後）

### ① テスト用に送信先を一時的に変える方法

実装コードはハードコードで本番3先に送るようになっているため、テスト時は以下の方法で田代さんのメアドだけに届くか確認します：

**方法A: Resendダッシュボードのログで確認**
1. https://resend.com/emails でメール送信履歴を確認
2. APIキー経由で送信が試みられたか、エラーが何だったかを見る
3. テストドメインの場合「送信先制限」エラーが返るが、それも記録される

**方法B: 一時的にフロントで送信先を変える（推奨しない）**
コード修正が必要なため、推奨しません。

**方法C: 任意の追加CC欄に田代さんのアドレスを入れて、メインTO/CCはResendが弾く前提でテスト**
- 確認ダイアログの「📧 追加でCCしたいメール（任意）」に `tashiro@ielove-partners.jp` を入力
- 送信ボタン → Resendが返すエラーで挙動確認

### ② 本番運用前の最終確認

システム部にDNS設定してもらった後：
1. `RESEND_FROM_EMAIL` を `kaketsuke@ielove-partners.jp` に変更
2. 本番3先（①TO ②CC ③CC）すべてに届くか確認
3. PDF添付が **1枚目だけ** であることを確認
4. 件名が `[駆け付け申込] ${代理店名}（${代理店コード}） | ${申込者名} | YYYY/MM/DD HH:MM` 形式であることを確認

---

## 🆘 トラブルシューティング

### Q. 「メール送信に失敗しました」が引き続き表示される

**A. 以下を順に確認**:

1. Render Dashboard → Events で最新デプロイが完了しているか確認
2. https://kaketsuke-form-web.onrender.com/ にアクセスし、エンドポイント一覧に `submitApplication` が含まれているか確認
   ```json
   "endpoints": {
     "submitApplication": "POST /api/application/submit"  ← これが見えればOK
   }
   ```
3. Render Logs で「Resend Error:」というログを探す。詳細なエラーメッセージが出る

### Q. Resend APIキーが間違っているか確認したい

**A.** Renderダッシュボード → kaketsuke-form-web → Logs で次のメッセージを探す：
- ✅ 正常: `Resend client initialized`
- ❌ 異常: `RESEND_API_KEY is not set` または `Resend init error:`

### Q. PDF添付が4枚になっている

**A.** `applicationRoutes.js` の `extractFirstPage()` 関数が実行されていない可能性。Render Logsで以下を確認：
- ✅ 正常: `✂️ Extracting first page for email attachment...`
- ❌ 異常: このログが出ない場合、デプロイされたコードが古い → Manual Redeploy

---

**最終更新**: 2026-05-18
