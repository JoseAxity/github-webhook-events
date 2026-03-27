import dotenv from "dotenv";
import { isValidBranchCombination } from "./validaciones.js";
import { sendTeamsNotification } from "./teams.js";
import { cancelWorkflowsForPR } from "./cancelacion.js";
import { createCommentByPR, getProjectsByNodeID, createLabel, assignPRLabel, changePRState } from "./github.js";
console.log('Cargando variables de entorno...');
import { App } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import express from "express";

// ================= ENV =================
dotenv.config();

const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKey = process.env.PRIVATE_KEY_PEM;
const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;

// ================= GITHUB APP =================
const githubApp = new App({
  appId,
  privateKey,
  webhooks: {
    secret: webhookSecret
  },
});



async function handlePullRequestReopened({ payload, octokit }) {
  if (payload.repository.name.startsWith("ORA_") || payload.repository.name.startsWith("WF_")) {
    console.log(`PR Reabierta: #${payload.pull_request.number}`);
    const projectNames = await getProjectsByNodeID(payload.pull_request, octokit);

    if (payload.pull_request.labels.length === 0 && projectNames.length === 0) {
      await createCommentByPR(payload, octokit, "Por favor, asegúrate de asignar los labels y proyectos necesarios para una mejor gestión.");
    } else if (payload.pull_request.labels.length === 0) {
      await createCommentByPR(payload, octokit, "Por favor, asigna los labels necesarios para una mejor gestión.");
    } else if (projectNames.length === 0) {
      await createCommentByPR(payload, octokit, "Por favor, asigna los proyectos necesarios para una mejor gestión.");
    }

    await sendTeamsNotification(payload.pull_request, octokit, teamsWebhookUrl);
  }
}

async function handlePullRequestOpened({ payload, octokit }) {
  if (payload.repository.name.startsWith("ORA_") || payload.repository.name.startsWith("WF_")) {
    console.log(`******** inicia handlePullRequestOpened********`);
    console.log(`Repositorio: #${payload.repository.name}`);
    // Si el body o los labels contienen 'skip-scan', omitir validación y notificación
    const hasSkipScanLabel = Array.isArray(payload.pull_request.labels) && payload.pull_request.labels.some(l => l.name === "skip-scan");
    if ((payload.pull_request.body && payload.pull_request.body.includes("skip-scan")) || hasSkipScanLabel) {
      console.log(`PR #${payload.pull_request.number} contiene 'skip-scan' (en body o label), omitiendo validacion y notificacion por que es una homologacion de ramas.`);
      return;
    } else {
      console.log(`PR abierta: #${payload.pull_request.number}`);
      const projectNames = await getProjectsByNodeID(payload.pull_request, octokit);

      const origen = payload.pull_request.base?.ref;
      const destino = payload.pull_request.head?.ref;
      console.log(`Origen: ${origen}, Destino: ${destino}`);

      // Validar combinaciones permitidas usando función externa
      const allowed = isValidBranchCombination(origen, destino);
      if (!allowed) {
        // Necesito cancelar los actions que lanzo la creacion del pr
        await cancelWorkflowsForPR(octokit, payload);
        await createLabel(payload, octokit, "invalid-pr", "ff0000", "Pull Request inválido");
        await assignPRLabel(payload, octokit, "invalid-pr");
        await changePRState(payload, octokit, "closed");        
        await createCommentByPR(payload, octokit, "Este Pull Request ha sido cerrado automáticamente porque no cumple con las reglas del branching.");
        await sendTeamsNotification(payload.pull_request, octokit, teamsWebhookUrl);
        return;
      }

      if (payload.pull_request.labels.length === 0 && projectNames.length === 0) {
        await createCommentByPR(payload, octokit, "Por favor, asegúrate de asignar los labels y proyectos necesarios para una mejor gestión.");
      } else if (payload.pull_request.labels.length === 0) {
        await createCommentByPR(payload, octokit, "Por favor, asigna los labels necesarios para una mejor gestión.");
      } else if (projectNames.length === 0) {
        await createCommentByPR(payload, octokit, "Por favor, asigna los proyectos necesarios para una mejor gestión.");
      }

      await sendTeamsNotification(payload.pull_request, octokit, teamsWebhookUrl);
    }
    console.log(`******** termina handlePullRequestOpened********`);
  }
}

async function handlePullRequestClosed({ payload, octokit }) {
  if (payload.repository.name.startsWith("ORA_") || payload.repository.name.startsWith("WF_")) {
    console.log(`******** inicia handlePullRequestClosed********`);
    console.log(`Repositorio: #${payload.repository.name}`);
    const hasSkipScanLabel = Array.isArray(payload.pull_request.labels) && payload.pull_request.labels.some(l => l.name === "skip-scan");
    if ((payload.pull_request.body && payload.pull_request.body.includes("skip-scan")) || hasSkipScanLabel) {
      console.log(`PR #${payload.pull_request.number} contiene 'skip-scan' (en body o label), omitiendo validacion y notificacion por que es una homologacion de ramas.`);
      return;
    } else {
      console.log(`PR cerrada: #${payload.pull_request.number}`);
      sendTeamsNotification(payload.pull_request, octokit, teamsWebhookUrl);
    }
    console.log(`******** termina handlePullRequestClosed********`);
  }
}

// ================= EVENTS =================
githubApp.webhooks.on("pull_request.opened", handlePullRequestOpened);
githubApp.webhooks.on("pull_request.closed", handlePullRequestClosed);
githubApp.webhooks.on("pull_request.reopened", handlePullRequestReopened);

githubApp.webhooks.onError((error) => {
  console.error("Webhook error:", error);
});

// ================= EXPRESS SERVER =================
const WEBHOOK_PATH = "/api/webhook";
const port = process.env.PORT || 3000;
const host = "0.0.0.0";

const server = express();

// Webhook endpoint
server.use(
  createNodeMiddleware(githubApp.webhooks, {
    path: WEBHOOK_PATH
  })
);

// Root healthcheck
server.get("/", (req, res) => {
  res.send("Webhook used by SCM team engineering Backoffice, author Jose Toledano  🚀 v5.0.0");
});

server.listen(port, host, () => {
  console.log(`🚀 GitHub App Webhook escuchando en: http://${host}:${port}${WEBHOOK_PATH}`);
});
