# Research Loop

Research Loop 是一个面向 **Pi** 的 evidence-first 科研工作流插件。它围绕一个待验证的**命题**
组织 human-in-the-loop 实验：命题被拆成问题，每次实验回答一个问题，每份 Checkpoint 说明结论对命题
的影响以及由此产生的新问题，再由研究者决定下一步验证哪个问题。

插件关注真实研究循环：理解问题、设计实验、执行并观察进度、检查结果、保存 artifacts、形成阶段性
结论，然后进入下一轮实验。普通实现、文档修改和常规软件验证应关闭 Research Loop。

## 主要功能

- **命题驱动的研究链**：命题 → 问题 → 实验 → Checkpoint → 新问题，Viewer 以问题树展示整条论证。
- **事先预期**：进入实验前登记“若观察到……则说明……”，原样写入 Checkpoint 并逐条判断。
- **人在环内的交接**：每份 Checkpoint 之后由研究者选择下一个问题、采纳或拒绝命题修订。
- **三种 Work Mode**：Brainstorming、Exploration、Experiment。
- **实验生命周期**：Experiment 必须通过 Checkpoint 或有效 Abort 正式结束。
- **工具约束**：只读模式阻止实验执行和文件修改；Experiment Mode 允许实证工作。
- **复现设置保护**：修改数据范围、split、checkpoint、seeds 或其他关键设置前需要用户批准。
- **研究者友好的实验代码**：清晰 `main()`、Rich phase 展示、tqdm 进度、集中参数和可预测输出。
- **持久化 Checkpoint**：在项目的 `checkpoints/` 中写入中文 Markdown 研究记录。
- **统一 Checkpoint Viewer**：一个插件内 Viewer 展示全部历史记录、公式、表格、图片和 JSON/CSV。
- **Artifact Radar**：只在 Experiment Mode 运行，优先监听明确的输出范围，并发现 PNG、SVG、CSV、JSON、Parquet、PDF 等结果文件。
- **终端图片预览**：Checkpoint 图片优先使用 Chafa Sixel，`/artifacts` 使用 Chafa symbols。
- **可见状态**：Pi footer 持续显示当前 mode、实验 intent、actions、outputs 和 review 状态。

## 安装

### 从 GitHub 安装

```bash
pi install git:github.com/CrossStar/research-loop
```

安装到当前项目的 Pi settings：

```bash
pi install -l git:github.com/CrossStar/research-loop
```

固定到某个 release：

```bash
pi install git:github.com/CrossStar/research-loop@research-loop--v0.6.0
```

> Pi package 会以当前用户权限运行。安装第三方扩展前应检查源码。

### 临时试用

临时加载且不写入 settings：

```bash
pi -e git:github.com/CrossStar/research-loop
```

### 更新

更新已安装的 Pi packages：

```bash
pi update --extensions
```

查看已安装 packages：

```bash
pi list
```

### 卸载

```bash
pi remove git:github.com/CrossStar/research-loop
```

### 本地源码加载

```bash
git clone https://github.com/CrossStar/research-loop.git
cd research-loop
npm install
pi -e .
```

## 快速开始

Research Loop 默认关闭。在 Pi 中输入：

```text
/research on
```

启用后从 Exploration Mode 开始。先告诉 Agent 你想验证的命题，例如：

```text
我想验证：对比学习预训练提升了小样本分类的准确率。
```

Agent 会把它整理成一句可证伪的命题和 1–5 个初始问题，调用 `research_proposition` 登记。
插件弹出确认框，你确认后才会写入 `checkpoints/propositions/P1.md`。

开始实证执行前，Agent 调用 `research_mode` 进入 Experiment Mode，并声明：

- 要回答的问题编号（`questionId`，必须已在当前命题下登记）；
- 这个实验为什么能回答该问题（`rationale`）；
- 至少两条事先预期（`predictions`：若观察到……则说明……）；
- experiment title、intent、planned data scope；
- reference protocol（如适用）和 project-relative artifact roots（已知输出目录时）。

实验产生可解释结果后，Agent 调用 `research_checkpoint`。插件会：

1. 写入持久化 `checkpoint.md`，并自动加上命题、推理位置和事先预期；
2. 将状态返回 Exploration Mode；
3. 在终端显示最新 Checkpoint URL；
4. Agent 停下后弹出交接菜单：选择下一个问题、提出新问题，或采纳命题修订建议；
5. 选中问题后打开可编辑的下一轮指令，提交后自动开始下一轮。

查看或切换命题：

```text
/proposition
```

