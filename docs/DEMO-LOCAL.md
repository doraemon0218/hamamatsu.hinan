# ローカルサーバでデモする手順

## 1. 起動

プロジェクトルートで:

```bash
npm run dev:demo
```

- ブラウザ: **http://127.0.0.1:3002**

`3002` が既に使われている場合（`EADDRINUSE`）:

```bash
npm run dev:demo:alt
```

→ **http://127.0.0.1:3004**

`3004` も埋まっている場合:

```bash
npm run dev:demo:3005
```

→ **http://127.0.0.1:3005**

- `EMFILE: too many open files` や `404` が出る環境では、`dev:demo` がウォッチをポーリングに切り替えるため安定しやすいです。

### ロックで起動できないとき

```bash
rm -f .next/dev/lock
npm run dev:demo
```

### ポートが埋まっているとき

別ポートで起動する例:

```bash
CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true npx next dev -p 3004 -H 127.0.0.1
```

→ **http://127.0.0.1:3004**

---

## 2. デモの流れ（おすすめ）

| 順 | 画面 | URL |
|----|------|-----|
| 1 | ホーム（レベル・地域振興券カード） | `/` |
| 2 | 設定（表示名・生年月日＝行政向け提出情報） | `/settings` |
| 3 | 避難訓練（浜松 or 串本町） | `/training?region=hamamatsu` または `?region=kushimoto` |
| 4 | 振り返りで「自治体に提出」→ 行政ダッシュに蓄積 | 訓練完了後の提出ボタン |
| 5 | 行政ダッシュボード（浜松） | `/admin/hamamatsu` |
| 6 | 行政ダッシュボード（串本町） | `/admin/kushimoto` |
| 7 | 地域振興券を配る（予算・1人あたり・優先順位） | ダッシュボード内モーダル |
| 8 | ユーザー側・振興券フォルダ | `/vouchers` |

**注意**: 提出ログ・振興券はサーバのメモリ保持のため、**開発サーバを止めるとリセット**されます。

---

## 3. 地図・GPS を省いたデモ

訓練画面で **`?demo=1`** を付けると、GPS が少ない状態でも振り返り地図をデモしやすくなります。

例: `http://127.0.0.1:3002/training?region=hamamatsu&demo=1`
