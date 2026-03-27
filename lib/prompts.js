export default {
    createBranch: {
        type: 'confirm',
        message: (context) => `Create release branch (${context['git-flow']['releasePrefix']}v${context['version']})?`,
        default: true,
    },
    runBranchPipelines: {
        type: 'confirm',
        message: (context) => `Run pipelines on '${context['git-flow']['developBranch']}' and '${context['git-flow']['masterBranch']}' branches?`,
        default: false,
    },
    runTagPipeline: {
        type: 'confirm',
        message: (context) => `Run pipeline on new tag (v${context['version']})?`,
        default: true,
    }
};
