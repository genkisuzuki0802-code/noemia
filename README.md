\# Noemia v0.2



> うまく言葉にできなくていい。



Noemiaは、ユーザーの曖昧な要望を対話によって整理し、

「本当にやりたいこと」をAIが理解したうえで成果物を生成するAIアプリケーションです。



ユーザー自身が完璧なプロンプトを書く必要はありません。



Noemiaが、最終成果に大きく影響する情報だけを確認し、

意図を整理してAI実行までつなげます。



\## Noemiaの基本フロー



1\. ユーザーが曖昧な要望を入力

2\. Intent Engineがユーザーの意図を分析

3\. 最終成果に大きく影響する不明点を検出

4\. 必要な場合だけ、確認質問を1つずつ行う

5\. 十分な情報が集まったらIntent Summaryを生成

6\. ユーザーの意図から完成プロンプトを生成

7\. AIがそのプロンプトを実行

8\. ユーザーは追加指示によって成果物を修正できる



\## Intent Engine



Noemiaでは、ユーザーの入力を以下の観点から整理します。



\- Task

\- Goal

\- Audience

\- Desired outcome

\- Context

\- Constraints

\- Evidence

\- Output

\- Quality



ただし、すべての項目を埋めることを目的にはしていません。



最終成果物に大きく影響する情報が不足している場合だけ、

追加の確認質問を行います。



\## Design Philosophy



\### Minimum Questions, Maximum Understanding



Noemiaの目的は、ユーザーに大量の質問をすることではありません。



成果物の品質に大きく影響する曖昧さだけを解消し、

できるだけ少ないやり取りでユーザーの意図を理解します。



質問の価値は概念的に以下のように考えています。



```text

Question Value ≈

(Information Gain × Output Impact) ÷ User Effort

```



\### Confirmed Facts vs Assumptions



Noemiaでは、ユーザーが明示した事実とAIによる推測を区別します。



AIがもっともらしい情報を勝手にユーザーの事実として扱わないことを

重要な設計原則としています。



不明な情報が成果に影響する場合は、推測で補完するのではなく、

確認事項や次のアクションとして扱います。



\## v0.2で実装済みの機能



\- 自然言語による曖昧な要望入力

\- Intent分析

\- 重要度の高い確認質問の生成

\- Intent理解度の表示

\- Intent Summaryの生成

\- 完成プロンプトの生成

\- AIによる成果物の生成

\- Markdown形式の成果物表示

\- 追加指示による成果物の修正

\- AIによる成果物全体の再構成

\- 1つ前の成果物へのUndo

\- 再生成

\- 成果物のコピー

\- Confirmed FactsとAssumptionsの分離

\- Critical GapsによるReady判定

\- AIによる未確認情報の創作を抑えるGrounding



\## 現在のAIモデル



現在のプロトタイプではGoogle Gemini APIを使用しています。



主な実行モデル：



```text

gemini-3.5-flash-lite

```



モデル構成は今後変更される可能性があります。



\## セットアップ



Node.jsを用意したうえで、依存パッケージをインストールします。



```bash

npm install

```



Gemini APIキーを `.env.local` に設定します。



```env

GEMINI\_API\_KEY=YOUR\_API\_KEY

```



APIキーを含む `.env.local` はGitHubへコミットしないでください。



起動：



```bash

npm run dev

```



ブラウザ：



```text

http://localhost:3000

```



\## 現時点で未実装の主な機能



Noemia v0.2では、Intent理解とAI実行体験の検証を優先しています。



そのため、以下のような機能は今後の開発対象です。



\- ユーザーアカウント

\- データベース

\- Prompt / 実行履歴の永続保存

\- Web Research

\- 外部データソースとの連携

\- 複数AIモデルの最適な使い分け

\- PPT / Excel / Wordなどのファイル生成

\- チーム機能

\- 課金機能

\- Intentの直接編集UI



\## 現在の検証テーマ



Noemiaが検証したい中心的な問いは、



> 「ユーザーがうまく言葉にできなくても、少ない対話で『そう、それが言いたかった』という状態までAIが理解できるか？」



です。



単に高品質な文章を生成することではなく、

AIに指示すること自体の難しさを減らすことを目指しています。



\## Status



Prototype / v0.2

