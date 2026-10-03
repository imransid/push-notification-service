FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
RUN yarn build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn workspaces focus --production
COPY --from=build /app/dist ./dist
CMD ["node", "dist/main.js"]
