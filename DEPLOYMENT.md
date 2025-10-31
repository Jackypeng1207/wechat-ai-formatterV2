# Vercel 部署指南

## 项目概述
这是一个纯前端项目，包含公众号爆款内容架构师功能，支持智能对话生成和多种排版模板。

## 部署步骤

### 方法一：通过Vercel CLI部署

1. **安装Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   cd "/Volumes/San Disk/AI编程项目/公众号自动排版器"
   vercel --prod
   ```

### 方法二：通过GitHub部署

1. **创建GitHub仓库**
   - 在GitHub上创建新仓库
   - 将项目文件推送到仓库

2. **连接Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用GitHub账号登录
   - 点击"New Project"
   - 选择您的GitHub仓库
   - 保持默认设置，点击"Deploy"

### 方法三：直接拖拽部署

1. **访问Vercel控制台**
   - 登录 [vercel.com](https://vercel.com)
   - 点击"New Project"

2. **上传项目**
   - 选择"Drag & Drop"选项
   - 将整个项目文件夹拖拽到上传区域
   - 等待部署完成

## 项目结构说明

```
公众号自动排版器/
├── new-layout.html          # 主功能页面（公众号爆款内容架构师）
├── index.html               # 基础排版器页面
├── app.js                   # 核心JavaScript逻辑
├── package.json             # 项目配置（已创建）
├── vercel.json              # Vercel部署配置（已创建）
├── README.md                # 项目说明
└── template_*.html          # 各种排版模板
```

## 部署注意事项

### API密钥配置
由于安全考虑，API密钥需要在部署后手动配置：

1. 在Vercel项目设置中，找到"Environment Variables"
2. 添加以下环境变量：
   - `VITE_API_KEY`: 您的AI API密钥
   - `VITE_API_PROVIDER`: API提供商（如：siliconflow）

### 自定义域名（可选）
如果需要自定义域名：

1. 在Vercel项目设置中，选择"Domains"
2. 添加您的自定义域名
3. 按照提示配置DNS记录

## 功能验证

部署完成后，请测试以下功能：

1. **主功能页面**：访问 `https://your-domain.vercel.app/new-layout.html`
2. **公众号爆款内容架构师**：测试双路径工作流
3. **智能对话生成**：验证AI对话功能
4. **排版预览**：检查实时预览效果

## 故障排除

### 常见问题

1. **部署失败**
   - 检查package.json格式是否正确
   - 确认所有文件路径正确

2. **页面无法访问**
   - 检查vercel.json路由配置
   - 确认入口文件设置正确

3. **API功能异常**
   - 验证环境变量配置
   - 检查API密钥有效性

### 技术支持
如有问题，请参考：
- [Vercel官方文档](https://vercel.com/docs)
- 项目README.md文件

## 更新部署

当项目有更新时，只需重新推送代码到GitHub，Vercel会自动重新部署。

---

**部署状态**：✅ 配置文件已准备就绪
**下一步**：按照上述步骤完成Vercel部署