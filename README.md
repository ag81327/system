<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/aa28ddf3-856f-4bcc-9906-199b53140380

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment

本專案包含一組 GitHub Action (`.github/workflows/deploy.yml`)，當推送到 `main` 分支時會自動編譯 (`npm run build`) 將 `dist` 資料夾的靜態檔案發布至 GitHub Pages。

**注意：**
請確認專案在 GitHub Settings 裡的 Pages 設定中，將來源設定為「GitHub Actions」。

## Other Modifications

1. **package.json 設定與執行**: 已完整配置 Dependencies 與 DevDependencies，並執行 `npm install` 驗證套件安裝無誤。專案支援 Vite 開發伺服器 (`npm run dev`) 與建置 (`npm run build`)，確保系統可以正常啟動運行。
2. **GitHub Action 部署機制**: 在 `.github/workflows/deploy.yml` 提供自動化腳本。當代碼推送到 `main` 分支時，即可自動編譯 (`npm run build`) 並透過 GitHub Pages 發布上線。
3. **.gitignore 隱私與暫存檔設定**: 已設計嚴謹的 `.gitignore` 檔案，有效排除 `node_modules/` 依賴夾、`dist/` 編譯資料夾、`.env` 等隱私環境變數檔案，以及 IDE (`.vscode/`, `.idea/`) 與系統層級 (如 `.DS_Store`) 的暫存快取檔。
4. **README 操作追蹤**: 將上述開發環境、部署配置與規則設定皆記錄於本文檔中。
