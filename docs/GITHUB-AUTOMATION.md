# GitHub write operations

GitHub writes are implemented as an approval-gated adapter. The adapter never receives a token from the model prompt; it reads `GITHUB_TOKEN` from the process environment at execution time.

Supported writes:

- create a pull request;
- add a comment to an issue or pull request.

The central supervisor must classify the operation as `yellow` or `red` and the human approval manager must approve it before the adapter is called. Repository deletion, branch protection changes, secret management and permission escalation are intentionally outside this adapter.

Use a fine-grained GitHub token with the minimum repository permissions required for the selected operation. Never commit the token to Git or project memory.
