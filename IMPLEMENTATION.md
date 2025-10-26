# StatefulSet Migration Implementation

## Overview
This document tracks the migration from Kubernetes Deployments to StatefulSets for the Fullstack Agent sandbox functionality. This change provides persistent storage and stable network identities for sandbox containers.

## Motivation
- **Persistent Storage**: Users need their work and data to survive pod restarts and rescheduling
- **Stable Network Identity**: StatefulSets provide predictable DNS names and stable hostnames
- **Better Data Management**: Ordered deployment and scaling with persistent volume claims

## Key Differences: Deployment vs StatefulSet

### Deployment (Current)
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sandbox-name
  strategy:
    type: RollingUpdate
  template:
    spec:
      containers: [...]
      volumes: []
```

### StatefulSet (Target)
```yaml
apiVersion: apps/v1
kind: StatefulSet
spec:
  replicas: 1
  serviceName: sandbox-name-service
  selector:
    matchLabels:
      app: sandbox-name
  updateStrategy:
    type: RollingUpdate
  template:
    spec:
      containers: [...]
      volumeMounts:
        - name: persistent-storage
          mountPath: /home/agent
  volumeClaimTemplates:
    - metadata:
        name: persistent-storage
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 5Gi
```

## Implementation Changes

### 1. Configuration Updates

#### File: `/lib/config/versions.ts`
- Added `STORAGE.SANDBOX_SIZE` configuration (5Gi)
- Updated resource annotations to include storage size

### 2. KubernetesService Method Updates

#### createSandbox() Method (Lines 266-598)
**Changes:**
- Resource kind changed from `Deployment` to `StatefulSet`
- Added `serviceName` field requirement
- Added `volumeClaimTemplates` section
- Updated container `volumeMounts` for `/home/agent`
- Changed `strategy` to `updateStrategy`
- Updated annotation: `'deploy.cloud.sealos.io/resize': '5Gi'`

#### deleteSandbox() Method (Lines 600-675)
**Changes:**
- Use `deleteNamespacedStatefulSet` instead of `deleteNamespacedDeployment`
- Updated resource filtering logic for StatefulSets

#### getSandboxStatus() Method (Lines 677-712)
**Changes:**
- Use `listNamespacedStatefulSet` instead of `listNamespacedDeployment`
- Updated status checking logic for StatefulSet replica status

#### stopSandbox() Method (Lines 969-1015)
**Changes:**
- Use StatefulSet scaling API instead of Deployment
- Updated resource discovery and scaling logic

#### startSandbox() Method (Lines 1017-1054)
**Changes:**
- Use StatefulSet scaling API instead of Deployment
- Updated resource discovery and scaling logic

#### updateDeploymentEnvVars() → updateStatefulSetEnvVars()
**Changes:**
- Renamed method to reflect StatefulSet usage
- Updated API calls to use StatefulSet endpoints
- Maintained all existing functionality for environment variable updates

### 3. YAML Template Updates

#### File: `/yaml/sandbox/deployment.yaml`
**Changes:**
- Updated to StatefulSet specification
- Added volume claim templates
- Updated annotations and labels as needed

### 4. Database Schema Considerations

#### File: `/prisma/schema.prisma`
**Notes:**
- Current Sandbox model remains compatible
- Consider adding StatefulSet-specific fields in future iterations
- No immediate changes required for basic functionality

### 5. Test Suite Updates

#### File: `/lib/kubernetes.test.ts`
**Changes:**
- Updated test expectations for StatefulSet behavior
- Modified status checking logic
- Added persistent storage validation tests

## Critical Implementation Details

### Persistent Storage Configuration
- **Mount Path**: `/home/agent` (user's home directory)
- **Storage Size**: 5Gi (configurable via VERSIONS.STORAGE.SANDBOX_SIZE)
- **Access Mode**: ReadWriteOnce (appropriate for single pod access)
- **Storage Class**: Uses cluster default (compatible with Sealos)

### Sealos Cloud Compatibility
All Sealos-specific annotations and labels are preserved:
- `'cloud.sealos.io/app-deploy-manager'` labels
- `'deploy.cloud.sealos.io/*'` annotations
- Domain management and ingress configuration remains unchanged

### Network Identity
- StatefulSet pods get stable network identities
- DNS format: `{pod-name}.{service-name}.{namespace}.svc.cluster.local`
- Service discovery works seamlessly with existing ingress configuration

## Backwards Compatibility
- All existing API methods maintain the same signatures
- No changes required to calling code outside of KubernetesService
- Database schema remains unchanged for this migration

## Testing Strategy
1. **Unit Tests**: Update existing test suite for StatefulSet behavior
2. **Integration Tests**: Verify complete sandbox lifecycle with persistent storage
3. **Storage Tests**: Validate data persistence across pod restarts
4. **Network Tests**: Confirm stable DNS resolution and access

## Rollback Plan
If issues arise, the migration can be rolled back by:
1. Reverting changes in `/lib/kubernetes.ts`
2. Restoring Deployment YAML template
3. Updating configuration to remove storage settings
4. Running database migrations if schema changes were made

## Performance Considerations
- StatefulSets have slightly slower pod creation than Deployments
- Persistent storage adds I/O latency (acceptable for user data)
- Ordered deployment provides predictable scaling behavior
- Resource usage is comparable with additional storage overhead

## Future Enhancements
1. **Multiple Persistent Volumes**: Support for additional mount points
2. **Storage Classes**: Allow configuration of different storage tiers
3. **Volume Snapshots**: Implement backup and restore functionality
4. **Horizontal Scaling**: Support for multi-pod StatefulSets with shared storage

## Migration Checklist
- [x] Create implementation documentation
- [ ] Update VERSIONS configuration
- [ ] Modify createSandbox() method
- [ ] Update deletion and status methods
- [ ] Update scaling methods (stop/start)
- [ ] Rename and update environment variables method
- [ ] Update YAML templates
- [ ] Update test suite
- [ ] Test complete implementation
- [ ] Validate persistent storage functionality
- [ ] Verify backwards compatibility

## Notes and Observations
- StatefulSets provide better user experience for development environments
- Persistent storage is crucial for maintaining user work across sessions
- Sealos cloud platform fully supports StatefulSet with the required annotations
- The migration maintains all existing functionality while adding persistence