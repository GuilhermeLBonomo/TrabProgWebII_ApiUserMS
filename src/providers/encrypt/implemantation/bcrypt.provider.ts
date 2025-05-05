import * as bcrypt from "bcrypt";
import { IEncrypt } from "../iencrypt.interface";

export class BcryptProvider implements IEncrypt {
  private readonly saltRounds: number;

  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  /**
   * Gera um hash seguro para a senha fornecida.
   * @param password Senha em texto plano.
   * @returns Hash da senha.
   */
  async hashPassword(password: string): Promise<string> {
    if (!password) {
      throw new Error("Password must not be empty.");
    }
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compara uma senha em texto com um hash armazenado.
   * @param password Senha fornecida pelo usuário.
   * @param hash Hash previamente armazenado.
   * @returns true se coincidirem; false caso contrário.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      throw new Error("Password and hash must be provided.");
    }
    return await bcrypt.compare(password, hash);
  }
}
