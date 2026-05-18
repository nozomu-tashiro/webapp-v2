# 📨 システム部 依頼文テンプレート

**用途**: いえらぶパートナーズ駆け付けフォームのメール送信用ドメイン認証を、システム部（IT部門）に依頼する文面。

**送信先**: 社内システム部担当者
**作成日**: 2026-05-18

---

## 📧 メール本文（コピペ用）

```
件名：駆け付け申込WEBシステム メール送信用 サブドメイン・DNS設定のお願い

システム部 ご担当者様

お疲れさまです。○○部の田代です。

現在運用中の「いえらぶパートナーズ駆け付け申込WEBシステム」につきまして、
申込PDFを RPA 自動受付メールアドレス宛にメール送信する機能の改修を行っております。

つきましては、以下の DNS 設定をお願いできますでしょうか。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【依頼内容】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

メール送信サービス「Resend」（https://resend.com）から、
「ielove-partners.jp」ドメインで送信できるように、
DNS レコード（SPF / DKIM / MX）を追加していただきたいです。

サブドメイン化の選択肢：
  案A：ielove-partners.jp 直下から送信
       → from: kaketsuke@ielove-partners.jp
  案B：専用サブドメインを切る
       → 例: send.ielove-partners.jp
       → from: kaketsuke@send.ielove-partners.jp

※ 案Bの方が既存のメール送信（社員メール等）と分離できて
   安全性が高いと聞いておりますが、システム部としての
   ご推奨をお聞かせいただけると幸いです。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【背景】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

・現在、申込メール送信が技術的問題で停止しております
・社内管理・セキュリティ面でも、社のドメインから送信したい
・月間想定送信数：約 45,000通（500件/日 × 3宛先）
・送信先：
  TO  : motfax-kaketsuke@ielove-partners.jp（RPA自動受付）
  CC  : kaketsuke.partners@ielove-partners.jp（人的フォロー）
  CC  : 代理店メールアドレス（履歴記録用）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【追加が必要な DNS レコード】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ドメイン認証完了の方針が決まりましたら、
Resend 管理画面で発行される具体的なレコード値
（TXTレコード3〜4種類）を、別途お送りいたします。

参考までに、Resend が要求する一般的なレコード構成は以下です：

1. SPF レコード（TXT）
   例: "v=spf1 include:_spf.resend.com ~all"

2. DKIM レコード（TXT、3つ）
   例: resend._domainkey.send.ielove-partners.jp
       → "p=MIGfMA0GCSqGSIb3DQE..."（公開鍵）
   ※ Resend管理画面で具体値が表示されます

3. （任意）DMARC レコード（TXT）
   例: "v=DMARC1; p=none;"

4. （任意）MX レコード
   受信は不要なので、設定しなくても送信は可能です

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【希望スケジュール】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

現場業務では「メール送信が出来ない」状態が続いており、
FAX運用でしのいでおります。
可能であれば、今週中にご対応いただけますと大変助かります。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ご検討のほど、よろしくお願いいたします。
ご不明な点があれば、Resend のドキュメントURL等もお送りできます。

  Resend公式ドメイン認証手順：
  https://resend.com/docs/dashboard/domains/introduction

田代
```

---

## 🔄 システム部から「具体的なレコード値を教えてほしい」と返事が来たら

田代さん自身で Resend ダッシュボードを開いて、以下の手順で「正式なレコード値」を取得し、システム部に転送します。

### Resend での操作手順

1. https://resend.com/domains にアクセス
2. **「Add Domain」** をクリック
3. ドメイン名を入力（システム部と相談の上）：
   - 案A の場合: `ielove-partners.jp`
   - 案B の場合: `send.ielove-partners.jp`
4. リージョン：`Tokyo (ap-northeast-1)` を選択
5. 「Add」をクリック
6. 表示される DNS レコードの値（複数）を**画面キャプチャ or テキストコピー**して、システム部にメール転送

### システム部に転送するときの文面

```
件名: Re: 駆け付け申込WEBシステム メール送信用ドメイン認証 - DNS値ご共有

システム部 ご担当者様

お忙しいところありがとうございます。
ご依頼いただいた、Resend での具体的な DNS レコード値を以下に共有します。

サブドメイン: send.ielove-partners.jp（または ielove-partners.jp）

【設定が必要な TXT レコード】

種別   ホスト名                              値
----   --------                              ----
TXT    send                                  v=spf1 include:_spf.resend.com ~all
TXT    resend._domainkey.send                p=MIGfMA0GCSqGS...（コピー値）
TXT    _dmarc.send                           v=DMARC1; p=none;

種別   ホスト名      値                      優先度
----   --------      ----                    ------
MX     send          feedback-smtp.ap-northeast-1.amazonses.com    10

※ 値はResend管理画面に表示されている内容そのまま転記しています

DNS設定後、Resend管理画面で「Verify」ボタンを押すと
認証完了となります。お手数ですが、設定完了をお知らせいただければ
当方で認証ボタンを押します。

よろしくお願いいたします。

田代
```

---

## 🎉 認証完了後の作業（田代さん）

システム部からDNS設定完了の連絡が来たら：

1. **Resend ダッシュボードで認証実行**
   - https://resend.com/domains
   - 該当ドメインの「Verify DNS Records」ボタンをクリック
   - 全レコードが ✅ になることを確認

2. **Render 環境変数を本番アドレスに切り替え**
   - https://dashboard.render.com/
   - kaketsuke-form-web → Environment
   - `RESEND_FROM_EMAIL` を編集
   - 値: `kaketsuke@ielove-partners.jp`（または `kaketsuke@send.ielove-partners.jp`）
   - Save Changes → 自動再デプロイ

3. **本番テスト送信**
   - フォームから1件試験申込
   - ① TO: `motfax-kaketsuke@...` に届くか確認
   - ② CC: `kaketsuke.partners@...` に届くか確認
   - ③ CC: 代理店メール（追加CC欄に田代さん自身のアドレス）に届くか確認
   - 添付PDFが **1枚目だけ** であることを確認

4. **Resend Pro プランへアップグレード**（本番リリース前）
   - https://resend.com/settings/billing
   - $20/月 / 50,000通/月
   - 月間送信予測：約45,000通 → Proで余裕あり

---

## 📅 想定スケジュール

| ステップ | 担当 | 想定所要 |
|---|---|---|
| 1. 依頼メール送信 | 田代さん | 5分 |
| 2. システム部から返信 | システム部 | 数時間〜1営業日 |
| 3. Resend で具体的なDNSレコード値取得 | 田代さん | 10分 |
| 4. システム部に値を転送 | 田代さん | 5分 |
| 5. システム部でDNS設定 | システム部 | 数時間〜1営業日 |
| 6. Resend で認証実行 | 田代さん | 5分 |
| 7. Render環境変数切替 + 本番テスト | 田代さん | 10分 |
| **合計（営業日換算）** | | **1〜3営業日** |

---

**最終更新**: 2026-05-18
