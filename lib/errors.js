export class BranchMissingError extends Error {
    constructor(name, type) {
        super(`Branch '${name}' (${type}) is missing.`);
    }
}

export class BranchNotUpToDateError extends Error {
    constructor(name) {
        super(`Branch '${name}' is not up-to-date with the server's branch. Run \`git pull\` and try again.`);
    }
}

export class ConfigConflictError extends Error {
    constructor(name) {
        super(`Configuration '${name}' conflicts with the git-flow plugin and must be disabled.`);
    }
}
