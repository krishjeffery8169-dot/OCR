# 模型理解题库截取网页工具

本项目是一个本地网页工具，用于上传 Word/PDF 题库、按题目裁切图片，并根据每批输入的维度说明调用模型进行结构化分类。

## 启动

Windows 下可双击：

```text
启动模型截题网页.bat
```

或手动运行：

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:5173/model-crop
```

## 当前能力

- 上传题库文件，当前优先支持 `.docx`
- 粘贴本批次维度说明，不需要提前写死学科规则
- 复用本地 WordML 截题脚本生成题目图片
- 支持 OpenAI-compatible 模型接口
- 不配置模型时仍可截题，分类标记为 `待确认`
- 输出图片、manifest 和 HTML 预览到本地目录

## 模型配置

页面里可填写：

```text
baseUrl
model
API Key
是否发送题图给视觉模型
```

API Key 只用于本地请求，不会写入导出结果包。
