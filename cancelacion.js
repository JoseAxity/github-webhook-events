export async function cancelWorkflowsForPR(octokit, payload) {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;

  console.log(`⛔ Buscando workflows para cancelar en PR #${prNumber}...`);

  // Reintentos para agarrar runs que arrancan tarde
  const maxRetries = 6;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/actions/runs",
        {
          owner,
          repo,
          event: "pull_request",
          per_page: 10,
        }
      );

      const activeRuns = data.workflow_runs.filter(run =>
        run.pull_requests.some(pr => pr.number === prNumber) &&
        (run.status === "queued" || run.status === "in_progress")
      );

      if (activeRuns.length === 0) {
        console.log(`✅ No hay workflows activos (intento ${attempt})`);
      }

      for (const run of activeRuns) {
        console.log(`⛔ Cancelando run ${run.id} (${run.name})`);

        try {
          await octokit.request(
            "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel",
            {
              owner,
              repo,
              run_id: run.id,
            }
          );
        } catch (err) {
          console.error(`Error cancelando run ${run.id}:`, err.message);
        }
      }

      // Esperar antes del siguiente intento
      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, delayMs));
      }

    } catch (error) {
      console.error("Error consultando workflows:", error.message);
    }
  }

  console.log(`🚀 Finalizó proceso de cancelación para PR #${prNumber}`);
}