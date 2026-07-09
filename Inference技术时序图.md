# Inference 核心技术时序图汇总

## 核心架构概览

Infer Inference Node 是**无状态推理网关**，运行在 `DEPLOY_MODE=inference` 模式下：

- ✅ 内嵌 LiteLLM 库处理推理
- ✅ 只读 PG（读副本）
- ✅ 使用量事件通过 Redis Streams 发送到控制平面
- ✅ 支持多区域部署，每个区域独立 Redis 实例
- ✅ 优雅关闭，支持长连接排水

---

## 图 1: 基础推理请求流程 (Request Lifecycle)

**关键点：**
- 请求验证 → 预算检查 → 插件钩子 → LLM 调用 → 异步计费
- 预算检查使用 PG 读副本（8-10 秒陈旧性）
- 响应返回后，异步进行成本计算和计费记录

```mermaid
sequenceDiagram
    autonumber

    participant Client as 🔗 SDK/API<br/>Client
    participant LB as ⚡ Load<br/>Balancer
    participant Inf as 🎯 Inference<br/>Node
    participant Cache as 💾 Key Cache<br/>~1s/~60s
    participant Auth as 🔑 JWT Auth<br/>Handler
    participant Budget as 💰 Budget<br/>Read Replica
    participant LLM as 🤖 LLM<br/>Provider
    participant Async as ⏱️ Async<br/>Callback

    Client->>LB: POST /chat/completions
    LB->>Inf: ① Route request
    
    Inf->>Cache: ② Check cache
    Cache-->>Inf: Cache hit/miss
    
    Inf->>Auth: ③ Validate JWT
    Auth-->>Inf: ✓ JWT claims
    
    Inf->>Budget: ④ Read budget<br/>PG_ReadReplica
    Budget-->>Inf: spend + limit
    
    alt Budget OK
        Inf->>Inf: ⑤ Pre-flight checks
        Inf->>LLM: ⑥ Forward request
        LLM-->>Inf: Response + tokens
        Inf-->>Client: ⑦ Return response
        Inf->>Async: ⑧ Enqueue cost calc
    else Budget Exceeded
        Inf-->>Client: 402 Payment Required
    end
    
    Note over Async: Non-blocking<br/>Parallel execution
```

---

## 图 2: 使用量计费同步流程 (Billing Pipeline)

**关键点：**
- Inference 计算成本 → Redis Streams 发送 → Control 平面批量处理 → PG 原子写入
- 去重机制：`usage_event_id`
- 批处理大小：50 条记录
- 从 1M DAU (~50M 请求/天) 时，减少 PG 负载从 580 tx/s → 12 tx/s

```mermaid
sequenceDiagram
    autonumber

    participant Inf as 🎯 Inference<br/>Multi-Region
    participant LiteLLM as 📊 LiteLLM<br/>Cost Tracker
    participant SpendSync as 💾 Spend Sync<br/>Callback
    participant Redis as 📮 Redis Streams<br/>infer:usage:{region}
    participant CP as 🎮 Control Plane<br/>billing-workers
    participant PG as 🗄️ PG Primary
    participant Rep as 🔄 PG Replica

    Inf->>LiteLLM: Response ready
    LiteLLM-->>LiteLLM: Calculate cost<br/>(tokens × price)
    
    LiteLLM->>SpendSync: ① Trigger callback
    SpendSync-->>SpendSync: Build UsageEvent<br/>{team_id, tokens, cost,<br/>request_id, timestamp}
    
    SpendSync->>Redis: ② XADD usage event<br/>(fire-and-forget)
    
    Note over Redis: At-least-once guarantee
    
    CP->>Redis: ③ XREADGROUP count=50<br/>batch consumption
    Redis-->>CP: Deliver batch
    
    CP-->>CP: ④ Deduplicate<br/>by request_id
    
    Note over CP,PG: Single Atomic Transaction
    CP->>PG: ⑤ BEGIN
    CP->>PG: ⑥ INSERT billing_usage<br/>(50 records)
    CP->>PG: ⑦ INSERT billing_ledger
    CP->>PG: ⑧ UPDATE spend<br/>billing_accounts
    CP->>PG: ⑨ UPDATE spend<br/>LiteLLM_TeamTable
    CP->>PG: ⑩ COMMIT
    
    CP->>Redis: ⑪ XACK processed
    
    PG-.->Rep: Replication lag<br/>~1-2 seconds
    
    Note over Rep: Next request<br/>reads from replica
```

---

## 图 3: 单节点部署流程 (Standalone Mode)

**配置：** `DEPLOY_MODE=standalone`

**特点：**
- 两个子进程：Control + Inference
- 共享 PG primary + 一个 Redis 实例
- 本地开发/测试/IDC 部署
- 数据流与多区域相同

