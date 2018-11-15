# Quest Tracker Notification Service [![Build Status](https://travis-ci.org/emanguy/QuestTracker-NotificationService.svg?branch=master)](https://travis-ci.org/emanguy/QuestTracker-NotificationService)

This Node.js server contains the code for pushing quest updates to clients. Upon visiting the
page, the client will register with this server to receive quest update events and notifications.

It listens for several redis topics for new quests, quest updates, and quest removals before
sending those events to connected clients.

## Docker environment variables

 * `PROCESS_PORT` - the port to serve the node server on
 * `REDIS_URL` - The connection URL to the redis server which pushes quest update events
 * `REDIS_PASSWORD` - The password for the redis server we're connecting to
 * `NODE_ENV` - Standard node environment variable.

## Local testing

The developer recommends setting up the Frontend API via the [instructions](https://www.github.com/emanguy/QuestTracker-FrontendApi#local-testing) there.
That way all dependent services will already be set up. Be sure to make yourself a `.env` file to provide for any
environment variables that the application complains about missing on startup.

Once the server starts up, go ahead and open [sample.html](sample.html). This page will continually write a list of received
messages fron the push notification service and also display native notifications via the browser API. Messages should appear
whenever a create, update, or delete operation occurs on a quest/objective on the Frontend API server.