关闭 Research Loop：

```text
/research off
```

查看本 session 发现的 artifacts，或按需启动历史 Checkpoint Viewer：

```text
/artifacts
/checkpoint-viewer
```

## 命题驱动的研究链

```text
命题 P1   "对比学习预训练提升了小样本分类的准确率"
 ├─ Q1 领先是否跨随机种子稳定？
 │   └─ C1  支持：三个种子都领先 0.08
 │       └─ Q3 领先是否来自更强的数据增强？      ← 由 C1 提出
 │           └─ C2  削弱：统一增强后领先降到 0.02  → 建议收窄命题（待你确认）
 └─ Q2 领先是否在其他数据集上成立？                ← 待验证
```

- **命题文件** `checkpoints/propositions/P{n}.md` 只保存命题陈述、登记的问题和修订记录。
- **问题树由 Checkpoint 推导**：每份 Checkpoint 的 frontmatter 记录它回答的问题
  （`question_id`）和它提出的新问题（`new_questions`），Viewer 扫描时组合成树，不另外维护账本。
- **命题只有你能改**：建立和修订命题都需要你在确认框中批准；Agent 只能在 Checkpoint 中提出修订建议。
- 进入 Experiment Mode 需要一个活跃命题；每个实验只回答一个已登记的问题。新问题要先用
  `research_proposition add_question` 登记。
- 同一时间只有一个活跃命题；新 session 会自动恢复最近更新的命题，`/proposition` 可以切换。

`research_proposition` 的 action：

| action | 作用 | 需要你确认 |
| --- | --- | --- |
| `create` | 建立命题及初始问题，并设为当前命题 | 是 |
| `revise` | 修订命题陈述，写入修订记录 | 是 |
| `add_question` | 在当前命题下登记新问题 | 否 |
| `activate` | 切换到已有命题 | 否 |

## Work Modes

| Mode | 用途 | 允许的工作 | 典型结果 |
| --- | --- | --- | --- |
| Brainstorming | 比较研究方向 | 阅读、比较方案、分析 trade-off | 推荐方向 |
| Exploration | 理解代码和材料 | 定向读取、追踪行为、核对设置 | 相关发现 |
| Experiment | 获取 empirical evidence | 修改实验代码、运行实验、分析结果 | Research Checkpoint |

```text
普通直接实现   → Research Loop OFF
比较可能方向   → Brainstorming
理解代码或材料 → Exploration
运行实证工作   → Experiment
```

Experiment 不能静默退出：

```text
EXPERIMENT → research_checkpoint → EXPLORATION
```

只有完全没有产生 interpretable evidence 时，才能使用 `research_abort_experiment`。负结果、失败模式
和 diagnostic observation 都属于应进入 Checkpoint 的 evidence。

## Experiment Mode 代码规范

Pi 在 Experiment Mode 中新建或修改实验代码时，会注入一组克制的研究代码约束：

- 顶层 `main()` 映射自然语言实验阶段；
- 函数对应自然实验动作或清晰职责；
- Python 脚本使用 Rich 展示配置、phase、关键检查、结果表和保存路径；
- 真正耗时的重复工作使用 `tqdm`；
- 模型、数据、layers、seeds、batch size、split、threshold 和输出目录集中管理；
- 常规入口保持为 `python experiment.py`，并提供清晰 `--help`；
- 长实验提供 `--quick` 或 `--smoke` 路径，并显式展示缩减设置；
- seed 对 split、pseudo labels、初始化和 sampling 的影响保持可见；
- 关键 phase 结束后展示能够判断科学异常的中间结果；
- 运行完成后使用 Rich table 汇总结果，并列出准确 artifact 路径；
- 避免 factory、registry、strategy/context hierarchy、细碎 wrapper 和广泛 fallback；
- 对会浪费长时间计算的问题尽早给出具体、可采取行动的错误。

详细规范见 [`docs/experiment-code.md`](docs/experiment-code.md)。

## 持久化 Checkpoint

默认目录结构：

```text
checkpoints/
├── checkpoint-20260821-231400-example/
│   └── checkpoint.md
└── checkpoint-20260822-001500-example/
    └── checkpoint.md
```

`checkpoint.md` 包含 JSON-compatible frontmatter 和按论证顺序排列的中文结构：

