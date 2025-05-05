import dotenv from "dotenv";
import amqp, { Channel, Connection, ConsumeMessage } from "amqplib";
import { v4 as uuidv4 } from "uuid";
import {
  IMessagerAccess,
  IMessagerAccessRequest,
  IMessagerBrokerAccess,
  IResponseAccessResponse,
} from "../imessager-broker-acess.interface";

//Api User
dotenv.config();

export class RabbitMQ implements IMessagerBrokerAccess {
  private readonly URL: string;

  constructor() {
    const { RABBIT_USER, RABBIT_PASSWORD, RABBIT_HOST, RABBIT_PORT } =
      process.env;

    if (!RABBIT_USER || !RABBIT_PASSWORD || !RABBIT_HOST || !RABBIT_PORT) {
      throw new Error("Missing RabbitMQ environment variables.");
    }

    this.URL = `amqp://${RABBIT_USER}:${RABBIT_PASSWORD}@${RABBIT_HOST}:${RABBIT_PORT}`;
  }

  private async connect(): Promise<Channel> {
    try {
      const conn: Connection = await amqp.connect(this.URL);
      return await conn.createChannel();
    } catch (err) {
      console.error("Connection to RabbitMQ failed:", err);
      throw new Error("Connection to RabbitMQ failed.");
    }
  }

  private async createQueue(channel: Channel, queue: string): Promise<Channel> {
    try {
      await channel.assertQueue(queue, { durable: true });
      return channel;
    } catch (err) {
      console.error(`Failed to assert queue [${queue}]:`, err);
      throw new Error(`Queue creation failed for [${queue}].`);
    }
  }

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
      console.error("Error in sendPubSub:", err);
    }
  }

  async sendRPC(message: IMessagerAccess): Promise<IResponseAccessResponse> {
    const timeout = Number(process.env.RABBIT_TIMEOUT) || 5000;
    const correlationId = uuidv4();

    try {
      const conn = await amqp.connect(this.URL);
      const ch = await conn.createChannel();

      await ch.assertQueue(message.queue, { durable: true });
      const q = await ch.assertQueue("", { exclusive: true });

      return await new Promise((resolve, reject) => {
        let isResponded = false;

        const timer = setTimeout(() => {
          if (!isResponded) {
            conn.close();
            reject(new Error("RPC response timeout."));
          }
        }, timeout);

        ch.consume(
          q.queue,
          (msg) => {
            if (msg?.properties.correlationId === correlationId) {
              clearTimeout(timer);
              conn.close();
              isResponded = true;
              resolve(this.messageConvert(msg));
            }
          },
          { noAck: true }
        );

        ch.sendToQueue(
          message.queue,
          Buffer.from(JSON.stringify(message.message)),
          {
            correlationId,
            replyTo: q.queue,
          }
        );
      });
    } catch (err) {
      console.error("Failed to send RPC message:", err);
      return this.createErrorResponse("Failed to send RPC message", err);
    }
  }

  listenRPC(queue: string, callback: CallableFunction): void {
    this.connect()
      .then((channel) => this.createQueue(channel, queue))
      .then((ch) => {
        ch.consume(queue, async (msg: ConsumeMessage | null) => {
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
            ch.ack(msg);
          } catch (err) {
            console.error("Error processing RPC message:", err);
            ch.nack(msg, false, false);
          }
        });
      })
      .catch((err) => console.error("Failed to start RPC listener:", err));
  }

  private async responseCallRPC(params: {
    queue: string;
    replyTo: string;
    correlationId: string;
    response: IResponseAccessResponse;
  }): Promise<void> {
    try {
      const channel = await this.connect().then((ch) =>
        this.createQueue(ch, params.queue)
      );
      channel.sendToQueue(
        params.replyTo,
        Buffer.from(JSON.stringify(params.response)),
        { correlationId: params.correlationId }
      );
    } catch (err) {
      console.error("Failed to send RPC response:", err);
    }
  }

  private messageConvert(message: {
    content: Buffer;
  }): IResponseAccessResponse {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        code: typeof parsed.code === "number" ? parsed.code : 200,
        response: parsed,
      };
    } catch (error) {
      return this.createErrorResponse("Invalid JSON format in message", error);
    }
  }

  private messageConvertRequest(message: {
    content: Buffer;
  }): IMessagerAccessRequest {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        body: parsed,
        message: "Message parsed successfully",
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        body: null,
        message: `Invalid JSON (${errorMsg}): ${message.content.toString()}`,
      };
    }
  }

  private createErrorResponse(
    message: string,
    error: unknown
  ): IResponseAccessResponse {
    return {
      code: 500,
      response: {
        message,
        error:
          error instanceof Error ? error.stack ?? error.message : String(error),
      },
    };
  }
}
