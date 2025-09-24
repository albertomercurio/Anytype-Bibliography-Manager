import express, { Express } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import http from "http";
import chalk from "chalk";
import { isValidDOI } from "../utils/text-utils";
import { ConfigManager } from "../core/config-manager";
import { BibliographyManager } from "../core/bibliography-manager";

export interface DevServer {
  app: Express;
  server: http.Server;
  port: number;
  stop: () => Promise<void>;
}

// TODO: Avoid code duplication with cli/index.ts
function ensureConfigured(): void {
  const configManager = new ConfigManager();
  if (!configManager.isConfigured()) {
    console.error(chalk.red("❌ Configuration not found."));
    console.log(
      chalk.yellow(
        'Please run "anytype-bib setup" first to configure your Anytype connection.'
      )
    );
    process.exit(1);
  }
}

export function startServer(): DevServer {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Endpoint to add a DOI from a web page
  app.post("/add", async (req, res) => {
    const doi = req.body.doi;

    if (!isValidDOI(doi)) {
      console.warn(
        chalk.yellow(`⚠️ Received a request to add a malformed DOI: ${doi}`)
      );
      res.status(400).json({ error: "Malformed DOI" });
      return;
    }

    console.log(`📥 Received request to add DOI: ${doi}`);

    // TODO: Avoid code duplication with cli/index.ts
    try {
      ensureConfigured();

      const manager = new BibliographyManager();
      await manager.processReference(doi);
      console.log(chalk.green(`\n✅ Successfully added DOI: ${doi}`));
      res.json({ message: "DOI added successfully" });
    } catch (error: any) {
      console.error(
        chalk.red(`\n❌ Error processing DOI ${doi}: ${error.message}`)
      );
      res.status(500).json({ error: "Failed to add DOI" });
    }
  });


   // Start the server on localhost:44556
  const server = app.listen(44556, "127.0.0.1", () => {
    console.log(
      `🚀 Server running at http://127.0.0.1:44556/ (Press CTRL+C to stop)`
    );
  });

  // Handle graceful shutdown
  const gracefulShutdown = () => {
    console.log(chalk.yellow('\n🛑 Received shutdown signal, closing server...'));
    server.close(() => {
      console.log(chalk.green('✅ Server closed successfully'));
      process.exit(0);
    });
  };

  // Handle Ctrl+C and other termination signals
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  return {
    app: app,
    server: server,
    port: 44556,
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((err?: Error) => (err ? reject(err) : resolve()));
      }),
  };
}