```text
C{n}：一句话标题
> 命题 · 推理位置 · 本轮问题 · 一句话答案 · 对命题的影响 · 新问题   （插件生成）
1. 为什么做这个实验       问题来源由插件生成，Agent 补充此前证据留下的未决点
2. 实验设计与事先预期     数据集（选择理由、基本信息）→ 关键超参数表 → 设计思路 → 事先预期表
3. 实际观察               只放回答本轮问题所需的图表
4. 对照预期的判断         逐条判断预期；对命题的影响；命题修订建议（如有）
5. 新问题与下一步实验     每个新问题的来源、建议实验和事先预期
复现信息                  Viewer 中默认折叠
```

插件负责命题、推理位置、问题来源和事先预期等链接信息；Agent 只写各节正文。protocol、reproduction
和 artifact references 保持结构化并接受校验。

### 数学公式

所有数学表达式都写成 LaTeX：行内 `$...$`，独立公式 `$$...$$`。这条规则适用于命题、问题、事先预期、
Checkpoint 标题、一句话答案和各节正文。符号在首次出现时定义。

- Viewer 中所有位置都用 MathJax 渲染，包括正文、问题树、命题陈述、历史列表和侧栏；
- 终端里的 Checkpoint 结果、交接菜单、确认框和 `/proposition` 列表会把常见 LaTeX 近似转换成
  Unicode，例如 `$\hat{\beta}$` 显示为 `β̂`，`$n \approx d$` 显示为 `n ≈ d`；
- Markdown 文件和发给 Agent 的内容始终保留原始 LaTeX。

### 图表规范

涉及数值的结果应尽量用图或表展示：优先引用实验代码保存的图，精确数值用 Markdown 表格，没有现成图时
用 `checkpoint-chart` 画简单的柱状图或折线图。实验代码会为每个主要比较在运行目录的 `figures/` 下保存
一张图，并在旁边保存逐条件数值的 CSV。

每个图表形成独立的“图（表）→ 正式标题 → 解析”单元：

- 表题放在表格上方；
- 图题放在图片或动态图表下方；
- 图表后必须有单独的解析段落，说明内容及其研究含义；
- 解析后使用独立的 `---` 浅色分隔线；
- Checkpoint 禁止使用“不是……而是……”“而不是”“而非”等同类转折句式。

表格示例：

```markdown
### 表 1　逐种子准确率

| 条件 | 种子数量 | 准确率 |
| --- | ---: | ---: |
| 实验组 | 2 | 0.91 |
| 对照组 | 2 | 0.82 |

表 1 显示实验组准确率领先 0.09，这一结果说明汇总差异与逐种子方向保持一致。

---
```

图片示例：

```markdown
![图 1　主要结果趋势](results/main.png "图 1　主要结果趋势")

图 1 显示两个随机种子的差异方向一致，这一证据支持稳定效应解释。

---
```

轻量展示图表可以使用 `checkpoint-chart`：

````markdown
```checkpoint-chart
{"type":"bar","title":"图 2　平均准确率","items":[{"label":"实验组","value":0.91},{"label":"对照组","value":0.82}]}
```

图 2 显示实验组柱高超过对照组，这一差异意味着当前范围内存在稳定的正向效应。

---
````

真正的科研图表仍由实验代码生成并保存在原始结果目录。Viewer 动态生成的展示图不额外写入 PNG。

## Checkpoint Viewer

插件只维护一个 HTML/CSS/JS Viewer。历史 Checkpoint 保持 Markdown 格式，Viewer 样式更新后，所有
历史记录立即使用新样式，无需重新生成 HTML。Viewer 不再占用 `session_start` 路径；首次生成
Checkpoint 或调用 `/checkpoint-viewer` 时才会启动。

主要路由：

```text
/                   命题列表与 Checkpoint 历史
/latest             最新 Checkpoint 的稳定入口
/checkpoints/{id}   指定历史记录
/propositions/{id}  命题的问题树
/api/checkpoints    自动发现的 metadata
/api/propositions   命题摘要
/artifacts/{path}   项目内原始 artifact
```

Viewer 支持：

- Markdown 与 GFM tables；
- MathJax 公式；
- 图片和正式图题；
- `checkpoint-chart` bar/line 图；
- 命题问题树：每个问题的来源、回答它的 Checkpoint、结论标记和待验证问题；
- Checkpoint 顶部链接到所属命题；
- 右侧章节目录和历史导航；
- JSON Tree、Raw、键名搜索和大数组分组；
- CSV 前 100 行预览；
- 图片放大；
- Print / PDF；
- TeX Main 英文、宋体中文和 Maple Mono 代码字体。

`$...$`、`$$...$$`、`\(...\)` 和 `\[...\]` 可以渲染公式。普通金额文本如 `$5 and $10`
会保持原样。

### 监听地址

