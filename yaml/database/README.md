## 启动数据库的 yaml 示例

可以通过参考 yaml 文件调用 kubernetes API 实现数据库创建，通过 `service` `secret` 等接口获取到数据库的内网地址和密码.

获取密码, 通过调用 kubernetes API, 获取里面的如 [project-name]-conn-credential 的 secret 里面的 password 字段, 是 base64 编码的，注意解析：

获取示例：
```
root@(ns-ajno7yq7) ~$ kubectl get secret fullstackagent-conn-credential -oyaml
apiVersion: v1
data:
  endpoint: ZnVsbHN0YWNrYWdlbnQtcG9zdyZXNx1NDMy
  host: ZnVsbHN0YWNrYWdlbnQtcG9zdGdXNxbA==
  password: bm43eHB2M=
  port: NTQzM==
  username: cGdGdyZXM=
kind: Secret
metadata:
  creationTimestamp: "2025-10-11T04:33:32Z"
  finalizers:
  - cluster.kubeblocks.io/finalizer
  labels:
    app.kubernetes.io/instance: fullstackagent
    app.kubernetes.io/managed-by: kubeblocks
    app.kubernetes.io/name: postgresql
    apps.kubeblocks.io/cluster-type: postgresql
  name: fullstackagent-conn-credential
  namespace: ns-ajno7yq7
  ownerReferences:
  - apiVersion: apps.kubeblocks.io/v1alpha1
    blockOwnerDeletion: true
    controller: true
    kind: Cluster
    name: fullstackagent
    uid: 7d246a6b-4714-4861-bdb8-c1c95a28898c
  resourceVersion: "612201031"
  uid: b714f062-88ce-45aa-820d-b37f4078bb20
type: Opaque
```