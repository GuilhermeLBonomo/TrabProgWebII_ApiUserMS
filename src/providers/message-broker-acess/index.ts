/** @format */

import { IRouterMessageBroker } from "./implementations/imessager-broker-acess.interface";
import { RabbitMQ } from "./implementations/rabbit-mq/rabbit-mq.provider";
import { UserQueueRouter } from "./routers/user-queue";

const listQueuesListen: Array<IRouterMessageBroker> = [new UserQueueRouter()];

const app = {
  listen: (callback: CallableFunction) => {
    const messagerBrokerAccess = new RabbitMQ();
    listQueuesListen.forEach((queueListener) => {
      queueListener.handle(messagerBrokerAccess);
    });
    callback();
  },
};

export { app };