默认只监听 loopback：

```bash
RESEARCH_LOOP_CHECKPOINT_HOST=127.0.0.1 pi -e .
```

在可信局域网中直接访问时，可以显式监听全部 IPv4 interfaces：

```bash
RESEARCH_LOOP_CHECKPOINT_HOST=0.0.0.0 pi -e .
```

只接受 `127.0.0.1` 和 `0.0.0.0`。`0.0.0.0` 模式没有 authentication，Pi 会显示安全警告。
终端 URL 使用服务器 hostname；客户端无法解析时，使用服务器 IP 替换 hostname。

### SSH 转发

远程访问推荐保留 `127.0.0.1`，并在本地计算机执行终端给出的单行命令：

```bash
ssh -N -o RemoteCommand=none -o RequestTTY=no -L 43119:127.0.0.1:43119 moon
```

然后打开：

```text
http://127.0.0.1:43119/latest
```

## Artifact 行为

Experiment Runner 负责生成真实科研 artifacts，例如：

```text
PNG / SVG
CSV / Parquet
JSON / JSONL
logs
model checkpoints
raw predictions
activations
```

Checkpoint Writer 只记录引用。图片、表格和模型输出不会复制到 `checkpoints/`，也不会以 base64
写入 Markdown 或 session tool details。展开 TUI Checkpoint 结果时，图片预览才从原文件按需读取。

Pi session 的 `research-loop-state` 只保存体积很小的控制状态和 `artifactRoots`，不会保存完整
artifact inventory。`session_start` 只恢复控制状态、tools 和 footer，随后立即返回；artifact
rediscovery 与 Radar 初始化在带 session generation 和 AbortSignal 的后台任务中执行。切换或关闭
session 会取消旧任务，旧扫描结果无法写入新 session。

Artifact Radar 只在 Experiment Mode 且存在明确 `artifactRoots` 时运行。空 roots 不会退化为对
整个项目执行 recursive `fs.watch`。关闭 Research Loop、进入只读模式或完成 Checkpoint 后会立即
停止 watchers。

持久化状态保持为类似以下的小对象：

```json
{
  "enabled": true,
  "workMode": "experiment",
  "artifactRoots": ["results/seed_bimodality/run-20260828-2314"]
}
```

进入 Experiment Mode 时应尽量声明稳定的项目相对输出目录，例如：

```text
artifactRoots: ["results/seed_bimodality/run-20260828-2314"]
```

没有显式目录时 Radar 保持关闭；Checkpoint 中明确登记的 artifact 会用于推断并保存安全的 run
root。项目根目录中的 `summary.json` 会保留为单文件 root `summary.json`，不会转换为 `.`。

Root normalization、watcher events 和 rediscovery traversal 共用同一套路径策略：

1. 固定排除 `.git`、`.pi`、`.claude`、`node_modules` 和 `__pycache__`；
2. 通过 `pyvenv.cfg`、项目内 `VIRTUAL_ENV`、`CONDA_PREFIX` 和 venv 名称 fallback 排除 Python 环境；
3. 应用项目根目录中的 `.research-loopignore`。

`.research-loopignore` 使用 gitignore-compatible 语法，例如：

```gitignore
# 项目自己的 cache、vendor 和临时评估目录
.cache/
vendor/
scratch-evals/
**/debug-dumps/
```

旧 session 的 roots 和 embedded artifact migration 也会经过同一 sanitizer，因此
`.venv-train/.../site-packages` 等历史污染路径会在首次恢复时从最新控制状态中移除。旧 JSONL 的
历史行仍保留在原文件中，新写入的状态不会继续放大它。

如果 `chafa` 在 `PATH` 中：

- Checkpoint evidence 图片使用 Chafa Sixel；
- `/artifacts` 图片使用 Chafa ANSI symbols；
- Chafa 不可用时回退到 Pi 原生 terminal image protocols。

检查 Chafa：

```bash
chafa --version
```

## 结构化用户决策

Research Loop 会检测 active tools 中是否存在 `ask_user_question`。安装可选集成后，Agent 会在以下
关键节点集中询问：

- 会改变科研解释的 protocol 或 data scope；
- 多个成本或运行范围方案之间的选择；
- 多个真正不同的下一实验分支。

Checkpoint 之后选择下一个问题由插件自己的交接菜单完成，不依赖这个集成。

安装：

```bash
pi install npm:@juicesharp/rpiv-ask-user-question
```

