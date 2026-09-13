# Intentia v0.1

> うまく言葉にできなくていい。

曖昧なユーザー入力を、最小限の確認質問で明確なIntentへ変換し、
最終的に高品質なAI実行プロンプトを生成するMVPです。

## v0.1 の範囲

1. ユーザーが曖昧な要望を入力
2. Intent Engine が以下を推定
   - Task
   - Goal
   - Audience
   - Desired outcome
   - Context
   - Constraints
   - Evidence
   - Output
   - Quality
3. 成果に大きく影響する不明点だけを検出
4. 次に聞くべき質問を1つだけ生成
5. 通常0〜3問で終了
6. 十分理解できたらIntent Summaryを表示
7. 完成プロンプトを生成

## 重要な設計思想

### Minimum Questions, Maximum Understanding

「項目を全部埋める」のではなく、
最終成果物に影響する曖昧さだけを解消します。

質問の価値は概念的に以下で評価します。

Question Value ≈
(Information Gain × Output Impact) ÷ User Effort

## セットアップ

Node.js を用意したうえで:

```bash
npm install
```

`.env.example` を `.env.local` にコピーし、APIキーを設定します。

```bash
cp .env.example .env.local
```

`.env.local`:

```env
OPENAI_API_KEY=YOUR_KEY
OPENAI_MODEL=gpt-5.6-luna
```

起動:

```bash
npm run dev
```

ブラウザで:

```text
http://localhost:3000
```

## 現時点では入れない機能

v0.1では以下は意図的に未実装です。

- ログイン
- データベース
- Stripe課金
- Web Research
- ChatGPT / Claude / Gemini 別の最適化
- Prompt履歴
- PPT / Excel / Word生成
- チーム機能

まず検証するのは1点だけです。

> 「0〜3問の対話で、ユーザーが『そう、それが言いたかった』と感じるか？」

## 次の評価指標

βテストでは以下を記録するのがおすすめです。

- clarification_questions_count
- understanding_score
- user_accepts_intent_summary
- user_edits_intent_summary
- prompt_used_without_edit
- task_success_rating (1-5)
- "そう、それ"率

## v0.2 候補

- 「この理解で合っている / 少し違う」フィードバック
- Web Research が必要かの自動判定
- Research Agent
- 生成Promptのモデル別最適化
- Intentの編集UI
- 1問あたりのInformation Gain推定
