# Cloudflare デプロイ（Workers + Containers）

`main` へのマージで GitHub Actions（`.github/workflows/deploy.yml`）が自動デプロイします。

```
ブラウザ ──▶ Worker (dm-boost)
              ├─ /            … 管理UI (public/) を静的配信。コンテナは起動しない
              └─ それ以外      … x-api-key を検証 → Container (Playwright + Express :3847 / WS :3848)
                                  └─ セッション・レート制限履歴を Durable Object storage に退避/復元
```

| 管理対象 | ツール |
|---|---|
| Worker 本体（名前・ログ・workers.dev・カスタムドメイン） | Terraform（`infra/terraform`、state は R2 `dm-boost-tfstate`） |
| コード・コンテナイメージのビルド/プッシュ・Secrets | Wrangler（CI 内） |

## 初回セットアップ

### 1. Cloudflare API トークン

Cloudflare ダッシュボード → My Profile → API Tokens → Create Custom Token。対象アカウントは Maliddy。

- Account / Workers Scripts: Edit
- Account / Containers: Edit
- Account / Workers R2 Storage: Edit（Terraform state 用）
- Account / Account Settings: Read

カスタムドメインを使う場合は、Zone / Workers Routes: Edit も付与してください。

### 2. GitHub Secrets（Settings → Secrets and variables → Actions）

| Secret | 必須 | 内容 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ✅ | 上で作成したトークン |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Maliddy アカウントの Account ID |
| `API_KEY` | ✅ | 管理UI/API のアクセスキー（ランダム文字列） |
| `INSTAGRAM_USERNAME` / `INSTAGRAM_PASSWORD` | | 任意。ID/パスワードでログインする場合 |
| `TWITTER_USERNAME` / `TWITTER_PASSWORD` | | 任意 |
| `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` | | 任意 |

カスタムドメインを使う場合は、Variables に `CUSTOM_DOMAIN`（例: `dm.example.com`）と `ZONE_ID` を設定します。

### 3. マージ

`main` にマージすると、check → terraform apply → wrangler deploy の順に実行されます。URL は Actions のログ（`https://dm-boost.<subdomain>.workers.dev`）で確認できます。

## 使い方

1. デプロイされた URL を開き、右上に `API_KEY` を入力して保存します。
2. 「セッション」でログインします。データセンターの IP からのログインは警戒されやすいので、**ローカルのブラウザでログインして Cookie をインポートする方法を推奨**します。
   - Cookie-Editor などの拡張機能で対象サイトの Cookie を JSON でエクスポートし、貼り付けます。
   - X は `auth_token` と `ct0` だけでも可。
3. 「アクション」から DM・いいね・投稿などを実行します。

## 運用メモ

- コンテナは最後のアクセスから 30 分でスリープします（課金停止）。次のアクセス時に起動し、保存済みのセッションを復元します。
- インスタンスは `standard-1`（1/2 vCPU・4GiB）を 1 台だけ使います。
- ログは Cloudflare ダッシュボード → Workers → dm-boost → Logs で確認できます。
- Terraform をローカルで実行する場合は、R2 の S3 認証情報を `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` に設定してから実行します。

  ```bash
  terraform init -backend-config="endpoints={s3=\"https://<ACCOUNT_ID>.r2.cloudflarestorage.com\"}"
  ```
