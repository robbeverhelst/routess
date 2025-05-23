import * as pulumi from "@pulumi/pulumi";
import { 
    Provider,
    core,
    apps
} from "@pulumi/kubernetes";

// Get configuration
const config = new pulumi.Config();
const appName = "maps";
const webAppLabels = { app: `${appName}-web` };
const apiAppLabels = { app: `${appName}-api` };
const namespace = "maps";

// Get app version from environment variable or use "latest" as fallback
const appVersion = process.env.APP_VERSION || "latest";
console.log(`Deploying version: ${appVersion}`);

// Get image names from environment variables with lowercase repository owner
const webImage = process.env.WEB_IMAGE || `ghcr.io/robbeverhelst/maps-web:${appVersion}`;
const apiImage = process.env.API_IMAGE || `ghcr.io/robbeverhelst/maps-api:${appVersion}`;
console.log(`Web image: ${webImage}`);
console.log(`API image: ${apiImage}`);

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

// Create simple deployment names
const webDeploymentName = `${appName}-web`;
const apiDeploymentName = `${appName}-api`;

// Create a Kubernetes deployment for the web application
const webDeployment = new apps.v1.Deployment(webDeploymentName, {
    metadata: {
        name: webDeploymentName, // Ensure the name is explicitly set
        namespace: namespace,
        labels: webAppLabels,
        annotations: {
            "app.kubernetes.io/version": appVersion
        }
    },
    spec: {
        selector: {
            matchLabels: webAppLabels,
        },
        replicas: 2,
        strategy: { type: "Recreate" }, 
        template: {
            metadata: {
                labels: webAppLabels,
                annotations: {
                    "app.kubernetes.io/version": appVersion
                }
            },
            spec: {
                containers: [{
                    name: `${appName}-web`,
                    image: webImage,
                    ports: [{ containerPort: 80 }],
                    env: [
                        {
                            name: "VITE_MAPBOX_ACCESS_TOKEN",
                            value: process.env.VITE_MAPBOX_ACCESS_TOKEN || "",
                        },
                        {
                            name: "VITE_GOOGLE_CLIENT_ID",
                            value: process.env.VITE_GOOGLE_CLIENT_ID || "",
                        },
                        {
                            name: "VITE_APP_URL",
                            value: process.env.VITE_APP_URL || "https://maps.robbeverhelst.be",
                        },
                        {
                            name: "NODE_ENV",
                            value: "production",
                        }
                    ],
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
                imagePullSecrets: [{ name: "ghcr-pull-secret" }],
            },
        },
    },
}, { provider, dependsOn: [ns, dockerSecret] });

// Create a Kubernetes deployment for the API
const apiDeployment = new apps.v1.Deployment(apiDeploymentName, {
    metadata: {
        name: apiDeploymentName, // Ensure the name is explicitly set
        namespace: namespace,
        labels: apiAppLabels,
        annotations: {
            "app.kubernetes.io/version": appVersion
        }
    },
    spec: {
        selector: {
            matchLabels: apiAppLabels,
        },
        replicas: 2,
        strategy: { type: "Recreate" }, 
        template: {
            metadata: {
                labels: apiAppLabels,
                annotations: {
                    "app.kubernetes.io/version": appVersion
                }
            },
            spec: {
                containers: [{
                    name: `${appName}-api`,
                    image: apiImage,
                    ports: [{ containerPort: 3000 }],
                    env: [
                        {
                            name: "NODE_ENV",
                            value: "production",
                        },
                        {
                            name: "PORT",
                            value: "3000",
                        }
                    ],
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
                    livenessProbe: {
                        httpGet: {
                            path: "/",
                            port: 3000,
                        },
                        initialDelaySeconds: 30,
                        periodSeconds: 10,
                    },
                    readinessProbe: {
                        httpGet: {
                            path: "/",
                            port: 3000,
                        },
                        initialDelaySeconds: 5,
                        periodSeconds: 5,
                    },
                }],
                imagePullSecrets: [{ name: "ghcr-pull-secret" }],
            },
        },
    },
}, { provider, dependsOn: [ns, dockerSecret] });

// Create a Kubernetes service to expose the web deployment
const webService = new core.v1.Service(`${appName}-web-service`, {
    metadata: {
        namespace: namespace,
        labels: webAppLabels,
    },
    spec: {
        type: "ClusterIP",
        ports: [{ port: 80, targetPort: 80 }],
        selector: webAppLabels,
    },
}, { provider, dependsOn: webDeployment });

// Create a Kubernetes service to expose the API deployment
const apiService = new core.v1.Service(`${appName}-api-service`, {
    metadata: {
        namespace: namespace,
        labels: apiAppLabels,
    },
    spec: {
        type: "ClusterIP",
        ports: [{ port: 3000, targetPort: 3000 }],
        selector: apiAppLabels,
    },
}, { provider, dependsOn: apiDeployment });

// Export the service names and namespace
export const webServiceName = webService.metadata.name;
export const apiServiceName = apiService.metadata.name;
export const serviceNamespace = webService.metadata.namespace;
export const kubernetesCluster = config.require("clusterName");
export const webServiceUrl = pulumi.interpolate`${webServiceName}.${serviceNamespace}.svc.cluster.local`;
export const apiServiceUrl = pulumi.interpolate`${apiServiceName}.${serviceNamespace}.svc.cluster.local:3000`;
export const deployedVersion = appVersion;
