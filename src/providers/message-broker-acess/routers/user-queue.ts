import { createUserController } from "../../../app/create-user";
import {
  IMessagerAccessRequest,
  IMessagerBrokerAccess,
  IRouterMessageBroker,
} from "../implementations/imessager-broker-acess.interface";

export class UserQueueRouter implements IRouterMessageBroker {
  /**
   * Registra o handler da fila "user-create" para criar um novo usuário.
   * @param messageBroker Instância do broker de mensagens.
   */
  handle(messageBroker: IMessagerBrokerAccess): void {
    messageBroker.listenRPC(
      "user-create",
      async (data: IMessagerAccessRequest) => {
        try {
          return await createUserController.handle(data);
        } catch (error) {
          console.error("Erro ao processar 'user-create':", error);
          return {
            code: 500,
            response: {
              message: "Erro interno ao criar usuário",
              details: String(error),
            },
          };
        }
      }
    );
  }
}
