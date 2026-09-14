import { RailwayClientError } from "../errors.js";
import { postGraphQL } from "../graphqlRequest.js";

/**
 * Railway stops/restarts via deployment mutations (not serviceInstanceStop — that field
 * is not on the public schema). Callers resolve the target deployment id from
 * queryLatestDeployment() first.
 */
const DEPLOYMENT_STOP_MUTATION = `
  mutation DeploymentStop($id: String!) {
    deploymentStop(id: $id)
  }
`;

const DEPLOYMENT_RESTART_MUTATION = `
  mutation DeploymentRestart($id: String!) {
    deploymentRestart(id: $id)
  }
`;

type DeploymentStopResponse = {
  deploymentStop: boolean;
};

type DeploymentRestartResponse = {
  deploymentRestart: boolean;
};

export type DeploymentMutationOptions = {
  apiToken: string;
  deploymentId: string;
};

export const mutationDeploymentStop = async (
  options: DeploymentMutationOptions,
): Promise<void> => {
  const { apiToken, deploymentId } = options;

  const data = await postGraphQL<DeploymentStopResponse>({
    apiToken,
    query: DEPLOYMENT_STOP_MUTATION,
    variables: { id: deploymentId },
  });

  if (!data.deploymentStop) {
    throw new RailwayClientError(
      `deploymentStop returned false for deploymentId=${deploymentId}`,
    );
  }
};

export const mutationDeploymentRestart = async (
  options: DeploymentMutationOptions,
): Promise<void> => {
  const { apiToken, deploymentId } = options;

  const data = await postGraphQL<DeploymentRestartResponse>({
    apiToken,
    query: DEPLOYMENT_RESTART_MUTATION,
    variables: { id: deploymentId },
  });

  if (!data.deploymentRestart) {
    throw new RailwayClientError(
      `deploymentRestart returned false for deploymentId=${deploymentId}`,
    );
  }
};