普通、可逆或已经回答的选择不会重复询问。长时间运行、分布式启动和调度命令本身不会触发成本确认；
如果命令同时改变 reproduction protocol，仍需批准该 protocol deviation。用户取消问卷时，当前
Agent turn 会停止并交还控制权。

## Reproduction Fidelity

启动 reproduction 前应核对：

- official paper，包括 appendix 和 supplementary material；
- 对应 commit/tag 的 official repository README；
- 相关 open/closed issues，优先关注 maintainer clarification。

每个 reproduction protocol 记录：

```text
intent
dataScope
sources
deviations
```

Checkpoint validation 要求 paper、README 和 issue-search coverage。任何数据范围、split、模型、
checkpoint、preprocessing、seeds 或 repeats 变化都应明确记录，并在执行前获得用户批准。

## Footer Status

Pi footer 使用紧凑状态提示：

```text
◇ research  off
◇ research  exploration · no proposition · read only
◇ research  brainstorming · P1 · read only
◇ research  exploration · P1 next Q3 · read only
◆ research  experiment · P1 Q3 · diagnostic · 3 actions · 1 output
◆ research  experiment · P1 Q1 · reproduction · 6 actions · 3 outputs · review due
◆ research  checkpoint · 2 results
```

Experiment 和 Checkpoint 使用实心标记，Brainstorming、Exploration 和 OFF 使用空心标记。

## 配置

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `RESEARCH_LOOP_CHECKPOINT_DIR` | `checkpoints` | 项目内 Checkpoint 目录 |
| `RESEARCH_LOOP_CHECKPOINT_PORT` | `43119` | Viewer 起始端口；占用时自动向上寻找 |
| `RESEARCH_LOOP_CHECKPOINT_HOST` | `127.0.0.1` | `127.0.0.1` 或 `0.0.0.0` |
| `RESEARCH_LOOP_SSH_HOST` | 当前 hostname | SSH config alias 或远端主机名 |

示例：

```bash
RESEARCH_LOOP_CHECKPOINT_PORT=45000 \
RESEARCH_LOOP_CHECKPOINT_HOST=127.0.0.1 \
RESEARCH_LOOP_SSH_HOST=moon \
pi -e .
```

PowerShell：

```powershell
$env:RESEARCH_LOOP_CHECKPOINT_PORT = "45000"
$env:RESEARCH_LOOP_CHECKPOINT_HOST = "127.0.0.1"
$env:RESEARCH_LOOP_SSH_HOST = "moon"
pi -e .
```

## 项目结构

```text
research-loop/
├── src/index.ts                         # Pi extension source entry
├── src/runtime.ts                       # Pi Research State、policy 和 tool gate
├── src/checkpoint.ts                    # Checkpoint tool 与 TUI result
├── src/checkpoint-store.ts              # Markdown writer、discovery 和 validation
├── src/proposition-store.ts            # 命题文件、问题树和 policy 摘要
├── src/checkpoint-server.ts             # Viewer server、renderer 和 artifact routes
├── src/checkpoint-report-template.html  # 唯一 Viewer HTML/CSS/JS
├── src/artifacts.ts                     # Artifact Radar 与 preview
├── src/terminal-image.ts                # Chafa 和 native image fallback
├── src/core/                            # State machine、Governor 和共享类型
├── scripts/build-pi.mjs                 # Pi ESM bundle build
└── dist/pi/                             # Pi 实际加载的预编译 extension 与 Viewer template
```

详细文档：

- [`docs/experiment-code.md`](docs/experiment-code.md)：Experiment Mode 实验代码规范；
- [`docs/checkpoint-viewer.md`](docs/checkpoint-viewer.md)：Markdown Writer、Viewer、artifact 和 chart contract。

## 本地开发与测试

```bash
git clone https://github.com/CrossStar/research-loop.git
cd research-loop
npm install
npm run check
npm run test:pi
```

发布包直接加载仓库中已生成的 `dist/pi/index.js`，安装过程不执行构建脚本。开发者修改 Pi 源码后，
需要手动重新构建并启动：

```bash
npm run build:pi
pi -e .
```

## 安全说明

- Pi extensions 以当前用户权限运行，能够执行代码和访问文件；安装前应检查源码。
- Viewer 默认绑定 `127.0.0.1`。
- `0.0.0.0` Viewer 没有 authentication，只应在可信网络中启用。
- Artifact routes 会解析 symlink 并阻止访问项目根目录以外的文件。
- Viewer 的 MathJax 和 TeX web fonts 当前使用 CDN；离线时正文、表格、图片和历史仍可阅读。

## Repository

https://github.com/CrossStar/research-loop
