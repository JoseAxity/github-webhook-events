// team.js
import axios from "axios";
import { DateTime } from "luxon";
import { getProjectsByNodeID } from "./app.js";

export async function sendTeamsNotification(pull_request, octokit, teamsWebhookUrl) {
  console.log("PR node_id:", pull_request.node_id);
  console.log("PR number:", pull_request.number);

  const projectNames = await getProjectsByNodeID(pull_request, octokit);

  const reviewers =
    pull_request.requested_reviewers?.map(r => r.login).join(", ") || "N/A";

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
          { name: "Branch:", value: `${pull_request.head.ref} → ${pull_request.base.ref}` },
          { name: "Revisores:", value: reviewers },
          { name: "Creado:", value: createdAtMX },
          {
            name: "Labels:",
            value:
              Array.isArray(pull_request.labels) && pull_request.labels.length > 0
                ? pull_request.labels.map(l => l.name).join(", ")
                : "N/A"
          },
          {
            name: "Proyectos:",
            value: Array.isArray(projectNames) && projectNames.length > 0
              ? projectNames.join(", ")
              : "PR sin Proyecto"
          }
        ],
        markdown: true
      }
    ],
    potentialAction: [
      { "@type": "OpenUri", name: "🔗 Ver Pull Request", targets: [{ os: "default", uri: pull_request.html_url }] },
      { "@type": "OpenUri", name: "📄 Ver Archivos", targets: [{ os: "default", uri: `${pull_request.html_url}/files` }] },
      { "@type": "OpenUri", name: "📜 Ver Commits", targets: [{ os: "default", uri: `${pull_request.html_url}/commits` }] }
    ]
  };

  try {
    await axios.post(teamsWebhookUrl, message);
    console.log(`✅ Teams enviado para PR: ${pull_request.number}`);
  } catch (err) {
    console.error("❌ Error enviando a Teams:", err.response?.data || err.message);
  }
}
