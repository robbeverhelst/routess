# 🔐 Kubernetes Security Implementation Guide

## Overview

This document outlines the comprehensive security hardening implementation for the Maps application Kubernetes infrastructure.

## ✅ Implementation Checklist

### **Phase 1: Critical Security (Immediate - This Week)**

#### 🔴 **High Priority (Complete First)**

- [x] **Network Policies** - Restrict pod-to-pod communication
  - [x] Default deny-all policy created
  - [x] Web frontend policies (allows Cloudflare tunnel)
  - [x] API backend policies
  - [x] Database isolation policies
  - [x] Applied to cluster via Pulumi infrastructure

- [x] **Pod Security Standards**
  - [x] Restricted security contexts defined
  - [x] Non-root user configurations
  - [x] Read-only root filesystem where possible
  - [x] All deployments updated to use security contexts

- [x] **Secrets Management**
  - [x] Kubernetes Secrets created for sensitive data
  - [x] Environment variable injection from secrets
  - [x] Secrets integrated directly into resource definitions
  - [x] API secrets properly configured

#### 🟡 **Medium Priority (Complete This Month)**

- [x] **RBAC Implementation**
  - [x] Service accounts with minimal permissions
  - [x] Service accounts created for each component
  - [x] RBAC applied to all deployments
  - [x] API service account configured for secret access

- [x] **Container Security**
  - [x] Security contexts applied to all containers
  - [x] Non-root users configured (nginx:101, api:1000, postgres:999)
  - [x] Capabilities dropped (ALL)
  - [x] Privilege escalation disabled
  - [x] Seccomp profiles applied (RuntimeDefault)
  - [ ] Container image scanning in CI/CD
  - [ ] Regular base image updates

### **Phase 2: Enhanced Security (Next Month)**

#### 🟢 **Lower Priority (Nice to Have)**

- [ ] **Monitoring & Alerting**
  - [ ] Security monitoring configuration (removed Falco as overkill)
  - [ ] Deploy lightweight security monitoring
  - [ ] Set up security alerts

- [ ] **Advanced Features**
  - [ ] Admission controllers for policy enforcement
  - [ ] OPA Gatekeeper policies
  - [ ] Mutual TLS between services
  - [ ] External secrets management (Vault/External Secrets Operator)

## 🚀 Actual Implementation ✅ COMPLETED

### Step 1: Security Integrated Directly Into Resources

Security has been implemented directly in each resource file:

**Network Policies** (`apps/infra/index.ts`):

```typescript
import { NetworkPolicy } from "@pulumi/kubernetes/networking/v1";

// Default deny-all policy
new NetworkPolicy(`${appName}-default-deny`, {
  metadata: { name: `${appName}-default-deny`, namespace },
  spec: {
    podSelector: {},
    policyTypes: ["Ingress", "Egress"],
  },
});

// Component-specific policies for web, api, and database
```

**Service Accounts & Security Contexts** (in each resource file):

```typescript
// API Resource (apps/infra/resources/api.ts)
this.serviceAccount = new ServiceAccount(`${config.appName}-api-sa`, {
  metadata: { name: `${config.appName}-api-sa`, namespace: config.namespace },
  automountServiceAccountToken: true, // API needs secrets access
});

// Pod security context
securityContext: {
  runAsNonRoot: true,
  runAsUser: 1000,
  runAsGroup: 1000,
  fsGroup: 1000,
  seccompProfile: { type: "RuntimeDefault" },
}
```

### Step 2: Test Cloudflare Tunnel Connectivity

1. Deploy network policies
2. Test that Cloudflare tunnel can still reach your services
3. Verify pod-to-pod communication works as expected
4. Check application functionality

### Step 3: Monitor and Iterate

1. Check Kubernetes events for policy violations
2. Monitor application logs for connectivity issues
3. Adjust network policies if needed
4. Gradually implement additional security layers

## 📋 Network Policy Impact Analysis

### **Allowed Connections:**

- ✅ Cloudflare tunnel → Web frontend (port 80)
- ✅ Cloudflare tunnel → API backend (port 3000)
- ✅ Web frontend → API backend (port 3000)
- ✅ API backend → Database (port 5432)
- ✅ All pods → DNS resolution (port 53)
- ✅ API backend → External HTTPS (Google OAuth, etc.)

### **Blocked Connections:**

- ❌ Direct access to database from web frontend
- ❌ Database outbound connections (except DNS)
- ❌ Cross-namespace communication (except Cloudflare)
- ❌ Unnecessary pod-to-pod communication

## 🔧 Configuration Verification

### Test Network Policies:

```bash
# Test from web pod to API (should work)
kubectl exec -it deployment/maps-web -- wget -qO- http://maps-api:3000/health

# Test from web pod to database (should fail)
kubectl exec -it deployment/maps-web -- nc -zv maps-postgres 5432

# Test from API pod to database (should work)
kubectl exec -it deployment/maps-api -- nc -zv maps-postgres 5432
```

### Verify Security Contexts:

```bash
# Check running processes are non-root
kubectl exec -it deployment/maps-web -- ps aux
kubectl exec -it deployment/maps-api -- ps aux

# Verify read-only filesystem (where applicable)
kubectl exec -it deployment/maps-api -- touch /test-file
```

### Check RBAC:

```bash
# Verify service account permissions
kubectl auth can-i get secrets --as=system:serviceaccount:your-namespace:maps-api-sa
kubectl auth can-i create pods --as=system:serviceaccount:your-namespace:maps-api-sa
```

## ⚠️ Important Notes

1. **Cloudflare Tunnel Compatibility**: The network policies are designed to allow Cloudflare tunnel connections while blocking unauthorized access.

2. **Gradual Rollout**: Implement security measures gradually to avoid breaking existing functionality.

3. **Testing Required**: Always test in a staging environment first.

4. **Monitoring**: Set up monitoring for security policy violations and application errors.

5. **Documentation**: Keep security configurations documented and version controlled.

## 🆘 Rollback Plan

If security implementations cause issues:

1. **Quick Rollback**: Remove network policies first

   ```bash
   kubectl delete networkpolicy --all -n your-namespace
   ```

2. **Service Account Issues**: Temporarily use default service account

   ```bash
   kubectl patch deployment maps-api -p '{"spec":{"template":{"spec":{"serviceAccountName":"default"}}}}'
   ```

3. **Container Security Issues**: Temporarily disable security context
   ```bash
   kubectl patch deployment maps-api -p '{"spec":{"template":{"spec":{"securityContext":null}}}}'
   ```

## 📞 Support

For issues with this implementation:

1. Check Kubernetes events: `kubectl get events --sort-by=.metadata.creationTimestamp`
2. Review pod logs: `kubectl logs deployment/maps-api`
3. Verify network connectivity: Use the test commands above
4. Check security policy violations in monitoring dashboard
