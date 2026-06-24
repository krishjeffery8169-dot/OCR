# 公司内部服务器部署说明

## 1. 推荐服务器

当前截题链路依赖 PowerShell 截题脚本，因此推荐使用 Windows Server。

最低配置建议：

```text
Windows Server 2019/2022
Node.js 20+
Git
Microsoft Edge
PowerShell 5 或 PowerShell 7
可访问模型 API 的内网/公网网络
```

## 2. 服务器准备

在服务器上创建目录：

```text
C:\tools\model-crop
D:\model-crop-runtime
```

把仓库代码拉到：

```powershell
git clone https://github.com/krishjeffery8169-dot/OCR.git C:\tools\model-crop
cd C:\tools\model-crop
git checkout model-crop-tool
```

安装依赖并构建：

```powershell
npm install
npm run build
```

## 3. 环境变量

复制 `.env.example` 为 `.env`：

```powershell
copy .env.example .env
```

重点确认：

```text
PORT=3001
HOST=0.0.0.0
CROP_SCRIPT_PATH=C:\tools\model-crop\scripts\docx_wordml_crop_generic.ps1
MODEL_CROP_RUNTIME_ROOT=D:\model-crop-runtime
```

`CROP_SCRIPT_PATH` 必须指向服务器上真实存在的 PowerShell 截题脚本。

## 4. 启动服务

临时启动：

```powershell
npm run start
```

浏览器访问：

```text
http://服务器IP:3001/model-crop
```

## 5. 长期运行

建议用以下任一方式守护进程：

```text
PM2
Windows 服务
IIS 反向代理 + Node 服务
公司内部容器平台
```

PM2 示例：

```powershell
npm install -g pm2
pm2 start npm --name model-crop -- run start
pm2 save
```

## 6. 网络与权限

需要开放服务器端口，例如 `3001`，或者通过公司网关绑定域名：

```text
http://题库截取工具.公司内网/model-crop
```

如果接入模型接口，服务器必须能访问对应模型服务地址。

## 7. 当前限制

- GitHub Pages 不能运行该工具，因为它需要 Node 后端。
- 若部署到 Linux，需要重写截题执行层，不能直接复用当前 PowerShell + WordML 脚本。
- 上传文件会保存到服务器临时目录，需按公司数据安全要求控制访问权限和清理策略。
