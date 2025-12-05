import { createInterface } from "readline";
import { stdout as output, stdin as input } from "process";
import { createServer } from "http";
import { EventEmitter } from "events";

let server = null;

const rl = createInterface({ input, output });
const createNewServer = (message = "Hello World!") => {
  return createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ message }));
  });
};

server = createNewServer();

const emitter = new EventEmitter();

emitter.on("startServer", () => {
  if (server.listening) {
    console.log("The server is already active.");
    question("Enter your next command: ");
    return;
  }
  server.listen(3000, () => {
    console.log(`The server is now running on port ${server.address().port}`);
    question("Enter your next command: ");
  });

  return;
});

emitter.on("stopServer", () => {
  if (!server.listening) {
    console.log("The server is currently not active.");
    question("Enter your next command: ");
    return;
  }

  console.log("Shutting down server...");
  server.close((err) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log("Server has been successfully stopped.");
    question("Enter your next command: ");
  });
  return;
});

emitter.on("restartServer", () => {
  if (!server.listening) {
    console.log("Server has been successfully stopped.");
    question("Enter your next command: ");
    return;
  }

  console.log("Shutting down the server...");
  server.close((err) => {
    if (err) {
      console.log(err);
      return;
    }

    server = createNewServer("Server restarted with updated content!");

    console.log("Server has been stopped.");
    console.log("Reinitializing server...");
    server.listen(3000, () => {
      console.log(
        `Server restarted and running on port ${server.address().port}`
      );
      question("Provide your next command: ");
    });
  });
  return;
});

emitter.on("closeReadLine", () => {
  rl.close();
  return;
});

const question = (query) => {
  rl.setPrompt(query);
  rl.prompt();
};

question("Enter a command to execute: ");

rl.on("line", (chunks) => {
  if (chunks === "exit") {
    emitter.emit("closeReadLine");
    return;
  }

  if (chunks === "start") {
    emitter.emit("startServer");
    return;
  }

  if (chunks === "stop") {
    emitter.emit("stopServer");
    return;
  }

  if (chunks === "restart") {
    emitter.emit("restartServer");
    return;
  }

  try {
    const executable = eval(chunks);
    if (executable || [0, NaN, undefined, null].includes(executable)) {
      console.log(`${chunks}: ${executable}`);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    question("Provide your next command: ");
  }

  question("Provide your next command: ");
});

rl.on("close", () => {
  console.log("Exiting...");
});
