

/**
 * Crea un comentario en un Pull Request específico.
 * @param {object} payload - Objeto con información del evento de GitHub.
 * @param {object} octokit - Instancia autenticada de Octokit.
 * @param {string} message - Mensaje a publicar en el comentario.
 */
export async function createCommentByPR(payload, octokit, message) {
  try {
    await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      body: `> [!CAUTION]\n> ${message}`,
      headers: {
        "x-github-api-version": "2022-11-28",
      },
    });

    console.log(`✅ Comentario creado en el PR: ${payload.pull_request.number}`);

  } catch (error) {
    if (error.response) {
      console.error(`Error creating comment! Status: ${error.response.status}. Message: ${error.response.data.message}`);
    }
    console.error(error);
  }
}


/**
 * Obtiene los nombres de los proyectos asociados a un Pull Request por su node_id.
 * @param {object} pull_request - Objeto Pull Request de GitHub.
 * @param {object} octokit - Instancia autenticada de Octokit.
 * @returns {Promise<string[]>} - Lista de nombres de proyectos asociados.
 */
export async function getProjectsByNodeID(pull_request, octokit) {
  try {
    const gqlApp = await octokit.request('POST /graphql', {
      query: `query($id: ID!) { 
        node(id: $id) { 
          ... on PullRequest { 
            projectItems(first: 10) { 
              nodes { project { title } } 
            } 
          }
        }
      }`,
      variables: { id: pull_request.node_id }
    });

    const projectNodesApp = gqlApp?.data?.data?.node?.projectItems?.nodes || [];
    const projectTitlesApp = projectNodesApp.map(n => n.project?.title).filter(Boolean);
    return projectTitlesApp;

  } catch (err) {
    console.error('❌ Error consultando projectItems:', err?.response?.data || err.message);
    return [];
  }
}


/**
 * Crea un label en el repositorio si no existe.
 * @param {object} payload - Objeto con información del evento de GitHub.
 * @param {object} octokit - Instancia autenticada de Octokit.
 * @param {string} name - Nombre del label.
 * @param {string} color - Color del label en formato hexadecimal.
 * @param {string} description - Descripción del label.
 */
export async function createLabel(payload, octokit, name, color, description) {
    try {
        await octokit.request("POST /repos/{owner}/{repo}/labels", {
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        name,
        color,
        description
        });
    } catch (error) {
        if (error.response && error.response.status === 422) {
        console.log(`Label '${name}' ya existe en el repositorio.`);
        } else {
        console.error(`Error creando label '${name}':`, error);
        }
    }
}

export async function assignPRLabel(payload, octokit, labelName) {
    try {
        await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          issue_number: payload.pull_request.number,
          labels: [labelName]
        });
    } catch (error) {
        console.error(`Error asignando label '${labelName}' al PR #${payload.pull_request.number}:`, error);
    }
}

export async function changePRState(payload, octokit, newState) {
    try {
        await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
                  owner: payload.repository.owner.login,
                  repo: payload.repository.name,
                  pull_number: payload.pull_request.number,
                  state: newState
                });
    } catch (error) {
        console.error(`Error cambiando el estado del PR #${payload.pull_request.number}:`, error);
        return [];
    }
}