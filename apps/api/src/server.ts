import { Server } from "socket.io";
import { buildApp } from "./app.js";
import { clientOrigins, env } from "./config/env.js";
import { syncPlaybackSchedule } from "./services/content.service.js";
import { cleanupOldMessages } from "./services/message.service.js";
import { registerSocket } from "./socket/index.js";

const app = await buildApp();

const io = new Server(app.server, {
  cors: {
    origin: clientOrigins,
    credentials: true
  },
  transports: ["websocket", "polling"]
});

registerSocket(io);

const playbackChannel = (roomId: string) => `room:${roomId}`;

const runCleanup = () => {
  try {
    const result = cleanupOldMessages();
    if (result.deleted > 0) {
      app.log.info(result, "old messages cleaned");
    }
  } catch (error) {
    app.log.error(error, "message cleanup failed");
  }
};

setInterval(runCleanup, 60 * 60 * 1000).unref();
runCleanup();

const runPlaybackSchedule = () => {
  try {
    for (const playback of syncPlaybackSchedule()) {
      io.to(playbackChannel(playback.roomId)).emit("player:update", { playback });
    }
  } catch (error) {
    app.log.error(error, "playback schedule sync failed");
  }
};

setInterval(runPlaybackSchedule, 5000).unref();

await app.listen({ host: env.HOST, port: env.PORT });
app.log.info(`API pronta em ${env.PUBLIC_API_URL}`);
