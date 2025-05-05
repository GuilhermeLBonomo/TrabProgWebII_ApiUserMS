import * as bcrypt from "bcrypt";
import { IEncrypt } from "../iencrypt.interface";

export class BcryptProvider implements IEncrypt {
  private readonly saltRounds: number;

  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  /**
   * Gera um hash seguro para a senha fornecida.
   *
   * @param password Senha em texto plano.
   * @returns {Promise<string>} Hash da senha.
   * @throws {Error} Se a senha for inválida ou ocorrer erro na geração.
   */
  async hashPassword(password: string): Promise<string> {
    if (!password) {
      throw new Error("Password must not be empty.");
    }

    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      console.error("Erro ao gerar hash da senha:", error);
      throw new Error("Failed to hash password.");
    }
  }

  /**
   * Compara uma senha com um hash armazenado.
   *
   * @param password Senha fornecida pelo usuário.
   * @param hash Hash previamente armazenado.
   * @returns {Promise<boolean>} true se coincidem, false caso contrário.
   * @throws {Error} Se os parâmetros forem inválidos ou ocorrer erro na comparação.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      throw new Error("Password and hash must be provided.");
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error("Erro ao comparar senha e hash:", error);
      throw new Error("Failed to compare password and hash.");
    }
  }
}
