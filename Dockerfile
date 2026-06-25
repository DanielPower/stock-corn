# Use a Node.js Alpine image for the builder stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# HACK Workaround for the build failing if no database
# Please fix soon
RUN DATABASE_URL=sqlite:db.sqlite3 npm exec dbmate -- up
RUN DATABASE_PATH=db.sqlite3 npm run build

RUN npm prune --production

# Use another Node.js Alpine image for the final stage
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
COPY db/migrations db/migrations
COPY entrypoint.sh .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "sh", "entrypoint.sh" ]
