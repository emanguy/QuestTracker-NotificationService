FROM node:12-alpine as buildContainer

RUN mkdir -p /srv/
WORKDIR /srv/

COPY types ./types
COPY package.json yarn.lock tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production

RUN yarn install && \
    yarn run build

######################

FROM node:12-alpine

RUN mkdir -p /srv/
WORKDIR /srv/
COPY --from=buildContainer /srv/build/ /srv/build/
COPY --from=buildContainer /srv/node_modules/ /srv/node_modules/
ENV NODE_ENV=production
EXPOSE 80

CMD node build/index.js
