const mongoose = require('mongoose')

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;


const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  contests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest'
  }],
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require("../models/aws");
const User = require("../models/user");


postSchema.pre('findOneAndDelete', async function (next) {
  try {
    const post = await this.model.findOne(this.getFilter());

    // Delete the post file from S3
    if (post.mediaUrl) {
      const key = post.mediaUrl;
      const deleteParams = {
        Bucket: process.env.S3_BUCKET,
        Key: key
      };
      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
    }

    // Remove the post reference from the user's posts array
    await User.findByIdAndUpdate(post.author, {
      $pull: { posts: post._id }
    });

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Post', postSchema);