```mermaid
sequenceDiagram
    autonumber

    participant User as 👤 User
    participant WR as 🌐 world-router<br/>Next.js :3001
    participant Ctrl as 🎮 Control<br/>subprocess
    participant Inf as 🎯 Inference<br/>subprocess
    participant PG as 🗄️ PostgreSQL
    participant Redis as 📮 Redis
    participant LLM as 🤖 LLM

    Note over Ctrl,Inf: Shared PG + Redis<br/>No network partition

    User->>WR: Dashboard :3001
    WR->>Ctrl: /platform/v1/* API
    Ctrl->>PG: Query teams/billing
    PG-->>Ctrl: Data
    Ctrl-->>WR: Response
    WR-->>User: Dashboard HTML

    User->>Inf: LLM request w/ API key
    Inf->>PG: SELECT budget (read)
    PG-->>Inf: spend + limit
    Inf->>LLM: Forward request
    LLM-->>Inf: Response
    Inf-->>User: Return response

    par Async Billing
        Inf->>Redis: XADD usage event
        Ctrl->>Redis: XREADGROUP batch
        Ctrl->>PG: Transaction:INSERT+UPDATE
        PG-->>Ctrl: ✓ Committed
    end
```

---

## 图 4: 多区域部署流程 (Multi-Region)

**架构：**
- 全局网关 → 多个区域 (us-east-1, ap-southeast-1, ...)
- 每个区域：Inference 节点 + 本地 Redis
- 中央：Control 平面 + 主 PG
- 跨区域通过 CEN/VPN 连接

```mermaid
sequenceDiagram
    autonumber

    participant Client as 🌍 Global<br/>Client
    participant GW as 🌐 Global<br/>Gateway
    participant Inf1 as 🎯 Inf us-east<br/>:3101
    participant Inf2 as 🎯 Inf ap-se<br/>:3102
    participant R1 as 📮 Redis<br/>us-east
    participant R2 as 📮 Redis<br/>ap-se
    participant Ctrl as 🎮 Control<br/>CEN/VPN
    participant PG as 🗄️ PG Central

    Client->>GW: LLM request
    GW->>Inf1: Route us-east-1
    Inf1->>PG: SELECT budget (replica)
    PG-->>Inf1: Response
    Inf1->>Client: ① Return response
    Inf1->>R1: XADD usage
    
    par Other Region
        Client->>GW: Another request
        GW->>Inf2: Route ap-southeast-1
        Inf2->>Inf2: Process
        Inf2->>R2: XADD usage
    end
    
    Ctrl->>R1: XREADGROUP us-east
    R1-->>Ctrl: Batch from region 1
    
    Ctrl->>R2: XREADGROUP ap-se
    R2-->>Ctrl: Batch from region 2
    
    Ctrl->>PG: ② Consolidated TX
    Ctrl->>PG: INSERT all (deduplicate)
    Ctrl->>PG: UPDATE spend
    PG-->>Ctrl: ✓ Committed
    
    Ctrl->>R1: XACK region 1
    Ctrl->>R2: XACK region 2
```

---

## 图 5: 请求/响应归档流程 (S3 Archival)

**设计：**
- 全请求/响应保存到对象存储
- SpendLog 只保存元数据（token 计数、成本、模型）
- 通过 `request_id` 关联
- S3Logger 批处理，异步非阻塞

```mermaid
sequenceDiagram
    autonumber

    participant Inf as 🎯 Inference
    participant LLM as 🤖 LLM
    participant Buf as 💾 Buffer<br/>S3Logger
    participant S3 as ☁️ Object Store<br/>OSS/R2
    participant PG as 🗄️ Ledger

    Inf->>LLM: Request
    LLM-->>Inf: Response
    
    Inf->>Buf: Append {req, resp, meta}
    Note over Buf: Accumulate<br/>size/time trigger
    
    par Response Path
        Inf-->>Inf: Return to client
        Buf->>Buf: Check batch ready?
        alt Ready (e.g., 1000 records)
            Buf->>S3: Upload JSON<br/>s3://.../region=.../date=.../hour=.../
        else Not ready
            Buf->>Buf: Keep buffering
        end
    end
    
    Inf->>PG: Write SpendLog<br/>(metadata only)
    PG-->>Inf: ✓ Inserted
    
    Note over PG,S3: request_id in both<br/>for correlation
```

---

## 图 6: 优雅关闭流程 (Graceful Drain)

**场景：** K8s 滚动更新

**超时设置：**
- `terminationGracePeriodSeconds: 90s`
- 硬超时：75s（留 15s 清理）
- 轮询间隔：1s

