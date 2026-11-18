FROM node:22.14.0-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.3 --activate

FROM base AS tools
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .sequelizerc ./
RUN pnpm install --frozen-lockfile
COPY app.js ./
COPY src ./src
COPY public ./public
RUN pnpm exec tailwindcss -i ./public/css/input.css -o ./public/css/style.css --minify

FROM base AS production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY app.js ./
COPY src ./src
COPY public ./public
COPY --from=tools /app/public/css/style.css ./public/css/style.css

EXPOSE 3000
CMD ["node", "app.js"]
