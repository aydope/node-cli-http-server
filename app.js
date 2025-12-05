import { createInterface } from "readline";
import { stdout, stdin } from "process";
import { createServer } from "http";
import { EventEmitter } from "events";

const rl = createInterface({ input: stdin, output: stdout });

let server = null;
const createNewServer = (message = "Hello World!") => {
  return createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ message }));
  });
};

server = createNewServer();

const emitter = new EventEmitter();

const askQuestion = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const startServer = async () => {
  if (server.listening) {
    console.log("The server is already active.");
    return;
  }
  server.listen(3000, async () => {
    console.log(`The server is now running on port ${server.address().port}`);
    chunks = await askQuestion("Enter your next command: ");
  });
};

const stopServer = async () => {
  if (!server.listening) {
    console.log("The server is currently not active.");
    return;
  }

  console.log("Shutting down server...");
  server.close(async (err) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log("Server has been successfully stopped.");
    chunks = await askQuestion("Enter your next command: ");
  });
};

const restartServer = async () => {
  if (!server.listening) {
    console.log("The server is currently not active.");
    return;
  }

  console.log("Shutting down the server...");
  server.close((err) => {
    if (err) {
      console.log(err);
      return;
    }

    server = createNewServer("New message!");

    console.log("Server has been stopped.");
    console.log("Reinitializing server...");
    server.listen(3000, async () => {
      console.log(
        `Server restarted and running on port ${server.address().port}`
      );
      chunks = await askQuestion("Provide your next command: ");
    });
  });
};

const closeReadLine = () => rl.close();

emitter.on("startServer", startServer);
emitter.on("stopServer", stopServer);
emitter.on("restartServer", restartServer);
emitter.on("closeReadLine", closeReadLine);

const main = async () => {
  let chunks = await askQuestion("Enter a command to execute: ");

  while (chunks !== "exit") {
    switch (chunks) {
      case "start":
        emitter.emit("startServer");
        break;
      case "stop":
        emitter.emit("stopServer");
        break;
      case "restart":
        emitter.emit("restartServer");
        break;
      default:
        try {
          const executable = eval(chunks);
          if (executable || [0, NaN, undefined, null].includes(executable)) {
            console.log(`${chunks}: ${executable}`);
          }
        } catch (error) {
          console.log(`Error: ${error.message}`);
          chunks = await askQuestion("Provide your next command: ");
        }
        break;
    }

    chunks = await askQuestion("Provide your next command: ");
  }

  emitter.emit("closeReadLine");
};

rl.on("close", () => console.log("Exiting..."));

main();
