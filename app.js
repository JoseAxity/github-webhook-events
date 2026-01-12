import dotenv from "dotenv";
console.log('Cargando variables de entorno...');
import { App } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import axios from "axios";
import { DateTime } from "luxon"; // Agrega luxon
import { Octokit } from "@octokit/rest";
// Cargar variables de entorno
dotenv.config();

// ====== ENV VARS ======
const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKey = process.env.PRIVATE_KEY_PEM;  // <-- SIN ARCHIVO
const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;

// ====== OCTOKIT APP ======
const app = new App({
    appId,
    privateKey,
    webhooks: {
        secret: webhookSecret
    },
});

// ====== FUNCTIONS ======
async function getProjectsByNodeID(pull_request, octokit) {
  try {
    // Consulta con la app de GitHub usando el node_id del PR recibido
    const gqlApp = await octokit.request('POST /graphql', {
      query: `query($id: ID!) { node(id: $id) { ... on PullRequest { projectItems(first: 10) { nodes { project { title } } }}}}`,
      variables: { id: pull_request.node_id }
    });
    const projectNodesApp = gqlApp?.data?.data?.node?.projectItems?.nodes || [];
    const projectTitlesApp = projectNodesApp.map(n => n.project?.title).filter(Boolean);
    return projectTitlesApp;
  } catch (err) {
    console.error('❌ Error consultando projectItems.totalCount (curl style):', err?.response?.data || err.message);
    return [];
  }
}

// ====== HANDLER ======
async function handlePullRequestReopened({ payload, octokit}) {
  if(payload.repository.name.startsWith("ORA_") || payload.repository.name.startsWith("WF_")) {
    console.log(`PR Reabierta: #${payload.pull_request.number}`);
    const repoName = payload.repository.name;
    console.log(`Repo: ${repoName}`);    
    const projectNames = await getProjectsByNodeID(payload.pull_request, octokit);
    if (payload.pull_request.labels.length === 0 && projectNames.length === 0) {
        const comment = "Por favor, asegúrate de asignar los labels y proyectos necesarios para una mejor gestión.";
        await createCommentByPR(payload, octokit, comment);
    }else if (payload.pull_request.labels.length === 0) {
        const comment = "Por favor, asigna los labels necesarios para una mejor gestión.";
        await createCommentByPR(payload, octokit, comment);
    } else if (projectNames.length === 0) {
        const comment = "Por favor, asigna los proyectos necesarios para una mejor gestión.";
        await createCommentByPR(payload, octokit, comment);
    }    
    sendTeamsNotification(payload.pull_request, octokit)
  }
}

async function handlePullRequestOpened({ payload, octokit}) {
  if(payload.repository.name.startsWith("ORA_") || payload.repository.name.startsWith("WF_")) {
    console.log(`PR abierta: #${payload.pull_request.number}`);
    const repoName = payload.repository.name;
    console.log(`Repo: ${repoName}`);     
    const projectNames = await getProjectsByNodeID(payload.pull_request, octokit);
    if (payload.pull_request.labels.length === 0 && projectNames.length === 0) {
        const comment = "Por favor, asegúrate de asignar los labels y proyectos necesarios para una mejor gestión.";
        await createCommentByPR(payload, octokit, comment);
    }else if (payload.pull_request.labels.length === 0) {
        const comment = "Por favor, asigna los labels necesarios para una mejor gestión.";
        await createCommentByPR(payload, octokit, comment);
    } else if (projectNames.length === 0) {
        const comment = "Por favor, asigna los proyectos necesarios para una mejor gestión.";
        await createCommentByPR(payload, octokit, comment);
    }    
    sendTeamsNotification(payload.pull_request, octokit)
  }
}

async function handlePullRequestClosed({ payload, octokit }) {
  if(payload.repository.name.startsWith("ORA_") || payload.repository.name.startsWith("WF_")) {
    console.log(`PR cerrada: #${payload.pull_request.number}`);
    const repoName = payload.repository.name;
    console.log(`Repo: ${repoName}`);    
    sendTeamsNotification(payload.pull_request, octokit)
  }
}

