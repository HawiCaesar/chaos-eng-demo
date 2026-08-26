import { RailwayClientError, type GraphQLErrorItem } from "./errors.js";

export const RAILWAY_GRAPHQL_URL = "https://backboard.railway.com/graphql/v2";

const REQUEST_TIMEOUT_MS = 30_000;

type GraphQLResponseBody<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

export type PostGraphQLOptions = {
  apiToken: string;
  query: string;
  variables?: Record<string, unknown>;
};

export const postGraphQL = async <TData>(
  options: PostGraphQLOptions,
): Promise<TData> => {
  const { apiToken, query, variables } = options;

  let response: Response;
  try {
    response = await fetch(RAILWAY_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Railway GraphQL request failed";
    throw new RailwayClientError(message, { cause: error });
  }

  let body: GraphQLResponseBody<TData>;
  try {
    body = (await response.json()) as GraphQLResponseBody<TData>;
  } catch (error) {
    throw new RailwayClientError(
      `Railway GraphQL returned non-JSON (HTTP ${response.status})`,
      { httpStatus: response.status, cause: error },
    );
  }

  if (body.errors?.length) {
    const message =
      body.errors.map((entry) => entry.message).join("; ") || "GraphQL error";
    throw new RailwayClientError(message, {
      graphqlErrors: body.errors,
      httpStatus: response.status,
    });
  }

  if (!response.ok) {
    throw new RailwayClientError(`Railway GraphQL HTTP ${response.status}`, {
      httpStatus: response.status,
    });
  }

  if (body.data === undefined) {
    throw new RailwayClientError("Railway GraphQL response missing data", {
      httpStatus: response.status,
    });
  }

  return body.data;
};
