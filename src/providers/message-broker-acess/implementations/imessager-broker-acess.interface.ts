export interface IMessagerAccess {
  queue: string;
  message: any;
}

export interface IResponseAccessResponse {
  code: number;
  response: any;
}

export interface IMessagerAccessRequest {
  body: any;
  message: string;
}

export interface IRouterMessageBroker {
  handle(messagerBroker: IMessagerBrokerAccess): void;
}

export interface IMessagerBrokerAccess {
  /**
   * Send a message via Publish/Subscribe model.
   * @param message Message object containing target queue and payload.
   */
  sendPubSub(message: IMessagerAccess): Promise<void>;

  /**
   * Send an RPC message and await response.
   * @param message Message object containing queue and payload.
   * @returns Structured response with code and content.
   */
  sendRPC(message: IMessagerAccess): Promise<IResponseAccessResponse>;

  /**
   * Listen to an RPC queue and process requests via callback.
   * @param queue Queue name to bind.
   * @param callback Handler function for incoming RPC requests.
   */
  listenRPC(queue: string, callback: CallableFunction): void;
}
