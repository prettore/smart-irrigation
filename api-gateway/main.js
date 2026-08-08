import express from 'express';
import dotenv from 'dotenv';
import mainRouter from './src/controllers/apiController.js';

const app = express();
dotenv.config();
app.use(express.json());
app.use('', mainRouter);

app.listen(process.env.PORT, process.env.HOST, () => {
  console.log(`Servidor rodando em ${process.env.HOST}:${process.env.PORT}`);
});
