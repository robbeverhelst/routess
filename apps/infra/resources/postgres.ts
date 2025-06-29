import { ComponentResource, ComponentResourceOptions, Output, interpolate } from "@pulumi/pulumi";
import { Chart } from "@pulumi/kubernetes/helm/v4";
import { ServiceAccount, Secret } from "@pulumi/kubernetes/core/v1";
import { PostgresResourceConfig } from "./types";

export class PostgresResource extends ComponentResource {
  public readonly chart: Chart;
  public readonly serviceAccount: ServiceAccount;
  public readonly secrets: Secret;
  public readonly serviceUrl: Output<string>;
  public readonly serviceName: Output<string>;

  constructor(name: string, config: PostgresResourceConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:Postgres", name, {}, opts);

    // Database Service Account with minimal permissions
    this.serviceAccount = new ServiceAccount(
      `${config.appName}-db-sa`,
      {
        metadata: {
          name: `${config.appName}-db-sa`,
          namespace: config.namespace,
          annotations: {
            "kubernetes.io/description": "Service account for database with minimal permissions",
          },
        },
        automountServiceAccountToken: false,
      },
      { parent: this, provider: config.provider },
    );

    // Database Secrets
    this.secrets = new Secret(
      `${config.appName}-db-secrets`,
      {
        metadata: {
          name: `${config.appName}-db-secrets`,
          namespace: config.namespace,
          annotations: {
            "kubernetes.io/description": "Database credentials",
          },
        },
        type: "Opaque",
        stringData: {
          "postgres-password": config.password,
          "postgres-user": config.username,
          "postgres-db": config.database,
        },
      },
      { parent: this, provider: config.provider },
    );

    this.chart = new Chart(
      `${config.appName}-postgres`,
      {
        chart: "oci://registry-1.docker.io/bitnamicharts/postgresql",
        version: "15.5.36",
        namespace: config.namespace,
        values: {
          auth: {
            postgresPassword: config.password,
            username: config.username,
            password: config.password,
            database: config.database,
          },
          primary: {
            persistence: config.persistence || {
              enabled: true,
              size: "10Gi",
              storageClass: "truenas-hdd-mirror-iscsi",
            },
            resources: config.resources?.primary || {
              limits: {
                cpu: "1000m",
                memory: "1Gi",
                "ephemeral-storage": "2Gi",
              },
              requests: {
                cpu: "500m",
                memory: "512Mi",
                "ephemeral-storage": "1Gi",
              },
            },
            podSecurityContext: {
              enabled: true,
              runAsUser: 999, // postgres user
              runAsGroup: 999,
              runAsNonRoot: true,
              fsGroup: 999,
              seccompProfile: {
                type: "RuntimeDefault",
              },
            },
            containerSecurityContext: {
              enabled: true,
              allowPrivilegeEscalation: false,
              runAsNonRoot: true,
              runAsUser: 999,
              runAsGroup: 999,
              capabilities: {
                drop: ["ALL"],
              },
              readOnlyRootFilesystem: false, // postgres needs to write data
              seccompProfile: {
                type: "RuntimeDefault",
              },
            },
          },
          metrics: {
            enabled: true,
            resources: config.resources?.metrics || {
              limits: {
                cpu: "100m",
                memory: "128Mi",
              },
              requests: {
                cpu: "50m",
                memory: "64Mi",
              },
            },
          },
        },
      },
      {
        provider: config.provider,
        dependsOn: config.dependencies,
        parent: this,
      },
    );

    this.serviceName = interpolate`${config.appName}-postgres-postgresql`;
    this.serviceUrl = interpolate`${this.serviceName}.${config.namespace}.svc.cluster.local:5432`;

    this.registerOutputs({
      chart: this.chart,
      serviceAccount: this.serviceAccount,
      secrets: this.secrets,
      serviceUrl: this.serviceUrl,
      serviceName: this.serviceName,
    });
  }
}
