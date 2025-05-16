import * as pulumi from "@pulumi/pulumi";
import { 
    Provider,
    core,
    apps
} from "@pulumi/kubernetes";

// Get configuration
const config = new pulumi.Config();
const appName = "maps";
const appLabels = { app: appName };
const namespace = "maps";

// Get app version from environment variable or use "latest" as fallback
const appVersion = process.env.APP_VERSION || "latest";
console.log(`Deploying version: ${appVersion}`);

// Create a Kubernetes provider instance that uses kubeconfig from Pulumi configuration
const provider = new Provider("k8s-provider", {
    kubeconfig: config.requireSecret("kubeconfig"),
});

// Create a Kubernetes namespace
const ns = new core.v1.Namespace(namespace, {
    metadata: {
        name: namespace,
    },
}, { provider });

// Get GitHub credentials from config
const githubUsername = config.require("githubUsername");
const githubToken = config.requireSecret("githubToken");

// Create auth string for GitHub Container Registry
const authString = pulumi.interpolate`${githubUsername}:${githubToken}`.apply(
    s => Buffer.from(s).toString('base64')
);

// Create Docker config JSON
const dockerConfigJson = authString.apply(auth => JSON.stringify({
    auths: {
        "ghcr.io": {
            auth: auth
        }
    }
}));

// Create a Docker registry secret for GitHub Container Registry
const dockerSecret = new core.v1.Secret(`${appName}-ghcr-secret`, {
    metadata: {
        name: "ghcr-pull-secret",
        namespace: namespace,
    },
    type: "kubernetes.io/dockerconfigjson",
    stringData: {
        ".dockerconfigjson": dockerConfigJson,
    },
}, { provider, dependsOn: ns });

// Create a unique name for the deployment to force an update
const deploymentName = `${appName}-deployment-${appVersion.replace(/\./g, '-')}`;

// Create a Kubernetes deployment
const deployment = new apps.v1.Deployment(deploymentName, {
    metadata: {
        namespace: namespace,
        labels: appLabels,
        annotations: {
            // Add annotation to force update and handle field conflicts
            "pulumi.com/skipAwait": "true",
            "pulumi.com/patchForce": "true",
            // Add version annotation for tracking
            "app.kubernetes.io/version": appVersion
        }
    },
    spec: {
        selector: {
            matchLabels: appLabels,
        },
        replicas: 2,
        template: {
            metadata: {
                labels: appLabels,
                annotations: {
                    // Add version annotation for tracking
                    "app.kubernetes.io/version": appVersion
                }
            },
            spec: {
                containers: [{
                    name: appName,
                    image: `ghcr.io/robbeverhelst/maps:${appVersion}`,
                    ports: [{ containerPort: 80 }],
                    resources: {
                        limits: {
                            cpu: "500m",
                            memory: "512Mi",
                        },
                        requests: {
                            cpu: "250m",
                            memory: "256Mi",
                        },
                    },
                    imagePullPolicy: "Always",
                }],
                imagePullSecrets: [{ name: dockerSecret.metadata.name }],
            },
        },
    },
}, { provider, dependsOn: [ns, dockerSecret] });

// Create a Kubernetes service to expose the deployment
const service = new core.v1.Service(`${appName}-service`, {
    metadata: {
        namespace: namespace,
        labels: appLabels,
    },
    spec: {
        type: "ClusterIP",
        ports: [{ port: 80, targetPort: 80 }],
        selector: appLabels,
    },
}, { provider, dependsOn: deployment });

// Export the service name and namespace
export const serviceName = service.metadata.name;
export const serviceNamespace = service.metadata.namespace;
export const kubernetesCluster = config.require("clusterName");
export const serviceUrl = pulumi.interpolate`${serviceName}.${serviceNamespace}.svc.cluster.local`;
export const deployedVersion = appVersion;
