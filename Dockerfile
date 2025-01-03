FROM oven/bun:latest

COPY package.json ./
COPY bun.lockb ./
COPY src ./src
COPY db ./db
COPY start.sh ./

RUN bun install --production
CMD [ "./start.sh" ]
