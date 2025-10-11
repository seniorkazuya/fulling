# Database 和 sandbox 创建规则

注意，调用 K8s 接口创建 deployment service ingress 等对象时，时严格参考本目录下面的 yaml 文件，不能省略里面的重要信息，比如 label 信息和其它字段，除了一些必要字段有变化之外其他通用内容都需要保留。

所有资源要有命名规则，如 [project-name]-agentruntime-[6位随机数]