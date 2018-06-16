FROM node:8-alpine

ADD types ./types
ADD package.json yarn.lock tsconfig.json ./
ADD src ./src

RUN yarn install && \
    yarn run build
CMD yarn run start