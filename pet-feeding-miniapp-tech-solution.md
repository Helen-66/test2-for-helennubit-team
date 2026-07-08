# 宠物上门喂养小程序 - 技术方案

## 一、技术架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    客户端层                               │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ 用户端小程序   │  │ 宠托师端小程序  │  │ 管理后台Web │ │
│  │  (微信小程序)  │  │  (微信小程序)   │  │  (Vue3)     │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    网关层                                 │
│              Nginx + API Gateway                         │
│         (限流、鉴权、路由、日志)                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    服务层                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │用户服务   │ │订单服务   │ │支付服务   │ │定位服务   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │消息服务   │ │结算服务   │ │文件服务   │ │审核服务   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    数据层                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────────┐ │
│  │ MySQL  │  │ Redis  │  │  OSS   │  │ Elasticsearch│ │
│  └────────┘  └────────┘  └────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 二、技术选型

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端-小程序 | 微信原生 / Taro 3 + React | 跨端兼容，支持后续扩展H5 |
| 前端-管理后台 | Vue3 + Element Plus + Vite | 快速开发管理界面 |
| 后端框架 | Java SpringBoot 3 / Node.js (Nest.js) | 企业级稳定方案 |
| 数据库 | MySQL 8.0 | 主数据存储 |
| 缓存 | Redis 7 | 会话、热点数据、地理位置索引 |
| 消息队列 | RabbitMQ / RocketMQ | 订单状态流转、延迟打款任务 |
| 对象存储 | 阿里云OSS / 腾讯云COS | 图片视频存储 |
| 地图服务 | 腾讯地图SDK（微信生态优先） | LBS定位与距离计算 |
| 支付 | 微信支付 | 用户付款 + 企业付款到零钱 |
| 定时任务 | XXL-Job / node-cron | T+1打款调度 |
| 部署 | Docker + 云服务器(2C4G起) | 容器化部署 |

---

## 三、数据库设计

### 3.1 核心表结构

