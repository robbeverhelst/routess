import { Input, Output, Resource } from "@pulumi/pulumi";
import { Provider } from "@pulumi/kubernetes";

export interface BaseResourceConfig {
  appName: string;
  namespace: string;
  provider: Provider;
  labels: Record<string, string>;
}

export interface AppResourceConfig extends BaseResourceConfig {
  image: string;
  replicas?: number;
  port: number;
  env?: Input<
    Input<{
      name: Input<string>;
      value: Input<string>;
    }>[]
  >;
  resources?: {
    limits?: {
      cpu?: string;
      memory?: string;
    };
    requests?: {
      cpu?: string;
      memory?: string;
    };
  };
  livenessProbe?: Input<{
    httpGet: Input<{
      path: Input<string>;
      port: Input<number>;
    }>;
    initialDelaySeconds?: Input<number>;
    periodSeconds?: Input<number>;
  }>;
  readinessProbe?: Input<{
    httpGet: Input<{
      path: Input<string>;
      port: Input<number>;
    }>;
    initialDelaySeconds?: Input<number>;
    periodSeconds?: Input<number>;
  }>;
  dependencies?: Resource[];
}

export interface PostgresResourceConfig {
  appName: string;
  namespace: string;
  provider: Provider;
  database: string;
  username: string;
  password: Output<string> | string;
  persistence?: {
    enabled?: boolean;
    size?: string;
    storageClass?: string;
  };
  resources?: {
    primary?: {
      limits?: {
        cpu?: string;
        memory?: string;
      };
      requests?: {
        cpu?: string;
        memory?: string;
      };
    };
    metrics?: {
      limits?: {
        cpu?: string;
        memory?: string;
      };
      requests?: {
        cpu?: string;
        memory?: string;
      };
    };
  };
  dependencies?: Resource[];
}

export interface DockerRegistryConfig {
  appName: string;
  namespace: string;
  provider: Provider;
  username: string;
  token: Output<string>;
  registryUrl: string;
  dependencies?: Resource[];
}
