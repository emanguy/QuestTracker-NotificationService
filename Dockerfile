FROM node:8-alpine

ADD types ./types
ADD package.json yarn.lock tsconfig.json ./
ADD src ./src
ENV NODE_ENV=production

RUN yarn install && \
    yarn run build
CMD yarn run start