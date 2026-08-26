import { RailwayClientError } from "../errors.js";
import { postGraphQL } from "../graphqlRequest.js";
import type { LatestDeploymentRecord, ServiceInstanceScope } from "./types.js";

const SERVICE_INSTANCE_LATEST_DEPLOYMENT_QUERY = `
  query ServiceInstanceLatestDeployment($environmentId: String!, $serviceId: String!) {
    serviceInstance(environmentId: $environmentId, serviceId: $serviceId) {
      serviceId
      environmentId
      latestDeployment {
        id
        status
        createdAt
      }
    }
  }
`;

type ServiceInstanceLatestDeploymentResponse = {
  serviceInstance: {
    serviceId: string;
    environmentId: string;
    latestDeployment: LatestDeploymentRecord | null;
  } | null;
};

export type QueryLatestDeploymentOptions = ServiceInstanceScope & {
  apiToken: string;
};

export const queryLatestDeployment = async (
  options: QueryLatestDeploymentOptions,
): Promise<LatestDeploymentRecord | null> => {
  const { apiToken, environmentId, serviceId } = options;

  const data = await postGraphQL<ServiceInstanceLatestDeploymentResponse>({
    apiToken,
    query: SERVICE_INSTANCE_LATEST_DEPLOYMENT_QUERY,
    variables: { environmentId, serviceId },
  });

  const instance = data.serviceInstance;
  if (!instance) {
    throw new RailwayClientError(
      `Service instance not found for environmentId=${environmentId} serviceId=${serviceId}`,
    );
  }

  return instance.latestDeployment;
};
