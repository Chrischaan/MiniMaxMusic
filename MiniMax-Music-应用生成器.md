---
created: 2026-04-14
status: pending
source: start-my-day
---

# MiniMax Music 应用生成器 — 需求文档

## 项目概述

基于 MiniMax Music 2.6 API 构建一个 AI 音乐生成 Web 应用。用户可以输入或 AI 生成歌词，选择曲风，一键生成歌曲，并在线播放和下载。

---

## API 说明

### 歌词生成
```
POST https://api.minimaxi.com/v1/lyrics_generation
入参：{ "mode": "write_full_song", "prompt": "一首关于夏日海边的轻快情歌" }
返参：{ "song_title": "...", "style_tags": "Mandopop, Summer...", "lyrics": "[Verse]\n..." }
```

### 音乐生成
```
POST https://api.minimaxi.com/v1/music_generation
入参：{
  "model": "music-2.6",
  "prompt": "独立民谣,忧郁,内省",       ← 曲风描述
  "lyrics": "[verse]\n歌词内容...",      ← 带结构标签的歌词
  "audio_setting": { "sample_rate": 44100, "bitrate": 256000, "format": "mp3" }
}
返参：{ "data": { "audio": "hex编码音频数据" } }
```

> [!warning] 技术注意
> 音频以 hex 编码返回，必须在后端解码为二进制再返给前端。
> API Key 不可暴露在前端，需要后端代理。

---

## 功能需求

### 页面整体布局（单页应用）

```
┌─────────────────────────────────────────┐
│           🎵 AI 音乐生成器               │
├─────────────┬───────────────────────────┤
│             │                           │
│  Step 1     │   歌词区域                │
│  歌词       │   [手动输入] [AI生成]      │
│             │                           │
├─────────────┤                           │
│             │                           │
│  Step 2     │   曲风选择区域             │
│  曲风       │                           │
│             │                           │
├─────────────┤                           │
│  Step 3     │   [ 🎵 生成歌曲 ]         │
│  生成       │                           │
├─────────────┴───────────────────────────┤
│              播放器区域                  │
│  ▶ ━━━━━━━━━━━━○━━━  02:14  [⬇ 下载]  │
└─────────────────────────────────────────┘
```

---

### Step 1：歌词区域

**两种模式，Tab 切换：**

**① 手动输入**
- 多行文本框，placeholder 提示歌词结构：
  ```
  [verse]
  在这里输入主歌歌词...

  [chorus]
  在这里输入副歌歌词...
  ```
- 字数限制提示（API 有限制）

**② AI 生成歌词**
- 输入框：描述歌曲主题（如"一首关于离别的伤感慢歌"）
- 按钮：`生成歌词`
- 调用 `/api/lyrics` 接口
- 生成后：
  - 显示歌曲标题和曲风标签（只读展示）
  - 歌词填入可编辑文本框（用户可二次修改）
  - 曲风标签自动同步到 Step 2 的输入框

---

### Step 2：曲风选择

**预设标签（可多选点击）：**

| 情绪 | 风格 | 场景 |
|------|------|------|
| 忧郁 | 民谣 | 咖啡馆 |
| 欢快 | 流行 | 夏日 |
| 浪漫 | R&B | 雨天 |
| 治愈 | 古风 | 夜晚 |
| 燃情 | 摇滚 | 旅途 |

- 点击标签自动追加到输入框
- **自定义输入框**：可手动输入任意关键词，逗号分隔
- 最终发给 API 的 prompt = 所有选中标签 + 自定义输入，逗号拼接

---

### Step 3：生成按钮

- 按钮文字：`🎵 生成歌曲`
- 点击校验：歌词不能为空
- 生成中状态：按钮禁用 + loading 动画 + 提示文字"生成中，约需 30 秒..."
- 错误处理：弹出错误提示（如 API 限流、歌词格式问题）

---

### 播放器区域（生成后显示）

- 歌曲标题（来自歌词生成时的 song_title，或默认"我的歌曲"）
- 播放/暂停按钮
- 进度条（可拖拽）
- 当前时间 / 总时长
- 下载按钮 → 下载 mp3 文件，文件名为歌曲标题

---

## 技术方案

### 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React + TypeScript | 组件化，状态管理 |
| 后端 | Python FastAPI | 代理 MiniMax API，处理 hex 解码 |
| 样式 | Tailwind CSS | 快速布局 |

### 后端接口设计

```
POST /api/lyrics
  入参：{ "prompt": "..." }
  出参：{ "title": "...", "style_tags": "...", "lyrics": "..." }

POST /api/music
  入参：{ "prompt": "曲风描述", "lyrics": "歌词内容" }
  出参：音频文件流（mp3）或 { "audio_url": "临时链接" }
  处理：hex 解码 → 返回 audio/mpeg 二进制流
```

### hex 解码逻辑（后端）
```python
audio_hex = response["data"]["audio"]
audio_bytes = bytes.fromhex(audio_hex)
# 返回给前端
return Response(content=audio_bytes, media_type="audio/mpeg")
```

---

## 开发计划

- [ ] Phase 1：后端 FastAPI 搭建，两个代理接口跑通
- [ ] Phase 2：前端基础页面，歌词手动输入 + 生成按钮
- [ ] Phase 3：AI 歌词生成功能
- [ ] Phase 4：播放器 + 下载功能
- [ ] Phase 5：曲风标签选择，UI 打磨

---

## 参考链接

- [音乐生成 API](https://platform.minimaxi.com/docs/api-reference/music-generation)
- [歌词生成 API](https://platform.minimaxi.com/docs/api-reference/lyrics-generation)
