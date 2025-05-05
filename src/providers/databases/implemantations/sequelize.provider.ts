import { Sequelize } from "sequelize-typescript";
import dotenv from "dotenv";
import { UserEntity } from "../../../models/user/user.entity";
dotenv.config();
// docker exec -it swm-postgres psql -U postgres
// CREATE DATABASE mms_user;
// GRANT ALL PRIVILEGES ON DATABASE mms_user TO postgres;
// curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Alice","email":"alice@example.com","password":"secure123","cellPhone":"1234567890"}'
//
const sequelizeConnection = new Sequelize({
  database: process.env.DB_NAME,
  dialect: process.env.DB_DIALECT as "postgres",
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false,
  pool: {
    max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 5,
    min: process.env.DB_POOL_MIN ? Number(process.env.DB_POOL_MIN) : 1,
  },
  models: [UserEntity],
});

sequelizeConnection
  .sync({ alter: true })
  .then(() => {
    console.log("Banco de dados sincronizado (alter).");
  })
  .catch((err) => {
    console.error("Erro ao sincronizar com o banco de dados:", err);
  });

export { sequelizeConnection };
