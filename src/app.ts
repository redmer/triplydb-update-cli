import App from "@triply/triplydb";
import type { Account } from "@triply/triplydb/Account.js";

export const TRIPLYDB_TOKEN = "TRIPLYDB_TOKEN" as const;

/** A utility class that collects the TriplyDB token */
export class AppProxy {
  #token?: string;
  #app: App;

  constructor(token?: string) {
    this.#token = token;
  }

  async qualifiedName(arg1: string): Promise<[Account, string]> {
    const slashCount = arg1.split("/").length - 1;
    if (slashCount > 1) throw TypeError(`Name '${arg1}' is not a qualified dataset name `);

    let accountName: string, datasetName: string;
    const Triply = this.triplyApp;

    if (slashCount == 1) [accountName, datasetName] = arg1.split("/");
    if (slashCount == 0) [accountName, datasetName] = [undefined, arg1];

    return [await Triply.getAccount(accountName), datasetName];
  }

  get token() {
    if (this.#token == undefined) {
      this.#token = process.env[TRIPLYDB_TOKEN];
      if (this.#token && this.#token.length < 1)
        throw TypeError(`No token: supply with --token or as env var ${TRIPLYDB_TOKEN}`);
    }
    return this.#token;
  }

  get triplyApp(): App {
    if (this.#app == undefined) this.#app = App.get({ token: this.token });

    return this.#app;
  }
}
