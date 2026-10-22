# 摩爾應材研發數據管理平台 (RD Test & Experiment Management System)

> 專為材料研發設計之現代化研發數據、實驗配方、製程條件、試驗品管分析（SPC / 製程能力）與協作審核管理系統。

---

## 📋 目錄

- [系統架構與技術棧](#-系統架構與技術棧)
- [主要功能模組](#-主要功能模組)
- [環境需求](#-環境需求)
- [本地開發指南](#-本地開發指南)
  - [1. 複製儲存庫](#1-複製儲存庫)
  - [2. 安裝相依套件](#2-安裝相依套件)
  - [3. 環境變數設定](#3-環境變數設定)
  - [4. 啟動開發伺服器](#4-啟動開發伺服器)
  - [5. 靜態型別與語法檢查](#5-靜態型別與語法檢查)
  - [6. 正式環境編譯打包](#6-正式環境編譯打包)
  - [7. 本地正式版預覽](#7-本地正式版預覽)
- [GitHub Actions 自動化部署 (CI/CD)](#-github-actions-自動化部署-cicd)
  - [工作流程簡介](#工作流程簡介)
  - [首次部署必要 GitHub 設定與權限](#首次部署必要-github-設定與權限)
  - [觸發部署方式](#觸發部署方式)
- [Firebase 後端與權限機制](#-firebase-後端與權限機制)
- [專案目錄結構](#-專案目錄結構)
- [維護與開發原則](#-維護與開發原則)

---

## 🛠 系統架構與技術棧

| 領域 | 使用技術 / 套件 | 說明 |
| :--- | :--- | :--- |
| **前端核心** | React 19, TypeScript (~5.8) | 元件化開發與強型別防護 |
| **建置工具** | Vite 6 | 極速熱重載 (HMR) 與 Rollup 生產打包 |
| **樣式與 UI** | TailwindCSS 4, Lucide React, Motion | 現代化響應式介面與動態過場效果 |
| **路由模式** | React Router DOM v7 (HashRouter) | 雜湊路由相容靜態伺服器與 GitHub Pages |
| **後端與認證** | Firebase Auth, Cloud Firestore | 即時資料同步、使用者認證與資料庫持久化 |
| **圖表與統計** | Recharts, Plotly.js | 試驗數據視覺化、管制圖 (SPC) 與 DOE 分析 |
| **文字與報表** | Tiptap (Rich Text), jspdf, html2canvas, xlsx | 富文本實驗筆記、PDF/Excel 報表匯出 |
| **CI/CD** | GitHub Actions, GitHub Pages | 自動化型別檢查、打包建置與靜態部署 |

---

## 🚀 主要功能模組

1. **專案管理 (Project Management)**
   - 專案建立、編輯與狀態追蹤（規劃中、進行中、已完成）。
   - 專屬 KPI 目標設定與各試驗項目規格上下限（USL / LSL / Target）配置。
2. **實驗與配方管理 (Experiment & Recipe)**
   - 實驗紀錄建立（關聯專案、試驗日期、操作人員、觀察心得與異常回報）。
   - 原料配方管理（批號、理論重量、單位）與配方版本化保存。
   - 製程參數記錄（溫度、壓力、時間等）與快速套用常用製程範本。
3. **試驗數據與統計製程分析 (SPC & DOE)**
   - 樣本測試數據登錄（抗拉強度、伸長率、密度、含水率、透氧率等）。
   - **SPC 統計製程管制**：平均值（X-bar）、全距（R）管制圖與自動判異輔助。
   - **製程能力分析**：自動計算製程能力指標（$C_p$, $C_{pk}$）、常態分佈擬合。
   - **DOE 實驗設計輔助**：多因子相關性分析、因子效應矩陣與最佳化建議。
4. **研發協作與審核 (RD Management & Review)**
   - 跨專案數據比對 (Data Comparison)。
   - 實驗審核流（待審核、核准、駁回）與操作軌跡稽核日誌 (Audit Log)。
5. **使用者與權限管理 (User Management)**
   - 帳號註冊與後台管理員審核通過機制 (`isApproved`)。
   - 角色權限分級（Admin / User）與專案 / 實驗日期的存取控制白名單。

---

## 💻 環境需求

在開始之前，請確保您的開發機已安裝以下環境：
- **Node.js**：`v20.x` 或 `v22.x` 以上（推薦使用 Node.js LTS 版本）。
- **npm**：`v10.x` 以上。
- **Git**：版本控制工具。

---

## 🛠 本地開發指南

### 1. 複製儲存庫

```bash
git clone https://github.com/ag81327/RD-test-system.git
cd RD-test-system
```

### 2. 安裝相依套件

為確保與 `package-lock.json` 版本一致，建議使用：

```bash
npm install
# 或使用確定性安裝
npm ci
```

### 3. 環境變數設定

專案根目錄提供 [.env.example](.env.example) 範本檔案：
- 若需客製化特定環境設定或 Gemini AI 金鑰，可複製一份為 `.env.local`：
  ```bash
  cp .env.example .env.local
  ```
- **注意**：`.env.local` 已列入 `.gitignore`，切勿將機密金鑰提交至 Git 儲存庫。

### 4. 啟動開發伺服器

執行以下指令啟動 Vite 開發伺服器：

```bash
npm run dev
```

啟動後，終端機將顯示本地預覽網址：
- 本地網址：`http://localhost:3000/system/`（或自訂 Base Path）
- 區域網路網址：`http://[您的本機IP]:3000/system/`

### 5. 靜態型別與語法檢查

在提交程式碼前，建議執行 TypeScript 檢查以確保無型別衝突：

```bash
npm run lint
# 或
npm run typecheck
```

### 6. 正式環境編譯打包

執行 Vite 正式生產環境編譯：

```bash
npm run build
```

- 編譯產物將生成於 `dist/` 資料夾。
- 專案配置了動態 `base: process.env.VITE_BASE_PATH || './'` 相對路徑打包，產出的 HTML 能相容於任何子路徑或根目錄部署。

### 7. 本地正式版預覽

在本地模擬伺服器環境檢驗打包後的產物：

```bash
npm run preview
```

---

## 🚢 GitHub Actions 自動化部署 (CI/CD)

專案已內建完整的自動化部署流程，檔案位於 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。

### 工作流程簡介

每當有程式碼推送至 `main` 分支時，GitHub Actions 將依序執行：
1. **簽出程式碼**（Checkout Repository v4）。
2. **初始化環境**（Node.js 22 + npm 快取加速）。
3. **安全安裝**（執行 `npm ci` 確保套件版本完全一致）。
4. **型別檢查**（執行 `npm run lint`，確保無編譯與型別錯誤）。
5. **正式打包**（以相對路徑 `./` 編譯生產檔案至 `dist/`）。
6. **建立 `.nojekyll`**（防止 GitHub Pages 內建 Jekyll 忽略特殊檔案）。
7. **發佈至 `gh-pages` 分支**（由 GitHub 自動更新線上靜態網站）。

### 首次部署必要 GitHub 設定與權限

在儲存庫首次執行部署前，請由 GitHub 儲存庫管理員確認以下兩項設定：

#### 步驟 1：啟用 Actions 寫入權限 (Workflow Permissions)
1. 進入 GitHub 儲存庫頁面。
2. 點擊頂部的 **Settings** 標籤。
3. 在左側選單點選 **Actions** -> **General**。
4. 滾動至下方 **Workflow permissions** 區塊：
   - 勾選 **Read and write permissions**（允許工作流程將打包產物推送到 `gh-pages` 分支）。
5. 點擊 **Save** 儲存。

#### 步驟 2：設定 GitHub Pages 來源分支
1. 在同一個 **Settings** 頁面，左側選單點選 **Pages**。
2. 在 **Build and deployment** 下方的 **Source** 選擇：
   - **Deploy from a branch**。
3. 在 **Branch** 選項中：
   - 分支選擇 **`gh-pages`**。
   - 資料夾選擇 **`/ (root)`**。
4. 點擊 **Save**。
5. 幾分鐘後，GitHub Pages 將提供線上公開網址（例如：`https://ag81327.github.io/RD-test-system/`）。

### 觸發部署方式
- **自動觸發**：推送更新至 `main` 分支（`git push origin main`）。
- **手動觸發**：進入 GitHub 儲存庫的 **Actions** 標籤，點選 **Deploy to GitHub Pages**，點擊 **Run workflow** 即可手動重新部署。

---

## 🔒 Firebase 後端與權限機制

1. **連線設定**：
   - 專案讀取 [firebase-applet-config.json](firebase-applet-config.json) 初始化 Firebase 服務（包含 `projectId`, `apiKey`, `firestoreDatabaseId`）。
2. **身分驗證與帳號審核**：
   - 使用者註冊後，帳號預設狀態為 `isApproved: false`。
   - 需由系統管理員登入並至 `#/users`（使用者管理）頁面審核核准後，方可登入進入主系統。
   - 預設開發者管理者郵箱帳號具有自動審核初始權限。
3. **Firestore 安全規則**：
   - 規則定義於 [firestore.rules](firestore.rules)，限制只有通過審核之使用者與管理者可對研發數據進行增刪查改。

---

## 📁 專案目錄結構

```text
RD-test-system/
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions 自動化 CI/CD 部署腳本
├── src/
│   ├── components/               # React 頁面與 UI 元件庫
│   │   ├── Analysis.tsx          # 數據統計與圖表分析主頁面
│   │   ├── AuthContext.tsx       # 全域認證與權限狀態管理
│   │   ├── Dashboard.tsx         # 研發數據首頁儀表板
│   │   ├── DOEAnalysis.tsx       # 實驗設計因子分析
│   │   ├── ExperimentDetail.tsx  # 實驗細節、配方與製程參數編輯
│   │   ├── ExperimentList.tsx    # 實驗清單與檢索
│   │   ├── Login.tsx             # 登入與註冊介面
│   │   ├── ProjectList.tsx       # 專案列表與規格設定
│   │   ├── SPCAnalysis.tsx       # SPC 管制圖與製程能力分析
│   │   └── ...
│   ├── lib/                      # 核心工具庫
│   │   ├── firebaseService.ts    # Firestore CRUD API 整合
│   │   ├── firestoreUtils.ts     # Firestore 異常防護與日誌
│   │   ├── persistence.ts        # 資料庫持久化與 LocalStorage 回退備援
│   │   ├── statsUtils.ts         # 核心統計演算（SPC、均值、標準差、Cp/Cpk）
│   │   └── utils.ts              # 通用樣式與字串輔助函式
│   ├── types.ts                  # 全域 TypeScript 資料型別定義
│   ├── App.tsx                   # 應用程式根路由配置 (HashRouter)
│   ├── firebase.ts               # Firebase App 初始化實例
│   ├── index.css                 # TailwindCSS 4 樣式入口
│   └── main.tsx                  # React 應用進入點
├── .gitignore                    # Git 版本控制排除清單
├── firebase.json                 # Firebase 規則與資料庫配置
├── firestore.rules               # Firestore 權限安全規則
├── index.html                    # 前端單頁應用入口 HTML
├── package.json                  # 專案套件配置與執行腳本
├── tsconfig.json                 # TypeScript 編譯配置
└── vite.config.ts                # Vite 構建與外掛設定
```

---

## 🛡 維護與開發原則

1. **保全原有架構與功能**：
   - 所有改動需確保現有配方、實驗數據與 SPC 計算公式之正確性。
2. **依賴管理**：
   - 請勿隨意更動 major 版本；任何套件變更必須執行 `npm run lint` 與 `npm run build` 進行編譯驗證。
3. **機密防護**：
   - 嚴禁將包含密碼、私密憑證、Google 帳號私人 Token 提交至 Git 儲存庫。
