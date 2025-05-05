import dotenv from "dotenv";
import { createUserController } from "../../../app/create-user";
import {
  IMessagerAccessRequest,
  IMessagerBrokerAccess,
  IRouterMessageBroker,
} from "../implementations/imessager-broker-acess.interface";

dotenv.config();

export class UserQueueRouter implements IRouterMessageBroker {
  /**
   * Registers the handler for the user creation queue.
   * @param messageBroker Instance of the message broker.
   */
  handle(messageBroker: IMessagerBrokerAccess): void {
    const queueName = process.env.RABBIT_QUEUE_USER_CREATE;

    if (!queueName) {
      throw new Error(
        "Missing required environment variable: RABBIT_QUEUE_USER_CREATE"
      );
    }

    messageBroker.listenRPC(queueName, async (data: IMessagerAccessRequest) => {
      try {
        return await createUserController.handle(data);
      } catch (error) {
        console.error(
          `[handle] Erro ao criar usuário na fila '${queueName}':`,
          error
        );
        return {
          code: 500,
          response: {
            message: "Internal error while creating user.",
            details: error instanceof Error ? error.message : String(error),
          },
        };
      }
    });
  }
}
