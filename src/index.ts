import "reflect-metadata";

import "./providers/databases";
import { app } from "./providers/message-broker-acess";

app.listen(() => console.log("Listen Messager broker is running..."));
