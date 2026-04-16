# MiniMax Music 应用生成器

一个基于 [MiniMax Music 2.6](https://platform.minimaxi.com/docs/api-reference/music-generation) 的 AI 音乐生成 Web 应用。支持从歌词 + 曲风生成原创歌曲，也支持上传参考音频进行翻唱。

## 功能

- **创作模式**：手动输入歌词，或用 AI 根据主题一键生成歌词
- **翻唱模式**：上传参考音频文件（mp3/wav/flac）或粘贴音频 URL，生成同旋律的翻唱
- **曲风选择**：15 个预设标签（情绪 / 风格 / 场景）+ 自定义补充
- **在线播放**：生成后内嵌播放器，支持拖动进度条
- **打包下载**：下载的 MP3 自带 ID3 标签 —— 封面图（1:1 裁剪，800×800 JPEG）+ 歌词（USLT）+ 标题
- **响应式布局**：桌面双栏布局（≥1024px），移动端单列堆叠

## 技术栈

**后端**
- Python 3.12 + [FastAPI](https://fastapi.tiangolo.com/)
- [uv](https://github.com/astral-sh/uv) 管理依赖
- [httpx](https://www.python-httpx.org/) 调 MiniMax API
- [mutagen](https://mutagen.readthedocs.io/) 写 ID3 标签
- 异步任务用 `BackgroundTasks` + 内存字典（MVP，无数据库）

**前端**
- React 19 + TypeScript + Vite
- Tailwind CSS v3
- [react-easy-crop](https://github.com/ValentinH/react-easy-crop) 封面裁剪

**部署**
- 单容器 Docker 镜像（多阶段构建：Node 打包前端 → Python 运行时 + uv）

## 快速开始

### 前置条件

- Node.js ≥ 22（仅本地开发需要）
- Python ≥ 3.12 和 [uv](https://github.com/astral-sh/uv)（仅本地开发需要）
- 一个 [MiniMax](https://platform.minimaxi.com/) API Key

### 方式 A：Docker 运行（推荐）

```bash
# 克隆
git clone https://github.com/Chrischaan/MiniMaxMusic.git
cd MiniMaxMusic

# 构建镜像
docker build -t minimax-music .

# 启动容器（替换成你的 API Key）
docker run -d --name minimax-music \
  -p 8000:8000 \
  -e MINIMAX_API_KEY=sk-xxxxxx \
  minimax-music
```

打开 http://127.0.0.1:8000 即可使用。

### 方式 B：本地开发

**后端**

```bash
cd backend
cp .env.example .env     # 然后编辑 .env 填入 MINIMAX_API_KEY
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

**前端**（另开一个终端）

```bash
cd frontend
npm install
npm run dev              # 默认 http://localhost:5173
```

Vite 已配置把 `/api` 代理到 `http://127.0.0.1:8001`。

## 项目结构

```
MiniMaxMusic/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口 + CORS + 静态文件挂载
│   │   ├── config.py            # 加载 .env
│   │   ├── minimax_client.py    # 封装 MiniMax API 调用
│   │   ├── tasks.py             # 内存任务字典
│   │   └── routes/
│   │       ├── lyrics.py        # POST /api/lyrics
│   │       └── music.py         # 音乐生成 / 翻唱 / 下载路由
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.tsx              # 布局骨架 + 状态管理
│       ├── api.ts               # fetch 封装
│       ├── components/
│       │   ├── LyricsStep.tsx   # 歌词（手动 / AI）
│       │   ├── StyleStep.tsx    # 曲风标签 + 自定义
│       │   ├── CoverStep.tsx    # 翻唱参考音频（文件 / URL）
│       │   ├── CoverCropModal.tsx  # 封面裁剪对话框
│       │   └── Player.tsx       # 底部播放器
│       └── utils/cropImage.ts   # canvas 裁剪 → Blob
├── Dockerfile
└── MiniMax-Music-应用生成器.md  # 需求文档
```

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/lyrics` | AI 生成歌词（标题 / 曲风 / 正文） |
| `POST` | `/api/music` | 提交创作任务，返回 `task_id` |
| `POST` | `/api/cover` | 提交翻唱任务（multipart，文件或 URL） |
| `GET` | `/api/music/{task_id}` | 轮询任务状态 |
| `GET` | `/api/music/{task_id}/audio` | 获取音频流（支持 Range） |
| `POST` | `/api/music/{task_id}/download` | 下载打标签的 MP3（封面 + 歌词 + 标题） |
| `GET` | `/health` | 健康检查 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MINIMAX_API_KEY` | MiniMax 平台 API Key（必填） | — |
| `MINIMAX_BASE_URL` | API Base URL | `https://api.minimaxi.com` |

## 已知限制

- 任务状态存在内存字典，容器重启会丢
- 没有用户系统、没有历史记录
- 没接入 Redis / Celery，单实例部署即可

## License

MIT
