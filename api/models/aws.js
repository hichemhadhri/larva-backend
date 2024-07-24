const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

const region = process.env.S3_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
});

module.exports = s3Client;
