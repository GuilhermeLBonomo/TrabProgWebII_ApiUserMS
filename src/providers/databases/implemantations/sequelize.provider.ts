import { Sequelize } from "sequelize-typescript";
import dotenv from "dotenv";
import { UserEntity } from "../../../models/user/user.entity";

dotenv.config();

const requiredEnv = ["DB_NAME", "DB_DIALECT", "DB_HOST", "DB_USER", "DB_PASSWORD"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

const sequelizeConnection = new Sequelize({
  database: process.env.DB_NAME,
  dialect: process.env.DB_DIALECT as "mysql",
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.DB_LOGGING === "true" ? console.log : false,
  pool: {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    min: Number(process.env.DB_POOL_MIN ?? 1),
  },
  models: [UserEntity],
});

(async () => {
  try {
    await sequelizeConnection.authenticate();
    console.log("Banco conectado com sucesso.");
    await sequelizeConnection.sync({ alter: true });
    console.log("Banco sincronizado com sucesso (alter=true).");
  } catch (error) {
    console.error("Erro ao conectar com o banco:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
})();

export { sequelizeConnection };
