.PHONY: dev dev-seed dev-api dev-client install install-api install-client seed

# Run both dev servers together. Ctrl-C stops both — the trap kills every
# job in this recipe's process group on exit, so one doesn't linger after
# the other (or after Ctrl-C) with its port still held.
dev:
	@trap 'kill 0' EXIT INT TERM; \
	(cd backend-api && npm run dev) & \
	(cd frontend-client/react-ts && npm run dev) & \
	wait

## Reset/repopulate the database, then run both dev servers together.
## Plain `dev` is left alone so repeated runs don't wipe your data.
dev-seed: seed dev

## Run just the backend API dev server.
dev-api:
	cd backend-api && npm run dev

## Run just the frontend dev server.
dev-client:
	cd frontend-client/react-ts && npm run dev

## Install dependencies for both projects.
install: install-api install-client

install-api:
	cd backend-api && npm install

install-client:
	cd frontend-client/react-ts && npm install

## Reset and repopulate the local database with sample users/policies/claims.
## Requires a MongoDB instance reachable per backend-api/.env's MONGODB_URI.
seed:
	cd backend-api && npm run seed
