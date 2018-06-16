# Quest Tracker Notification Service [![Build Status](https://travis-ci.org/emanguy/QuestTracker-NotificationService.svg?branch=master)](https://travis-ci.org/emanguy/QuestTracker-NotificationService)

This Node.js server contains the code for pushing quest updates to clients. Upon visiting the
page, the client will register with this server to receive quest update events and notifications.

It listens for several redis topics for new quests, quest updates, and quest removals before
sending those events to connected clients.

## Docker environment variables

 * `PROCESS_PORT` - the port to serve the node server on
 * `REDIS_URL` - The connection URL to the redis server which pushes quest update events
 * `REDIS_PASSWORD` - The password for the redis server we're connecting to