```mermaid
sequenceDiagram
    autonumber

    participant K8s as ☸️ Kubernetes
    participant Pod as 📦 Pod
    participant Handler as 🛑 Shutdown<br/>Handler
    participant Middleware as 🔍 In-Flight<br/>Middleware
    participant Res as 🧹 Cleanup

    K8s->>Pod: SIGTERM (update)
    Pod->>Pod: Remove from endpoints
    
    Handler->>Handler: Start drain
    
    loop Poll every 1s
        Handler->>Middleware: GET /health/backlog
        Middleware-->>Handler: in_flight_count = N
        
        alt N == 0
            Handler->>Res: Complete ✓
            Handler->>Res: Close DB/Redis
            Res-->>Pod: Done
            Pod->>K8s: Exit(0)
        else N > 0 & elapsed < 75s
            Handler-->>Handler: Wait, retry
        else elapsed ≥ 75s
            Pod->>K8s: Hard exit
        end
    end
    
    Note over K8s: Covers longest<br/>response (~60s)
    Note over K8s: + buffer
```

---

## 图 7: 预算检查与拒绝 (Budget Enforcement)

**双层检查：**
1. Inference 节点本地快速检查（使用缓存）
2. LiteLLM 再次检查（fresh read）

**陈旧性：** ~8-10 秒（最坏情况）

```mermaid
sequenceDiagram
    autonumber

    participant Client as 🔗 Client
    participant Inf as 🎯 Inference
    participant Cache as 💾 Cache
    participant Rep as 🔄 Replica
    participant LiteLLM as 📊 LiteLLM

    Client->>Inf: POST /chat/completions
    
    Inf->>Cache: Check {team_id, spend}
    
    alt Cache HIT (~1s hot)
        Cache-->>Inf: {team_id, spend, max_budget}
    else Cache MISS
        Inf->>Rep: SELECT spend, max_budget
        Rep-->>Inf: Fresh values
        Inf->>Cache: Update cache (~60s main)
    end
    
    Inf-->>Inf: if spend ≥ max_budget?
    
    alt Exceeded
        Inf-->>Client: 🚫 402
    else OK
        Inf->>LiteLLM: Forward request
        LiteLLM-->>LiteLLM: common_checks()
        LiteLLM->>Rep: Fresh check
        
        alt Still Exceeded
            LiteLLM-->>Inf: 402
            Inf-->>Client: 402
        else Still OK
            LiteLLM->>LiteLLM: Call provider
        end
    end
    
    Note over Inf: Staleness ~8-10s<br/>stream lag + replica lag
```

---

## 图 8: 插件集成流程 (Plugin Pre-Call)

**钩子：** `async_pre_call_deployment_hook`

**用途：**
- 成本估算注入
- 令牌计数预测
- 自定义请求增强

```mermaid
sequenceDiagram
    autonumber

    participant Inf as 🎯 Inference
    participant Queue as 📋 Hook Queue
    participant Plugin as 🔌 User Plugin<br/>async_pre_call
    participant LLM as 🤖 LLM

    Inf->>Inf: Parse request
    
    Inf->>Queue: Enqueue pre-call hook
    Queue->>Plugin: Invoke with<br/>{request, model, team_id, ...}
    
    Plugin-->>Plugin: Custom logic<br/>e.g., estimate cost
    Plugin-->>Queue: Return augmented<br/>{request, est_tokens, cost}
    
    Queue-->>Inf: Plugin result
    
    Inf-->>Inf: Merge augmented data
    Inf->>LLM: Forward to provider
    LLM-->>Inf: Response
    
    Note over Inf: Later: post-call hooks<br/>async_post_call_failure_hook
```

---

## 关键指标与SLA

| 指标 | 值 | 说明 |
|------|-----|------|
| **预算陈旧性** | 8-10s | 最坏情况（流阻塞 + 副本延迟） |
| **缓存热期** | ~1s | 内存缓存（key/model） |
| **缓存冷期** | ~60s | 主缓存 |
| **副本延迟** | 1-2s | PG 流式复制 |
| **批处理大小** | 50 条 | 每个 XREADGROUP 拉取 |
| **吞吐量** | 12 tx/s | 50M 请求/天 的 PG 负载 |
| **优雅关闭** | 90s | `terminationGracePeriodSeconds` |
| **硬关闭** | 75s | 超时后强制退出 |
| **轮询间隔** | 1s | 检查 in-flight 计数 |

---

## 部署模式对比

| 维度 | Inference | Control |
|------|-----------|---------|
| **LiteLLM** | ✅ 内嵌 | ❌ 无 |
| **PG 访问** | 读副本只读 | 主库读写 |
| **Redis** | 生产者 (XADD) | 消费者 (XREADGROUP) |
| **计费写入** | 无 | UsageStreamConsumer |
| **Dashboard** | 无 | ✅ 有 |
| **可扩展性** | 水平（无状态） | 水平（消费者组） |

