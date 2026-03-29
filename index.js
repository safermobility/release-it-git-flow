import { Plugin } from 'release-it';
import { BranchMissingError, BranchNotUpToDateError, ConfigConflictError } from './lib/errors.js';
import prompts from './lib/prompts.js';

export const defaults = {
    remoteName: 'origin',
    developBranch: 'develop',
    masterBranch: 'master',
    releasePrefix: 'release/',
    ciSkipMaster: true,
    ciSkipDevelop: true,
    fetch: true,
    push: true,
};

const readOnlyOpts = {options: { write: false } };

export default class GitFlowPlugin extends Plugin {
    constructor(config) {
        const {namespace, options} = config;
        options[namespace] = Object.assign({}, defaults, options[namespace]);
        super(config);
        this.registerPrompts(prompts);
    }

    async init() {
        await super.init();

        // This plugin and the built-in git plugin's `tag` and `push` operations
        // conflict with each other, so make sure the built-in ones are disabled
        const context = this.config.getContext();
        if (context.git.tag) {
            throw new ConfigConflictError('git.tag');
        }
        if (context.git.push) {
            throw new ConfigConflictError('git.push');
        }

        const developBranch = this.options.developBranch;
        if (!(await this.branchExists(developBranch))) {
            throw new BranchMissingError(developBranch, 'developBranch');
        }

        const masterBranch = this.options.masterBranch;
        if (!(await this.branchExists(masterBranch))) {
            throw new BranchMissingError(masterBranch, 'masterBranch');
        }

        const remoteName = this.options.remoteName || 'origin';
        if (this.options.fetch) {
            // We don't want to automatically update local develop,
            // but we do want to automatically update local master.
            await this.fetch({ remoteName, developBranch });
            await this.fetch({ remoteName, masterBranch, update: true });
        }

        for (const branch of [developBranch, masterBranch]) {
            if (!(await this.isBranchUpToDate(branch, remoteName))) {
                throw new BranchNotUpToDateError(branch);
            }
        }
    }

    async beforeBump() {
        const context = this.config.getContext();
        const doIt = await this.step({
            task: async () => await this.exec(`git checkout -b release/v${context.version} develop`),
            label: 'git checkout release branch',
            prompt: 'createBranch',
        });
        if (doIt === false) {
            throw new Error('User cancelled release');
        }

        // We need to go back to the `develop` branch if the user cancels or something fails
        this.enableRollback();
    }

    async branchExists(name) {
        return this.exec('git for-each-ref --format="%(refname:short)" refs/heads/*', readOnlyOpts)
            .then((stdout) =>
                stdout.split('\n').includes(name),
            );
    }

    async fetch({ branchName, prune, remoteName, update }) {
        if (update && branchName) {
            return this.exec(`git fetch ${remoteName} ${branchName}:${branchName}`);
        }
        return this.exec(`git fetch ${remoteName} ${branchName ?? ''}${prune ? ' --prune' : ''}`);
    }

    async isBranchUpToDate(branchName, remoteName) {
        return (await this.exec(`git rev-list --count ${branchName}...${remoteName}/${branchName}`, readOnlyOpts)) == 0;
    }

    async rollback() {
        // unregister self to prevent double execution
        this.disableRollback();

        // TODO
    }

    enableRollback() {
        this.rollbackOnce = this.rollback.bind(this);
        process.on('SIGINT', this.rollbackOnce);
        process.on('exit', this.rollbackOnce);
    }

    disableRollback() {
        if (this.rollbackOnce) {
            process.removeListener('SIGINT', this.rollbackOnce);
            process.removeListener('exit', this.rollbackOnce);
        }
    }

    async afterRelease() {
        const context = this.config.getContext();
        const remoteName = this.options.remoteName || 'origin';
        const developBranch = this.options.developBranch || 'develop';
        const masterBranch = this.options.masterBranch || 'master';
        const releaseBranch = `${this.options.releasePrefix || 'release/'}v${context['version']}`;

        await this.spinner.show({
            task: async () => await this.exec(`git checkout ${masterBranch}`),
            label: 'Checkout master branch',
        });
        await this.spinner.show({
            task: async () => await this.exec(`git merge --no-ff ${releaseBranch}`),
            label: 'Merge release into master branch',
        });

        await this.spinner.show({
            task: async () => await this.exec(`git tag v${context.version}`),
            label: 'Create version tag',
        });

        await this.spinner.show({
            task: async () => await this.exec(`git checkout ${developBranch}`),
            label: 'Checkout develop branch',
        });
        await this.spinner.show({
            task: async () => await this.exec(`git merge --no-ff ${masterBranch}`),
            label: 'Merge master into develop branch',
        });

        await this.spinner.show({
            task: async () => await this.exec(`git branch -d ${releaseBranch}`),
            label: 'Delete release branch',
        });

        const pushedTag = await this.step({
            enabled: this.options.push,
            task: async () => await this.exec(`git push ${remoteName} v${context.version}`),
            label: 'Push tag',
            prompt: 'runTagPipeline',
        });
        if (pushedTag === false) {
            await this.spinner.show({
                enabled: this.options.push,
                task: async () => await this.exec(`git push ${remoteName} v${context.version} -o ci.skip`),
                label: 'Push tag (SKIP PIPELINE)',
            });
        }
        const pushedBranches = await this.step({
            enabled: this.options.push,
            task: async () => await this.exec(`git push ${remoteName} ${developBranch}`),
            label: 'Push develop branch',
            prompt: 'runBranchPipelines',
        });
        if (pushedBranches !== false) {
            await this.spinner.show({
                enabled: this.options.push,
                task: async () => await this.exec(`git push ${remoteName} ${masterBranch}`),
                label: 'Push master branch',
            });
        } else {
            await this.spinner.show({
                enabled: this.options.push,
                task: async () => await this.exec(`git push ${remoteName} ${developBranch} -o ci.skip`),
                label: 'Push develop branch (SKIP PIPELINE)',
            });
            await this.spinner.show({
                enabled: this.options.push,
                task: async () => await this.exec(`git push ${remoteName} ${masterBranch} -o ci.skip`),
                label: 'Push master branch (SKIP PIPELINE)',
            });
        }

        // On success, no rollback needed anymore
        this.disableRollback();
    }
}
