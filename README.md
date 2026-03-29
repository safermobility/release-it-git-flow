# release-it-git-flow

A release-it plugin that does git-flow operations.

![NPM Version](https://img.shields.io/npm/v/%40safermobility%2Frelease-it-git-flow)

## Setup

```sh
npm install --save-dev @safermobility/release-it-git-flow
```

In release-it config, **disable the built-in `git.tag` and `git.push` options**, set the required starting branch to `develop` (or your equivalent), and enable this plugin:

```json
{
    "$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
    "git": {
        "requireBranch": "develop",
        "tag": false,
        "push": false
    },
    "plugins": {
        "@safermobility/release-it-git-flow": {
            "developBranch": "develop",
            "masterBranch": "master",
            "releasePrefix": "release/"
        }
    }
}
```