async function createCommentByPR( payload, octokit, message) {
  try {
        await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.pull_request.number,
        body: message,
        headers: {
            "x-github-api-version": "2022-11-28",
        },
        });
        console.log(`✅ Comentario creado en el PR: ${payload.pull_request.number}`);
  } catch (error) {
    if (error.response) {
    console.error(`Error creating comment! Status: ${error.response.status}. Message: ${error.response.data.message}`)
    }
    console.error(error)
  }
}

// Enviar notificación a Microsoft Teams
async function sendTeamsNotification(pull_request, octokit) {
  console.log("PR node_id:", pull_request.node_id);
  console.log("PR number:", pull_request.number);

  const projectNames = await getProjectsByNodeID(pull_request, octokit);
  // -----------------------------
  //  DATA FOR TEAMS
  // -----------------------------
  const reviewers =
    pull_request.requested_reviewers?.map(r => r.login).join(", ") ||
    "N/A";

  const avatar =
    pull_request.user?.avatar_url ||
    "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";

  let themeColor = "0078D7";
  let activityTitle = `🚀 **Nuevo Pull Request Creado**`;

  if (pull_request.state === "closed" && pull_request.merged) {
    themeColor = "28A745";
    activityTitle = `🎉 **Pull Request mergeado**`;
  } else if (pull_request.state === "closed") {
    themeColor = "D83B01";
    activityTitle = `❌ **Pull Request cerrado sin mergear**`;
  }

  const createdAtMX = DateTime
    .fromISO(pull_request.created_at, { zone: "utc" })
    .setZone("America/Mexico_City")
    .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);

  const message = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor,
    summary: `Pull Request en ${pull_request.base.repo.name}`,
    sections: [
      {
        activityTitle,
        activitySubtitle: `Repositorio: **${pull_request.base.repo.name}**`,
        activityImage: avatar,
        facts: [
          { name: "Título:", value: pull_request.title },
          { name: "Autor:", value: pull_request.user.login },
          {
            name: "Branch:",
            value: `${pull_request.head.ref} → ${pull_request.base.ref}`
          },
          { name: "Revisores:", value: reviewers },
          { name: "Creado:", value: createdAtMX },
          {
            name: "Labels:",
            value:
              Array.isArray(pull_request.labels) &&
              pull_request.labels.length > 0
                ? pull_request.labels.map(l => l.name).join(", ")
                : "N/A"
          },
          { name: "Proyectos:", value: Array.isArray(projectNames) && projectNames.length > 0 ? projectNames.join(", ") : "PR sin Proyecto" }
        ],
        markdown: true
      }
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "🔗 Ver Pull Request",
        targets: [{ os: "default", uri: pull_request.html_url }]
      },
      {
        "@type": "OpenUri",
        name: "📄 Ver Archivos",
        targets: [{ os: "default", uri: `${pull_request.html_url}/files` }]
      },
      {
        "@type": "OpenUri",
        name: "📜 Ver Commits",
        targets: [{ os: "default", uri: `${pull_request.html_url}/commits` }]
      }
    ]
  };

  // -----------------------------
  //  SEND TO TEAMS
  // -----------------------------
  try {
    await axios.post(teamsWebhookUrl, message);
    console.log(`✅ Teams enviado para PR: ${pull_request.number}`);
  } catch (err) {
    console.error(
      "❌ Error enviando a Teams:",
      err.response?.data || err.message
    );
  }
}

// ====== EVENTS ======
app.webhooks.on("pull_request.opened", handlePullRequestOpened);
app.webhooks.on("pull_request.closed", handlePullRequestClosed);
app.webhooks.on("pull_request.reopened", handlePullRequestReopened);

app.webhooks.onError((error) => {
    console.error("Webhook error:", error);
});

// ====== SERVER ======
const path = "/api/webhook";

// Render asigna el puerto en PORT
const port = process.env.PORT || 3000;
const host = "0.0.0.0";

const middleware = createNodeMiddleware(app.webhooks, { path });

http.createServer(middleware).listen(port, host, () => {
    console.log(`🚀 GitHub App Webhook escuchando en: http://${host}:${port}${path}`);
});
