import type { RailwayClientConfig } from "./config.js";
import { RailwayClientError } from "./errors.js";
import { toLifecycleStatus } from "./mapDeploymentStatus.js";
import { queryLatestDeployment } from "./operations/deployments.js";
import {
  mutationDeploymentRestart,
  mutationDeploymentStop,
} from "./operations/serviceInstance.js";
import type { DeploymentStatusResult, ServiceStatusResult } from "./types.js";

export class RailwayClient {
  private readonly config: RailwayClientConfig;

  constructor(config: RailwayClientConfig) {
    this.config = config;
  }

  private resolveServiceId(serviceId?: string): string {
    return serviceId ?? this.config.primaryDbServiceId;
  }

  private queryScope(serviceId: string) {
    return {
      apiToken: this.config.apiToken,
      environmentId: this.config.environmentId,
      serviceId,
    };
  }

  async getServiceStatus(serviceId?: string): Promise<ServiceStatusResult> {
    const resolvedServiceId = this.resolveServiceId(serviceId);
    const latest = await queryLatestDeployment(this.queryScope(resolvedServiceId));

    if (!latest) {
      return {
        serviceId: resolvedServiceId,
        environmentId: this.config.environmentId,
        status: "STOPPED",
        rawDeploymentStatus: "NONE",
      };
    }

    return {
      serviceId: resolvedServiceId,
      environmentId: this.config.environmentId,
      status: toLifecycleStatus(latest.status),
      rawDeploymentStatus: latest.status,
      deploymentId: latest.id,
    };
  }

  async getDeploymentStatus(serviceId?: string): Promise<DeploymentStatusResult> {
    const resolvedServiceId = this.resolveServiceId(serviceId);
    const latest = await queryLatestDeployment(this.queryScope(resolvedServiceId));

    if (!latest) {
      throw new RailwayClientError(
        `No latest deployment for environmentId=${this.config.environmentId} serviceId=${resolvedServiceId}`,
      );
    }

    return {
      deploymentId: latest.id,
      status: latest.status,
      createdAt: latest.createdAt,
      serviceId: resolvedServiceId,
      environmentId: this.config.environmentId,
    };
  }

  async stopService(serviceId?: string): Promise<void> {
    const resolvedServiceId = this.resolveServiceId(serviceId);
    const latest = await queryLatestDeployment(this.queryScope(resolvedServiceId));

    if (!latest?.id) {
      throw new RailwayClientError(
        `No latest deployment to stop for serviceId=${resolvedServiceId}`,
      );
    }

    await mutationDeploymentStop({
      apiToken: this.config.apiToken,
      deploymentId: latest.id,
    });
  }

  async restartService(serviceId?: string): Promise<void> {
    const resolvedServiceId = this.resolveServiceId(serviceId);
    const latest = await queryLatestDeployment(this.queryScope(resolvedServiceId));

    if (!latest?.id) {
      throw new RailwayClientError(
        `No latest deployment to restart for serviceId=${resolvedServiceId}`,
      );
    }

    await mutationDeploymentRestart({
      apiToken: this.config.apiToken,
      deploymentId: latest.id,
    });
  }
}
