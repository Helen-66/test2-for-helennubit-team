# 宠物上门喂养小程序 - 项目说明

## 项目结构

```
pet-feeding-app/
├── server/                          # 后端服务 (NestJS + TypeScript + Prisma)
│   ├── prisma/
│   │   └── schema.prisma           # 数据库模型定义
│   ├── src/
│   │   ├── main.ts                 # 入口文件
│   │   ├── app.module.ts           # 主模块
│   │   ├── guards/                 # 鉴权守卫
│   │   ├── filters/                # 异常过滤器
│   │   ├── interceptors/           # 响应拦截器
│   │   └── modules/
│   │       ├── common/             # 公共模块(Prisma/Redis/微信)
│   │       ├── user/               # 用户模块(登录/注册)
│   │       ├── pet/                # 宠物管理模块
│   │       ├── sitter/             # 宠托师模块(认证/附近查询)
│   │       ├── order/              # 订单模块(CRUD/接单/签到/完成)
│   │       └── payment/            # 支付&结算模块(T+1打款)
│   ├── .env.example                # 环境变量示例
│   ├── package.json
│   └── tsconfig.json
├── miniapp/
│   ├── user-app/                   # 用户端小程序
│   │   ├── pages/
│   │   │   ├── index/             # 首页-附近宠托师列表
│   │   │   ├── sitter-detail/     # 宠托师详情
│   │   │   ├── order-create/      # 创建预约订单
│   │   │   ├── order-list/        # 订单列表
│   │   │   ├── pet-manage/        # 宠物管理
│   │   │   └── mine/              # 个人中心
│   │   └── utils/request.js       # 请求封装
│   └── sitter-app/                 # 宠托师端小程序
│       ├── pages/
│       │   ├── index/             # 工作台(接单/签到/完成)
│       │   ├── order-detail/      # 订单详情
│       │   ├── income/            # 收入明细
│       │   ├── mine/              # 个人中心
│       │   └── apply/             # 宠托师认证申请
│       └── utils/request.js       # 请求封装
```

## 快速开始

### 后端服务

```bash
cd server

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 3. 初始化数据库
npx prisma migrate dev --name init

# 4. 启动开发服务
npm run start:dev
```

### 小程序端

1. 使用微信开发者工具导入 `miniapp/user-app` 或 `miniapp/sitter-app`
2. 修改 `app.js` 中的 `baseUrl` 为实际后端地址
3. 在微信公众平台配置服务器域名白名单

## 核心功能

- 普通用户注册登录 + 宠物管理
- 基于Redis GEO的3公里范围宠托师查询
- 宠托师实名认证 + 在线接单
- 订单全生命周期管理(支付/接单/拒单/GPS签到/完成)
- T+1自动结算打款(定时任务 + 微信企业付款)
- Haversine公式GPS签到校验(500米范围)

## 部署须知

- Node.js >= 18
- MySQL 8.0
- Redis 7.x
- 需要微信支付商户号(企业付款到零钱功能)
- 需要腾讯地图API Key
