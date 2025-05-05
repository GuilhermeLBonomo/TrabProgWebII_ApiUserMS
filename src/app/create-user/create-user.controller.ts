import {
  IMessagerAccessRequest,
  IResponseAccessResponse,
} from "../../providers/message-broker-acess/implementations/imessager-broker-acess.interface";
import { CreateUserApplication } from "./create-user.application";

export class CreateUserController {
  constructor(private readonly createUserApp: CreateUserApplication) {}

  /**
   * Handle
   * @param req
   * @returns
   */
  async handle(req: IMessagerAccessRequest): Promise<IResponseAccessResponse> {
    try {
      await this.createUserApp.execute(req.body);
      return {
        code: 201,
        response: {
          message: "Usuário cadastrado com sucesso!",
        },
      };
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      return {
        code: error?.code ?? 500,
        response: {
          message: error?.message ?? "Erro interno do servidor",
        },
      };
    }
  }
}
