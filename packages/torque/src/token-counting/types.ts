import type { IDatasetMessage, IDatasetTool } from "../types";

export type TokenCountPayload = {
  messages: IDatasetMessage[];
  tools: IDatasetTool[];
  model?: string;
};

export type TokenCountResult = {
  messages: number;
  tools: number;
  total: number;
};

export type TokenCountWorkerRequest = {
  id: number;
  payload: TokenCountPayload;
};

export type TokenCountWorkerResponse =
  | { id: number; result: TokenCountResult }
  | { id: number; error: string };
