const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.PASSWORD);

mongoose.set({ strictQuery: false });
mongoose.connect(DB).then(() => console.log('DB connected'));

const app = require('./app');

const port = process.env.PORT || 3000;

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Server is listening on port ${port}`);
});

process.on('unhandledRejection', (err) => {
  console.log('unhandled rejection, shutting down...');
  console.log(err);

  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.log('uncaught exception, shutting down...');
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
