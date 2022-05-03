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

app.get('/messages', async (req, res) => {
  try {
    const { limit } = req.query;
    const { user } = req.headers;
    if (limit) {
      const requisicao = await db
        .collection('messages')
        .find({
          $or: [
            { to: 'Todos' },
            { to: user },
            { from: user },
            { type: 'message' },
          ],
        })
        .toArray();
      let messages = [...requisicao].reverse().slice(0, limit);
      res.send(messages.reverse());
    } else {
      const requisicao = await db
        .collection('messages')
        .find({ $or: [{ to: 'Todos' }, { to: user }, { from: user }] })
        .toArray();
      let messages = [...requisicao];
      res.send(messages);
    }
  } catch (error) {
    console.log(error);
  }
});

app.post('/participants', async (req, res) => {
  let { name } = req.body;
  if (name) {
    name = stripHtml(name).result.trim();
  }
  const loginValidation = authSchema.validate(req.body, {
    abortEarly: false,
  });
  if (loginValidation.hasOwnProperty('error')) {
    res
      .status(422)
      .send(loginValidation.error.details.map((detail) => detail.message));
  } else {
    try {
      const requisicao = await db.collection('participants').findOne({ name });
      if (requisicao) {
        res.status(409).send('User already exists');
      } else {
        await db.collection('participants').insertOne({
          name,
          lastStatus: Date.now(),
        });
        await db.collection('messages').insertOne({
          from: name,
          to: 'Todos',
          text: 'entra na sala...',
          type: 'status',
          time: dayjs().format('HH:mm:ss'),
        });
        res.status(201).send({ name });
      }
    } catch (err) {
      console.log('Request error: ', err);
    }
  }
});

app.post('/messages', async (req, res) => {
  let { to, text, type } = req.body;
  const { user } = req.headers;
  const bodyValidation = messageBodySchema.validate(req.body, {
    abortEarly: false,
  });
  const headerValidation = await db
    .collection('participants')
    .findOne({ name: user });
  if (bodyValidation.hasOwnProperty('error') || !headerValidation) {
    if (bodyValidation.error) {
      res
        .status(422)
        .send(bodyValidation.error.details.map((detail) => detail.message));
    } else {
      res.sendStatus(422);
    }
  } else {
    try {
      const message = await db.collection('messages').insertOne({
        from: user,
        to: stripHtml(to).result.trim(),
        text: stripHtml(text).result.trim(),
        type: stripHtml(type).result.trim(),
        time: dayjs().format('HH:mm:ss'),
      });
      res.sendStatus(201);
    } catch (err) {
      console.log(err);
    }
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(chalk.bold.green(`Server running on port ${port}`));
});
