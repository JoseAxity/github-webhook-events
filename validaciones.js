// validaciones.js

/**
 * Valida si la combinación de origen y destino es permitida para PRs.
 * @param {string} origen - Rama origen
 * @param {string} destino - Rama destino
 * @returns {boolean} true si la combinación es permitida
 */
export function isValidBranchCombination(origen, destino) {
  if (
    (/^revert.*/.test(origen) && destino === "develop") ||
    (/^revert.*/.test(origen) && destino === "staging") ||
    (/^revert.*/.test(origen) && destino === "main") ||
    (/^feature.*/.test(origen) && destino === "develop") ||
    (/^bugfix.*/.test(origen) && destino === "staging") ||
    (origen === "develop" && destino === "staging") ||
    (origen === "staging" && destino === "main") ||
    (/^hotfix.*/.test(origen) && destino === "main") ||
    (/^wip.*/.test(origen) && /^feature.*/.test(destino)) ||
    (/^cherryp.*/.test(origen) && destino === "staging") ||
    (/^cherryp.*/.test(origen) && destino === "main") ||
    (/^cherryp.*/.test(origen) && destino === "develop") ||
    (origen === "develop" && /^wip.*/.test(destino)) ||
    (origen === "develop" && /^feature.*/.test(destino))||
     (origen === "main" && /^wip.*/.test(destino)) ||
    (origen === "main" && /^feature.*/.test(destino)) ||
    (origen === "main" && /^hotfix.*/.test(destino)) ||
    (origen === "main" && /^bugfix.*/.test(destino)) ||
    (origen === "main" && destino === "staging") ||
    (origen === "main" && destino === "develop")
  ) {
    return true;
  }
  return false;
}
