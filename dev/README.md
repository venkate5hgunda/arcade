# Development utilities

Keep development-only tooling here; browser game modules belong in `games/`
and shared runtime code in `js/`. This directory is not publicly served.

- `serve.py`: dependency-free local web server; blocks credentials, hidden
  files and development data. Run `npm start`.
- `movies/`: [movie catalog tooling and operating guide](movies/README.md).
  Immutable input data lives in `sources/`, reviewed annotations in `editorial/`,
  and generated SQLite/cache/export artifacts in ignored `.local/`.

Run `npm run movies:build` to rebuild from local data, or
`python3 -m dev.movies --help` for provider hydration and discovery options.
Run `npm run test:movies` for the movie pipeline tests.
Run `npm run movies:annotate -- prepare --limit 5` to prepare offline LLM
annotation requests; the movie guide documents the provider-neutral adapter,
separate review pass, explicit promotion and remaining provider-integration work.
