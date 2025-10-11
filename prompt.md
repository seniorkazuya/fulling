### **重塑版产品需求文档：AI全栈工程Agent平台**

### **1. 项目核心与愿景**

- **核心问题:** 即使拥有现代化的技术栈（如Next.js），从一个想法到构建、部署并维护一个功能完备的全栈Web应用，仍然是一个复杂、耗时且充满挑战的过程。开发者需要处理大量的模板代码、基础设施配置、部署流程和持续的维护工作。
- **产品愿景:** 我们不再是为开发者提供工具，**我们本身就是开发工具的终极形态——一个AI驱动的全栈工程Agent**。我们的愿景是打造一个智能的、自动化的SaaS平台，该平台能理解用户的自然语言需求，并自主完成从项目创建、编码、配置、部署到迭代的全过程。
- **最终价值:** 彻底改变Web应用的开发范式。让任何用户（无论是专业开发者还是产品经理）都能通过与AI Agent对话，在几分钟内将一个应用构想，转变为一个部署在**隔离沙箱环境**中的、生产就绪的全栈应用程序。我们**固化并优化最佳实践技术栈 (Next.js, PostgreSQL, Shadcn/UI)**，让用户完全从基础设施的复杂性中解放出来，专注于“创造什么”，而非“如何创造”。

### **2. 目标用户与关键场景**

- **目标用户:**
    - **核心用户:** TypeScript/Next.js 开发者、独立开发者（Indie Hackers）、AI爱好者和技术创业公司。他们追求极致的开发效率，希望将精力集中在业务逻辑和产品创新上。
    - **拓展用户:** 产品经理、设计师和技术背景较弱的创始人。他们可以利用本平台快速验证想法，创建功能性的原型（MVP）甚至正式产品。
- **用户使用核心流程与核心功能:**
    - 核心流程：从零到一的自动化应用创建
        1. 用户在平台上创建一个 Project.
        2. 系统 调用 kubernetes API 创建一个 PostgreSQL 数据库. 如何创建参考 yaml/database 目录中的示例和 Readme
        3. 系统 调用Kubernetes (k8s) API (kubeconfig 我已经放到 .secret 目录了, service deployment 的示例 yaml 已经放到 yaml/sandbox 目录了)，为该应用创建一个隔离的开发环境沙箱（包含Next.js服务和PostgreSQL数据库客户端）沙箱的 Docker 镜像我已经构建完成
        4. 需要为 deployment 设置好 claude code 的环境变量,在 .secret/.env 中获取.数据库的环境变量, 调用 kubernetes API 获取 secret 和 service, 具体名称是什么自己去查.
        5. 系统主界面自动打开沙箱的 web terminal, 并自动调用 claude code 命令
        6. 用户拷贝自己的需求，并让 claude code 实现代码
        7. 将所有代码提交到一个GitHub仓库中。这里需要用户授权 github 账号，关联用户已经创建的项目或者帮助用户创建一个 github 仓库，两个选择，创建仓库会获取用户创建仓库的权限。授权已有仓库就直接向仓库中提交代码。
        8. 完成部署，界面显示一个可公开访问的URL。
    - 支持用户配置功能：环境配置
        用户需要为一个第三方服务（如Stripe）配置API密钥。他可以通过平台的环境变量管理界面轻松添加该密钥，Agent将确保运行时环境能够安全地访问它。用户可以配置环境变量和密钥，都以 KV 形式存储在沙箱的 .env 环境变量中。 
        针对认证的配置，显示的提供配置界面，如 google 认证，github 认证等，参数与第三方保持一致，方便用户配置。
        针对支付配置，显示的提供配置界面，先支持 stripe 的支付配置。这些信息都存储到环境变量中，且告诉模型这些上下文信息，方便模型编码时引用这些 KEY.

## 系统架构

```
FullstackAgent pod --> User Runtime pod and a pgsql database
                    |
                    +-> UserRuntime pod and a pgsql database

```
FullstackAgent pod 通过调用 kubernetes 接口为每个 Project 创建一个容器，每个 User Runtime pod 暴露多个端口，包含 ttyd 端口和用户业务的访问端口。

FullstackAgent pod 页面上直接 iframe 嵌套 ttyd 的链接, 把 User Runtime pod 的业务访问 URL 显示在界面上

FullstackAgent 在创建工程时为每个项目创建一个独立的数据库实例，通过调用 Kuberntes 接口实现，示例 yaml 在 yaml 目录下，注意事项在 yaml/README.md 中

## 实现方式

本工程技术栈也使用 Next.js, PostgreSQL, Shadcn/UI, 技术栈实现，要求界面简约美观，主色调以黑白灰为主，要求交互友好。

本项目采用远程开发方式，外部域名和端口是 https://dgkwlntjskms.usw.sealos.io, 所以实现时请监听 0.0.0.0:3000 端口

本项目的数据库已经常建好，见 .env 中的 DATABASE 环境变量

kubeconfig 没有 create namespace 的权限，namespace 直接使用 kubeconfig 中已有的即可