# API Test Framework

Python API 自动化测试框架，基于 pytest 构建，支持数据驱动、参数化、多环境管理和插件扩展。

## 项目结构

```
├── core/        # 核心模块（HTTP 客户端、断言引擎、请求构建器等）
├── config/      # 配置管理（多环境配置、全局设置）
├── tests/       # 测试用例
├── utils/       # 工具函数（日志、数据处理等）
├── plugins/     # 插件系统
├── reports/     # 测试报告输出
└── pyproject.toml
```

## 快速上手

### 环境要求

- Python >= 3.10

### 安装

```bash
# 克隆项目
git clone https://github.com/Helen-66/test2-for-helennubit-team.git
cd test2-for-helennubit-team

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装项目（开发模式）
pip install -e .

# 安装开发依赖
pip install -e ".[dev]"
```

### 运行测试

```bash
pytest
```
