import { createInterface } from "readline";
import { stdin, stdout } from "process";
import { createServer } from "http";

/**
 * CLI-based HTTP server controller.
 * Developed by https://github.com/aydope
 */
class ServerController {
  /** @type {import("readline").Interface} */
  #readline;

  /** @type {import("http").Server|null} */
  #httpServer = null;

  /** @type {number} */
  #port = 3000;

  constructor() {
    this.#readline = createInterface({ input: stdin, output: stdout });

    // Handle readline close inside class
    this.#readline.on("close", () => {
      console.log("Exiting CLI...");
    });
  }

  /**
   * Prompt the user and get input.
   * @param {string} promptMessage - Message to show in CLI
   * @returns {Promise<string>} User input
   */
  #prompt(promptMessage) {
    return new Promise((resolve) =>
      this.#readline.question(promptMessage, resolve)
    );
  }

  /**
   * Create a new HTTP server.
   * @param {string} responseMessage - Message to respond with
   * @returns {import("http").Server}
   */
  #createHttpServer(responseMessage = "Hello World!") {
    return createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: responseMessage }));
    });
  }

  /**
   * Start the HTTP server.
   */
  async startServer() {
    if (this.#httpServer?.listening) {
      console.log("Server is already running.");
      return;
    }

    this.#httpServer = this.#httpServer || this.#createHttpServer();
    await new Promise((resolve, reject) => {
      this.#httpServer.listen(this.#port, () => {
        console.log(`Server started successfully on port ${this.#port}.`);
        resolve();
      });
      this.#httpServer.on("error", reject);
    });
  }

  /**
   * Stop the HTTP server.
   */
  async stopServer() {
    if (!this.#httpServer?.listening) {
      console.log("Server is not running.");
      return;
    }

    console.log("Stopping server...");
    await new Promise((resolve, reject) => {
      this.#httpServer.close((err) => {
        if (err) return reject(err);
        console.log("Server stopped successfully.");
        resolve();
      });
    });
  }

  /**
   * Restart the HTTP server.
   */
  async restartServer() {
    if (!this.#httpServer?.listening) {
      console.log("Server is not running. Please start it first.");
      return;
    }

    console.log("Restarting server...");
    await this.stopServer();
    this.#httpServer = this.#createHttpServer("Server restarted successfully!");
    await this.startServer();
  }

  /**
   * Close the CLI interface.
   */
  closeCLI() {
    this.#readline.close();
  }

  /**
   * Run the main CLI loop.
   */
  async runCLI() {
    let userInput = await this.#prompt(
      "Enter a command (start, stop, restart, exit): "
    );

    while (userInput.trim().toLowerCase() !== "exit") {
      switch (userInput.trim().toLowerCase()) {
        case "start":
          await this.startServer();
          break;
        case "stop":
          await this.stopServer();
          break;
        case "restart":
          await this.restartServer();
          break;
        default:
          console.log(
            "Invalid command. Available commands: start, stop, restart, exit."
          );
          break;
      }

      userInput = await this.#prompt("Enter your next command: ");
    }

    this.closeCLI();
  }
}

// Initialize and start CLI server controller
const serverController = new ServerController();
serverController.runCLI();
