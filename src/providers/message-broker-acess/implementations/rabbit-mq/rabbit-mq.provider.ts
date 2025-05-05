import amqp, { Channel, Connection } from "amqplib";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  IMessagerAccess,
  IMessagerAccessRequest,
  IMessagerBrokerAccess,
  IResponseAccessResponse,
} from "../imessager-broker-acess.interface";

dotenv.config();

export class RabbitMQ implements IMessagerBrokerAccess {
  private readonly URL: string =
    process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";

  /**
   * Conecta ao broker e cria um canal.
   * @returns {Promise<Channel>} O canal do RabbitMQ.
   */
  async connect(): Promise<Channel> {
    const connection: Connection = await amqp.connect(this.URL);
    return connection.createChannel();
  }

  /**
   * Escuta mensagens do tipo RPC (Remote Procedure Call).
   * @param {string} queue Nome da fila a ser escutada.
   * @param {CallableFunction} callback Função de tratamento da requisição.
   */
  listenRPC(queue: string, callback: CallableFunction): void {
    this.connect()
      .then((channel) => this.createQueue(channel, queue))
      .then((channel) => {
        channel.consume(queue, async (msg) => {
          if (!msg) return;

          try {
            const request = this.messageConvertRequest(msg);
            const response = await callback(request);

            await this.responseCallRPC({
              queue,
              replyTo: msg.properties.replyTo,
              correlationId: msg.properties.correlationId,
              response,
            });

            channel.ack(msg);
          } catch (err) {
            console.error("Erro ao processar mensagem RPC:", err);
            channel.nack(msg, false, false); // rejeita e não reencaminha
          }
        });
      })
      .catch((err) => console.error("Erro ao iniciar listenRPC:", err));
  }

  /**
   * Cria uma fila se não existir.
   * @param {Channel} channel O canal do RabbitMQ.
   * @param {string} queue O nome da fila a ser criada.
   * @returns {Promise<Channel>} O canal com a fila criada.
   */
  async createQueue(channel: Channel, queue: string): Promise<Channel> {
    await channel.assertQueue(queue, { durable: true });
    return channel;
  }

  /**
   * Envia uma mensagem no padrão Pub/Sub (sem espera por resposta).
   * @param {IMessagerAccess} message A mensagem a ser enviada.
   * @returns {Promise<void>} Retorna uma promessa que indica que a operação foi concluída.
   */
  async sendPubSub(message: IMessagerAccess): Promise<void> {
    try {
      const channel = await this.connect().then((ch) =>
        this.createQueue(ch, message.queue)
      );
      channel.sendToQueue(
        message.queue,
        Buffer.from(JSON.stringify(message.message))
      );
    } catch (err) {
      console.error("Erro ao enviar Pub/Sub:", err);
    }
  }

  /**
   * Envia uma mensagem no padrão RPC e aguarda a resposta.
   * @param {IMessagerAccess} message A mensagem a ser enviada.
   * @returns {Promise<IResponseAccessResponse>} Retorna a resposta do servidor.
   */
  async sendRPC(message: IMessagerAccess): Promise<IResponseAccessResponse> {
    const timeout = process.env.RABBITMQ_TIMEOUT
      ? Number(process.env.RABBITMQ_TIMEOUT)
      : 5000;
    const correlationId = uuidv4();
    const connection = await amqp.connect(this.URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(message.queue, { durable: true });
    const tempQueue = await channel.assertQueue("", { exclusive: true });

    return new Promise((resolve) => {
      let responded = false;

      const timer = setTimeout(() => {
        if (!responded) {
          connection.close();
          resolve({
            code: 408,
            response: { message: "Timeout" },
          });
        }
      }, timeout);

      channel.consume(
        tempQueue.queue,
        (msg) => {
          if (msg?.properties.correlationId === correlationId) {
            clearTimeout(timer);
            connection.close();
            responded = true;
            resolve(this.messageConvert(msg));
          }
        },
        { noAck: true }
      );

      channel.sendToQueue(
        message.queue,
        Buffer.from(JSON.stringify(message.message)),
        {
          correlationId,
          replyTo: tempQueue.queue,
        }
      );
    });
  }

  /**
   * Converte uma mensagem de resposta recebida.
   * @param {Object} message A mensagem recebida no formato de buffer.
   * @returns {IResponseAccessResponse} A resposta convertida para o formato esperado.
   */
  messageConvert(message: { content: Buffer }): IResponseAccessResponse {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        code: typeof parsed.code === "number" ? parsed.code : 200,
        response: parsed,
      };
    } catch (error) {
      return {
        code: 500,
        response: {
          message: "Formato JSON inválido",
          raw: message.content.toString(),
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Converte uma mensagem recebida para o formato esperado na aplicação.
   * @param {Object} message A mensagem recebida no formato de buffer.
   * @returns {IMessagerAccessRequest} O corpo da mensagem convertido para o formato esperado.
   */
  messageConvertRequest(message: { content: Buffer }): IMessagerAccessRequest {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        body: parsed,
        message: "Parsed successfully",
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown parsing error";

      return {
        body: null,
        message: `JSON inválido (${errorMsg}): ${message.content.toString()}`,
      };
    }
  }

  /**
   * Envia uma resposta para uma chamada RPC.
   * @param {Object} objResponse O objeto contendo informações da resposta.
   * @param {string} objResponse.queue A fila para onde a resposta será enviada.
   * @param {string} objResponse.replyTo A fila de resposta.
   * @param {string} objResponse.correlationId O ID de correlação da mensagem original.
   * @param {IResponseAccessResponse} objResponse.response A resposta a ser enviada.
   * @returns {Promise<void>} Retorna uma promessa que indica que a operação foi concluída.
   */
  async responseCallRPC({
    queue,
    replyTo,
    correlationId,
    response,
  }: {
    queue: string;
    replyTo: string;
    correlationId: string;
    response: IResponseAccessResponse;
  }): Promise<void> {
    try {
      const channel = await this.connect().then((ch) =>
        this.createQueue(ch, queue)
      );
      channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(response)), {
        correlationId,
      });
    } catch (err) {
      console.error("Erro ao enviar resposta RPC:", err);
    }
  }
}
