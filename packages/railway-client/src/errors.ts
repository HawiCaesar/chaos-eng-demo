export type GraphQLErrorItem = {
  message: string;
};

export class RailwayClientError extends Error {
  override readonly name = "RailwayClientError";
  readonly graphqlErrors?: GraphQLErrorItem[];
  readonly httpStatus?: number;

  constructor(
    message: string,
    options?: {
      graphqlErrors?: GraphQLErrorItem[];
      httpStatus?: number;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.graphqlErrors = options?.graphqlErrors;
    this.httpStatus = options?.httpStatus;
  }
}