```sql
-- 用户表
CREATE TABLE `user` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `openid` VARCHAR(64) NOT NULL UNIQUE COMMENT '微信openid',
  `unionid` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `nickname` VARCHAR(64) DEFAULT NULL,
  `avatar_url` VARCHAR(512) DEFAULT NULL,
  `role` TINYINT NOT NULL DEFAULT 1 COMMENT '1-普通用户 2-宠托师 3-双重身份',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常 0-封禁',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 宠托师信息表
CREATE TABLE `pet_sitter` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL UNIQUE,
  `real_name` VARCHAR(32) NOT NULL COMMENT '真实姓名',
  `id_card_no` VARCHAR(64) NOT NULL COMMENT '身份证号(加密存储)',
  `id_card_front` VARCHAR(512) NOT NULL COMMENT '身份证正面照',
  `id_card_back` VARCHAR(512) NOT NULL COMMENT '身份证背面照',
  `id_card_hold` VARCHAR(512) NOT NULL COMMENT '手持身份证照',
  `cert_images` JSON DEFAULT NULL COMMENT '资质证书图片',
  `longitude` DECIMAL(10,7) NOT NULL COMMENT '服务点经度',
  `latitude` DECIMAL(10,7) NOT NULL COMMENT '服务点纬度',
  `address` VARCHAR(256) NOT NULL COMMENT '服务地址',
  `service_radius` INT NOT NULL DEFAULT 3000 COMMENT '服务半径(米)',
  `service_items` JSON NOT NULL COMMENT '服务项目及价格',
  `available_time` JSON DEFAULT NULL COMMENT '可服务时段',
  `is_online` TINYINT NOT NULL DEFAULT 0 COMMENT '0-离线 1-在线',
  `audit_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-待审核 1-通过 2-驳回',
  `audit_remark` VARCHAR(256) DEFAULT NULL,
  `rating` DECIMAL(2,1) NOT NULL DEFAULT 5.0 COMMENT '评分',
  `order_count` INT NOT NULL DEFAULT 0 COMMENT '完成订单数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_location` (`longitude`, `latitude`),
  INDEX `idx_audit_status` (`audit_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 宠物表
CREATE TABLE `pet` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(32) NOT NULL,
  `species` VARCHAR(16) NOT NULL COMMENT '物种：猫/狗/其他',
  `breed` VARCHAR(32) DEFAULT NULL COMMENT '品种',
  `weight` DECIMAL(4,1) DEFAULT NULL COMMENT '体重(kg)',
  `age` VARCHAR(16) DEFAULT NULL COMMENT '年龄',
  `gender` TINYINT DEFAULT NULL COMMENT '1-公 2-母',
  `character_desc` VARCHAR(256) DEFAULT NULL COMMENT '性格描述',
  `feeding_notes` TEXT DEFAULT NULL COMMENT '喂养注意事项',
  `photos` JSON DEFAULT NULL COMMENT '宠物照片',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单表
CREATE TABLE `order` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '订单编号',
  `user_id` BIGINT NOT NULL,
  `sitter_id` BIGINT NOT NULL COMMENT '宠托师ID(pet_sitter.id)',
  `pet_ids` JSON NOT NULL COMMENT '关联宠物ID列表',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-待支付 1-待接单 2-已接单 3-服务中 4-已完成 5-已取消 6-已拒单',
  `service_date_start` DATE NOT NULL COMMENT '服务开始日期',
  `service_date_end` DATE NOT NULL COMMENT '服务结束日期',
  `daily_times` TINYINT NOT NULL DEFAULT 1 COMMENT '每日喂养次数',
  `service_items` JSON NOT NULL COMMENT '服务内容',
  `service_address` VARCHAR(256) NOT NULL,
  `address_lng` DECIMAL(10,7) NOT NULL,
  `address_lat` DECIMAL(10,7) NOT NULL,
  `total_amount` DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  `platform_fee` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '平台服务费',
  `sitter_income` DECIMAL(10,2) NOT NULL COMMENT '宠托师收入',
  `remark` VARCHAR(512) DEFAULT NULL COMMENT '用户备注',
  `reject_reason` VARCHAR(256) DEFAULT NULL COMMENT '拒单原因',
  `cancel_reason` VARCHAR(256) DEFAULT NULL COMMENT '取消原因',
  `sign_in_time` DATETIME DEFAULT NULL COMMENT '签到时间',
  `sign_in_lng` DECIMAL(10,7) DEFAULT NULL,
  `sign_in_lat` DECIMAL(10,7) DEFAULT NULL,
  `complete_time` DATETIME DEFAULT NULL COMMENT '完成时间',
  `settle_time` DATETIME DEFAULT NULL COMMENT '结算时间',
  `settle_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-未结算 1-结算中 2-已结算 3-结算失败',
  `paid_at` DATETIME DEFAULT NULL COMMENT '支付时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_sitter_id` (`sitter_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_settle` (`settle_status`, `complete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支付记录表
CREATE TABLE `payment` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `transaction_id` VARCHAR(64) DEFAULT NULL COMMENT '微信支付交易号',
  `amount` DECIMAL(10,2) NOT NULL,
  `type` TINYINT NOT NULL COMMENT '1-用户支付 2-退款 3-打款给宠托师',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-处理中 1-成功 2-失败',
  `pay_time` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评价表
CREATE TABLE `review` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL UNIQUE,
  `user_id` BIGINT NOT NULL,
  `sitter_id` BIGINT NOT NULL,
  `rating` TINYINT NOT NULL COMMENT '1-5分',
  `content` VARCHAR(512) DEFAULT NULL,
  `images` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sitter_id` (`sitter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.2 Redis数据结构

```
# 宠托师地理位置索引 (GEO)
GEOADD pet_sitter:geo <lng> <lat> <sitter_id>

# 宠托师在线状态
SET sitter:online:<sitter_id> 1 EX 300

# 用户登录Token
SET token:<token> <user_json> EX 7200

# 订单防重复提交
SET order:lock:<user_id> 1 EX 10
```

---

## 四、核心接口设计

### 4.1 用户端API

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 微信登录 | POST | /api/user/login | code换取session |
| 绑定手机号 | POST | /api/user/bindPhone | 获取手机号 |
| 附近宠托师 | GET | /api/sitter/nearby?lng=&lat=&radius=3000 | 3km范围查询 |
| 宠托师详情 | GET | /api/sitter/:id | 详情+评价 |
| 创建订单 | POST | /api/order/create | 创建预约订单 |
| 支付订单 | POST | /api/order/pay | 拉起微信支付 |
| 取消订单 | POST | /api/order/cancel | 取消 |
| 订单列表 | GET | /api/order/list | 用户订单列表 |
| 提交评价 | POST | /api/review/create | 评价宠托师 |

### 4.2 宠托师端API

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 提交认证 | POST | /api/sitter/apply | 实名+资质 |
| 待接订单 | GET | /api/sitter/orders/pending | 待处理订单 |
| 接单 | POST | /api/sitter/order/accept | 接受订单 |
| 拒单 | POST | /api/sitter/order/reject | 拒绝+原因 |
| 签到 | POST | /api/sitter/order/signin | GPS校验签到 |
| 完成订单 | POST | /api/sitter/order/complete | 提交完成 |
| 收入明细 | GET | /api/sitter/income | 收入列表 |
| 上下线 | POST | /api/sitter/online | 切换状态 |

---

## 五、核心逻辑实现方案

### 5.1 附近3公里宠托师查询

使用Redis GEO实现高效地理位置查询：

```java
// 方案1：Redis GEO (推荐，性能优)
public List<PetSitter> findNearbySitters(double lng, double lat, int radiusMeters) {
    // 1. Redis GEORADIUS查询范围内宠托师ID
    GeoResults<RedisGeoCommands.GeoLocation<String>> results =
        redisTemplate.opsForGeo().radius("pet_sitter:geo",
            new Circle(new Point(lng, lat), new Distance(radiusMeters, Metrics.METERS)),
            RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs()
                .includeDistance().sortAscending().limit(50));

    // 2. 过滤在线且已认证的宠托师
    List<Long> sitterIds = extractIds(results);
    return petSitterMapper.selectOnlineSitters(sitterIds);
}
```

```sql
-- 方案2：MySQL空间查询 (备选)
SELECT *, ST_Distance_Sphere(
    POINT(longitude, latitude),
    POINT(#{lng}, #{lat})
) AS distance
FROM pet_sitter
WHERE audit_status = 1 AND is_online = 1
HAVING distance <= 3000
ORDER BY distance ASC;
```

### 5.2 GPS签到校验

```java
public boolean verifySignIn(Long orderId, double signLng, double signLat) {
    Order order = orderMapper.selectById(orderId);
    // 计算签到位置与服务地址的距离
    double distance = GeoUtils.getDistance(
        signLng, signLat,
        order.getAddressLng(), order.getAddressLat()
    );
    // 500米范围内允许签到
    return distance <= 500;
}
```

### 5.3 T+1自动打款

```java
// 定时任务：每小时执行一次，查询需要打款的订单
@Scheduled(cron = "0 0 * * * ?")
public void autoSettlement() {
    // 查询完成时间超过24小时且未结算的订单
    LocalDateTime threshold = LocalDateTime.now().minusHours(24);
    List<Order> orders = orderMapper.selectSettleable(threshold);

    for (Order order : orders) {
        try {
            // 1. 更新结算状态为处理中
            orderMapper.updateSettleStatus(order.getId(), SettleStatus.PROCESSING);
            // 2. 调用微信企业付款接口
            WxPayResult result = wxPayService.transferToUser(
                order.getSitterOpenid(),
                order.getSitterIncome(),
                order.getOrderNo()
            );
            // 3. 记录支付流水
            paymentService.createSettleRecord(order, result);
            // 4. 更新结算状态
            orderMapper.updateSettleStatus(order.getId(), SettleStatus.SETTLED);
        } catch (Exception e) {
            // 结算失败，标记后人工处理
            orderMapper.updateSettleStatus(order.getId(), SettleStatus.FAILED);
            alertService.notify("结算失败: " + order.getOrderNo());
        }
    }
}
```

### 5.4 订单状态流转（状态机）

```java
public enum OrderEvent {
    PAY,        // 支付
    ACCEPT,     // 接单
    REJECT,     // 拒单
    SIGN_IN,    // 签到
    COMPLETE,   // 完成
    CANCEL,     // 取消
    SETTLE      // 结算
}

// 状态流转规则
Map<OrderStatus, Map<OrderEvent, OrderStatus>> transitions = Map.of(
    UNPAID, Map.of(PAY, PENDING, CANCEL, CANCELLED),
    PENDING, Map.of(ACCEPT, ACCEPTED, REJECT, REJECTED, CANCEL, CANCELLED),
    ACCEPTED, Map.of(SIGN_IN, IN_SERVICE),
    IN_SERVICE, Map.of(COMPLETE, COMPLETED),
    COMPLETED, Map.of(SETTLE, SETTLED)
);
```

---

## 六、安全方案

| 安全项 | 措施 |
|--------|------|
| 接口鉴权 | JWT Token + 微信session_key校验 |
| 数据加密 | 身份证号AES加密存储，传输HTTPS |
| 防刷 | 接口限流(令牌桶)，验证码，设备指纹 |
| 支付安全 | 微信支付签名校验，金额二次确认 |
| SQL注入 | 参数化查询，MyBatis #{} |
| XSS | 输入过滤 + 输出转义 |
| 隐私保护 | 虚拟号码通话，地址模糊展示 |

---

## 七、部署方案

### 7.1 最小化部署（初期）

```
云服务器: 2C4G × 1台 (约 ¥200/月)
├── Docker容器
│   ├── Nginx (反向代理 + 静态资源)
│   ├── 后端服务 (SpringBoot JAR / Node.js)
│   ├── MySQL 8.0
│   ├── Redis 7
│   └── RabbitMQ
├── 对象存储: 腾讯云COS (按量付费)
├── 域名 + SSL证书 (免费)
└── 微信支付商户号
```

### 7.2 扩展部署（增长期）

```
├── 负载均衡 (SLB)
├── 应用服务器 × 2+ (水平扩展)
├── MySQL 主从读写分离
├── Redis 哨兵/集群
├── CDN (图片加速)
└── 日志服务 (ELK / 云日志)
```

---

## 八、项目排期估算

| 阶段 | 内容 | 工期 |
|------|------|------|
| 第1周 | 需求评审 + UI设计 + 数据库设计 | 5天 |
| 第2-3周 | 后端核心接口开发(用户/订单/支付) | 10天 |
| 第3-4周 | 小程序端开发(用户端+宠托师端) | 10天 |
| 第5周 | 管理后台开发 | 5天 |
| 第6周 | 联调 + 测试 + Bug修复 | 5天 |
| 第7周 | 微信审核 + 上线 | 3-5天 |

**总计：约6-7周（1人全栈）/ 3-4周（前后端各1人）**

---

## 九、成本预估

| 项目 | 费用（月） |
|------|-----------|
| 云服务器 2C4G | ¥150-300 |
| 对象存储 | ¥10-50 |
| 短信验证码 | ¥50-100 |
| 腾讯地图API | 免费(日调用<10000) |
| 微信支付手续费 | 0.6% |
| 域名 + SSL | ¥50/年 |
| **合计（初期月）** | **¥300-500** |

---

## 十、风险与应对

| 风险 | 应对策略 |
|------|---------|
| 宠托师供给不足 | 初期聚焦1-2个城市，补贴拉新 |
| 服务纠纷 | 全程照片/视频留痕，平台仲裁机制 |
| 安全问题 | 实名认证 + 紧急联系人 + 服务保险 |
| 打款失败 | 失败自动重试3次，人工兜底 |
| 恶意刷单 | 设备指纹 + 行为分析 + 人工审核 |
