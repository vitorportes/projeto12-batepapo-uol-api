import express, { json } from 'express';
import cors from 'cors';
import chalk from 'chalk';
import Joi from 'joi';
import dayjs from 'dayjs';
import { stripHtml } from 'string-strip-html';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const authSchema = Joi.object({
  name: Joi.string().required(),
});

const messageBodySchema = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid('message', 'private_message').required(),
});

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db = null;

mongoClient
  .connect()
  .then(() => {
    db = mongoClient.db('batepapo-uol');
    console.log(chalk.bold.red('Conected to MongoDB'));
  })
  .catch((err) => {
    console.log(chalk.bold.red('Error connecting to MongoDB', err));
  });

app.get('/participants', async (req, res) => {
  const { user } = req.headers;
  if (user) {
    try {
      const participants = await db
        .collection('participants')
        .find({ name: { $ne: user } })
        .toArray();
      res.send(participants);
    } catch (err) {
      res.status(500).send({ error: err.message });
    }
  } else {
    res.status(401).send({ error: 'Unauthorized' });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(chalk.bold.green(`Server running on port ${port}`));
});
