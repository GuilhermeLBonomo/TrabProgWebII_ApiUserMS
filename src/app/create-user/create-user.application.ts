import dotenv from "dotenv";
import { ErroCustom } from "../../errors/error-custom";
import { UserEntity } from "../../models/user/user.entity";
import { IEncrypt } from "../../providers/encrypt/iencrypt.interface";
import { IMessagerBrokerAccess } from "../../providers/message-broker-acess/implementations/imessager-broker-acess.interface";
import { ICreateUserDTO } from "./icreate-user-dto.interface";

dotenv.config();

export class CreateUserApplication {
  constructor(
    private readonly messagerBroker: IMessagerBrokerAccess,
    private readonly userEntity: typeof UserEntity,
    private readonly encrypt: IEncrypt
  ) {}

  /**
   * Execute use case: create user and notify via queue
   * @param userSend
   */
  async execute(userSend: ICreateUserDTO): Promise<void> {
    try {
      this.validateInput(userSend);

      await this.emailExist(userSend.email);

      const hashedPassword = await this.encrypt.hashPassword(userSend.password);

      await this.userEntity.create({
        name: userSend.name,
        email: userSend.email,
        password: hashedPassword,
        cellPhone: userSend.cellPhone,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.notifyNewUser(userSend);
    } catch (error) {
      console.error("[CreateUserApplication] Failed to execute:", {
        error: error instanceof Error ? error.message : error,
        payload: userSend,
      });
      throw error;
    }
  }

  /**
   * Validate basic input
   */
  private validateInput(user: ICreateUserDTO): void {
    if (!user.email || !user.name || !user.password) {
      throw new ErroCustom({
        code: 422,
        error: "Missing required user fields: email, name, or password.",
      });
    }
  }

  /**
   * Check if email already exists
   */
  private async emailExist(email: string): Promise<void> {
    const { count } = await this.userEntity.findAndCountAll({
      where: { email },
    });

    if (count) {
      throw new ErroCustom({
        code: 400,
        error: "E-mail em uso.",
      });
    }
  }

  /**
   * Send user created event to message broker
   */
  private async notifyNewUser(user: ICreateUserDTO): Promise<void> {
    try {
      await this.messagerBroker.sendPubSub({
        queue: process.env.RABBIT_MQ_QUEUE_USER_CREATE ?? "send-email-new-user",
        message: {
          email: user.email,
          name: user.name,
        },
      });
    } catch (err) {
      console.error(
        "[CreateUserApplication] Failed to notify user creation:",
        err
      );
    }
  }
}
